import type { IncidentDelivery, Severity } from '@combinado/shared'
import { Phone, ShieldAlert, UserPlus, MessageCircleWarning } from 'lucide-react'

interface CrisisViewProps {
  personName: string
  personPhone: string | null
  severity: Severity
  summary: string | null
  openedAt: string
  incidentId: string
  deliveries: IncidentDelivery[]
  onAcknowledge?: (action: string) => void
}

const SEVERITY_HEADLINE: Record<Severity, string> = {
  critical: 'Pedido urgente de Pix detectado',
  high: 'Mensagem suspeita detectada',
  medium: 'Atividade incomum detectada',
  low: 'Atividade para verificar',
}

function formatTimeShort(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function parseSignals(summary: string | null): string[] {
  if (!summary) return []
  const afterColon = summary.split(': ')[1]
  if (!afterColon) return []
  return afterColon.split(', ').map(formatSignalLabel)
}

function formatSignalLabel(signal: string): string {
  const map: Record<string, string> = {
    pix_mention: 'Menção a Pix',
    urgency_language: 'Linguagem de urgência',
    unknown_sender: 'Remetente desconhecido',
    voice_note: 'Áudio de voz',
    link_suspicious: 'Link suspeito',
    impersonation_pattern: 'Padrão de personificação',
    forwarded: 'Mensagem encaminhada',
    secrecy_demand: 'Pedido de sigilo',
    device_excuse: 'Desculpa de aparelho',
  }
  return map[signal] ?? signal
}

export default function CrisisView({
  personName,
  personPhone,
  severity,
  summary,
  openedAt,
  deliveries,
  onAcknowledge,
}: CrisisViewProps) {
  const signals = parseSignals(summary)
  const currentStep = deliveries.filter((d) => !d.failure_reason && !d.acknowledged_at).length
  const totalSteps = deliveries.length

  return (
    <div className="min-h-[calc(100vh-56px)] bg-danger-surface flex flex-col">
      <div className="bg-danger px-4 py-5 text-danger-foreground">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="w-6 h-6" />
          <span className="text-xs font-medium uppercase tracking-wide opacity-90">
            Incidente ativo
          </span>
        </div>
        <h1 className="text-xl font-bold leading-tight">
          {SEVERITY_HEADLINE[severity]}
        </h1>
        <p className="text-sm mt-1 opacity-90">
          {personName} · {formatTimeShort(openedAt)}
        </p>
      </div>

      <div className="flex-1 px-4 py-5 space-y-5">
        {signals.length > 0 && (
          <div className="rounded-xl bg-surface border border-danger/20 p-4">
            <h2 className="text-sm font-semibold text-text mb-2">
              O que foi detectado
            </h2>
            <ul className="space-y-1.5">
              {signals.map((s) => (
                <li key={s} className="flex items-center gap-2 text-sm text-text">
                  <span className="w-1.5 h-1.5 rounded-full bg-danger shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {totalSteps > 0 && (
          <p className="text-xs text-text-muted text-center">
            Escada de alerta em andamento ({currentStep} de {totalSteps} canais ativos)
          </p>
        )}

        <div className="space-y-3">
          <a
            href={personPhone ? `tel:${personPhone}` : undefined}
            onClick={(e) => {
              if (!personPhone) e.preventDefault()
            }}
            className={`flex items-center justify-center gap-3 w-full rounded-xl py-4 px-6 text-base font-bold shadow-lg transition-colors ${
              personPhone
                ? 'bg-danger text-danger-foreground active:bg-danger-dark'
                : 'bg-danger/50 text-danger-foreground/70 cursor-not-allowed'
            }`}
          >
            <Phone className="w-5 h-5" />
            Ligar para {personName}
          </a>

          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => onAcknowledge?.('safe_confirmed')}
              className="flex items-center gap-3 w-full rounded-xl border-2 border-brand bg-surface py-3.5 px-4 text-sm font-semibold text-brand transition-colors active:bg-brand-surface"
            >
              <MessageCircleWarning className="w-5 h-5 shrink-0" />
              Fui eu quem pediu — está tudo bem
            </button>

            <button
              type="button"
              onClick={() => onAcknowledge?.('threat_confirmed')}
              className="flex items-center gap-3 w-full rounded-xl border-2 border-danger bg-surface py-3.5 px-4 text-sm font-semibold text-danger transition-colors active:bg-danger-surface"
            >
              <ShieldAlert className="w-5 h-5 shrink-0" />
              Não reconheço este pedido
            </button>

            <button
              type="button"
              onClick={() => onAcknowledge?.('escalate')}
              className="flex items-center gap-3 w-full rounded-xl border-2 border-attention bg-surface py-3.5 px-4 text-sm font-semibold text-attention transition-colors active:bg-attention-surface"
            >
              <UserPlus className="w-5 h-5 shrink-0" />
              Chamar outro guardião
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
