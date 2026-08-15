import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authGuard, checkRateLimit, getServiceClient, HttpError } from "../_shared/index.ts";

// ---------------------------------------------------------------------------
// Signal extraction — pure regex, inlined from gateway/normalize/signals.ts
// ---------------------------------------------------------------------------
interface RiskSignals {
  pix_mention?: boolean;
  urgency_language?: boolean;
  impersonation_pattern?: boolean;
  secrecy_demand?: boolean;
  device_excuse?: boolean;
  link_suspicious?: boolean;
  [key: string]: boolean | undefined;
}

const MONEY = [
  /\bpix\b/i, /\br\$\s*\d/i, /\br\$\b/i, /\bdinheiro\b/i, /\breais?\b/i,
  /\btransfer[eê](?:r|ncia)?\b/i, /\bdeposit(?:o|ar|ada?|e)\b/i,
  /\bboleto\b/i, /\bcpf\b/i, /\bconta\s+banc[aá]ria\b/i, /\bpagament(?:o|os)\b/i,
];
const URGENCY = [
  /\burgente\b/i, /\bagora\b/i, /\br[aá]pid(?:o|a|amente)\b/i,
  /\bemerg[eê]ncia\b/i, /\bimediat(?:o|a|amente)\b/i, /\bcorrend(?:o|a)\b/i,
  /\bhoje\s+ainda\b/i, /\bpra\s+ontem\b/i,
];
const FAMILY = [
  /\bm[ãa]e\b/i, /\bpai\b/i, /\bfilh[oa]\b/i, /\bnet[oa]\b/i,
  /\bsobrinh[oa]\b/i, /\bti[oa]\b/i, /\bav[oó]\b/i, /\bv[oó]\b/i,
  /\birm[ãa]o?\b/i, /\bprim[oa]\b/i,
];
const SECRECY = [
  /\bn[ãa]o\s+(?:ligue?|fal[ae]|cont[ae]|avis[ae])/i,
  /\bn[ãa]o\s+cont[ae]\s+(?:pra|para|a)\s+ningu[eé]m/i,
  /\bsegredo\b/i, /\bentre\s+n[oó]s\b/i, /\bsó\s+eu\s+e\s+voc[eê]\b/i,
];
const DEVICE = [
  /\baparelh(?:o|inho)\s+(?:quebr|estrago|roub)/i,
  /\btroquei\s+(?:de\s+)?n[uú]mero/i,
  /\bcelular\s+(?:quebr|estrago|roub|novo)/i,
  /\bn[uú]mero\s+novo\b/i, /\bchip\s+novo\b/i,
  /\bperdi\s+(?:o\s+)?celular\b/i,
  /\btelefone\s+(?:quebr|estrago|roub|novo)/i,
];
const LINKS = [
  /bit\.ly/i, /tinyurl\.com/i, /is\.gd/i, /t\.co\//i,
  /goo\.gl/i, /shorturl/i, /ow\.ly/i,
];

function any(pats: RegExp[], t: string): boolean {
  return pats.some((r) => r.test(t));
}

function extractSignals(text: string): RiskSignals {
  const s: RiskSignals = {};
  if (any(MONEY, text)) s.pix_mention = true;
  if (any(URGENCY, text)) s.urgency_language = true;
  if (any(FAMILY, text)) s.impersonation_pattern = true;
  if (any(SECRECY, text)) s.secrecy_demand = true;
  if (any(DEVICE, text)) s.device_excuse = true;
  if (any(LINKS, text)) s.link_suspicious = true;
  return s;
}

// ---------------------------------------------------------------------------
// Deterministic rules — inlined from risk/rules
// ---------------------------------------------------------------------------
type Severity = "low" | "medium" | "high" | "critical";

interface RuleResult {
  decision: "allow" | "review" | "block";
  severity: Severity;
  triggered: string[];
}

function sig(signals: RiskSignals, k: string): boolean {
  return signals[k] === true;
}

function runRules(signals: RiskSignals): RuleResult {
  const triggered: string[] = [];
  let max: Severity = "low";
  const ord: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

  const rules: { name: string; sev: Severity; test: () => boolean }[] = [
    { name: "impersonation_money_urgency", sev: "critical", test: () => sig(signals, "impersonation_pattern") && sig(signals, "pix_mention") && sig(signals, "urgency_language") },
    { name: "impersonation_money_secrecy", sev: "critical", test: () => sig(signals, "impersonation_pattern") && sig(signals, "pix_mention") && sig(signals, "secrecy_demand") },
    { name: "device_excuse_money_urgency", sev: "critical", test: () => sig(signals, "device_excuse") && sig(signals, "pix_mention") && sig(signals, "urgency_language") },
    { name: "money_urgency", sev: "high", test: () => sig(signals, "pix_mention") && sig(signals, "urgency_language") },
    { name: "impersonation_money", sev: "high", test: () => sig(signals, "impersonation_pattern") && sig(signals, "pix_mention") },
    { name: "device_excuse_money", sev: "high", test: () => sig(signals, "device_excuse") && sig(signals, "pix_mention") },
    { name: "secrecy_money", sev: "high", test: () => sig(signals, "secrecy_demand") && sig(signals, "pix_mention") },
    { name: "impersonation_urgency", sev: "medium", test: () => sig(signals, "impersonation_pattern") && sig(signals, "urgency_language") },
    { name: "link_suspicious_urgency", sev: "medium", test: () => sig(signals, "link_suspicious") && sig(signals, "urgency_language") },
    { name: "device_excuse_urgency", sev: "medium", test: () => sig(signals, "device_excuse") && sig(signals, "urgency_language") },
    { name: "forwarded_money", sev: "medium", test: () => sig(signals, "forwarded") && sig(signals, "pix_mention") },
  ];

  for (const r of rules) {
    if (r.test()) {
      triggered.push(r.name);
      if (ord[r.sev] > ord[max]) max = r.sev;
    }
  }

  const decMap: Record<Severity, "allow" | "review" | "block"> = {
    low: "allow", medium: "review", high: "block", critical: "block",
  };

  return {
    decision: triggered.length > 0 ? decMap[max] : "allow",
    severity: max,
    triggered,
  };
}

// ---------------------------------------------------------------------------
// Classifier — weighted sum, inlined from risk/classifier
// ---------------------------------------------------------------------------
const WEIGHTS: Record<string, number> = {
  pix_mention: 0.25, urgency_language: 0.20, impersonation_pattern: 0.20,
  secrecy_demand: 0.20, device_excuse: 0.18, link_suspicious: 0.10,
  forwarded: 0.05,
};

function classifyScore(signals: RiskSignals): number {
  let raw = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) {
    if (signals[k] === true) raw += w;
  }
  return Math.min(Math.max(raw, 0), 1);
}

// ---------------------------------------------------------------------------
// Advice builder — honesty rule
// ---------------------------------------------------------------------------
const SIGNAL_LABELS: Record<string, string> = {
  pix_mention: "Menção a Pix/dinheiro/transferência",
  urgency_language: "Linguagem de urgência",
  impersonation_pattern: "Menção a relação familiar",
  secrecy_demand: "Pedido de sigilo",
  device_excuse: "Desculpa de troca de aparelho",
  link_suspicious: "Link encurtado suspeito",
};

function activeLabels(signals: RiskSignals): string[] {
  return Object.entries(signals)
    .filter(([, v]) => v === true)
    .map(([k]) => SIGNAL_LABELS[k] ?? k);
}

function buildAdvice(
  riskLevel: string,
  signals: RiskSignals,
): string {
  const labels = activeLabels(signals);

  if (riskLevel === "dangerous") {
    return [
      "ALTO RISCO DE GOLPE",
      "",
      "Esta mensagem apresenta padrões claros de golpe:",
      ...labels.map((l) => `  • ${l}`),
      "",
      "NÃO faça nenhuma transferência.",
      "Peça a senha combinada antes de qualquer coisa.",
      "Se a pessoa não souber, não transfira e ligue para o familiar por outro meio.",
    ].join("\n");
  }

  if (riskLevel === "suspicious") {
    return [
      "ATENÇÃO: mensagem suspeita",
      "",
      "Identifiquei alguns sinais que merecem cuidado:",
      ...labels.map((l) => `  • ${l}`),
      "",
      "Não identifiquei padrões claros de golpe, mas se há pedido de dinheiro, " +
        "peça a senha combinada mesmo assim.",
      "Na dúvida, ligue para o familiar por outro meio para confirmar.",
    ].join("\n");
  }

  return [
    "Não identifiquei padrões claros de golpe nesta mensagem.",
    "",
    "Mas lembre-se: se houver qualquer pedido de dinheiro ou transferência, " +
      "peça a senha combinada mesmo assim.",
    "",
    "O Combinado analisa padrões de texto, mas nenhuma ferramenta é infalível. " +
      "Na dúvida, confirme por outro canal.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Edge Function handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Method not allowed");
    }

    const { guardianId, familyId } = await authGuard(req);

    const body = await req.json();
    const text = body.text;
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      throw new HttpError(400, "Missing or empty 'text' field");
    }

    if (text.length > 5000) {
      throw new HttpError(400, "Text too long (max 5000 characters)");
    }

    await checkRateLimit(`check_message:${guardianId}`, 3600, 30);

    const signals = extractSignals(text);
    const rules = runRules(signals);
    const score = classifyScore(signals);

    let risk_level: "safe" | "suspicious" | "dangerous";
    if (rules.decision === "block") {
      risk_level = "dangerous";
    } else if (rules.decision === "review" || score >= 0.40) {
      risk_level = "suspicious";
    } else {
      risk_level = "safe";
    }

    const advice = buildAdvice(risk_level, signals);

    const serviceClient = getServiceClient();
    await serviceClient.from("audit_log").insert({
      family_id: familyId,
      actor_id: guardianId,
      actor_type: "guardian",
      action: `check_message:${guardianId}`,
      target_type: "verification",
      metadata: {
        risk_level,
        severity: rules.severity,
        triggered_rules: rules.triggered,
        classifier_score: score,
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        risk_level,
        severity: rules.severity,
        signals,
        triggered_rules: rules.triggered,
        classifier_score: score,
        advice,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      {
        status,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
