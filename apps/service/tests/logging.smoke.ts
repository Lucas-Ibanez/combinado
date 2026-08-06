// Smoke test do logger — simula um fluxo (evento captado -> risk -> incident)
// e confirma que NENHUM dado sensível aparece nas linhas de log.
// Rodar: pnpm --filter @combinado/service test:logging

import { createLogger } from '../src/shared/logging/index.js'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`[fail] ${msg}`)
    process.exit(1)
  }
  console.error(`[ok]   ${msg}`)
}

// Captura o stdout do console.log — é onde info/debug caem.
const captured: string[] = []
const originalLog = console.log
const originalError = console.error
console.log = (...args: unknown[]) => {
  captured.push(args.map(String).join(' '))
}
console.error = (...args: unknown[]) => {
  captured.push(args.map(String).join(' '))
}

const gateway = createLogger('gateway')
const risk = createLogger('risk').child({ pipeline_version: 'v1' })

// Fluxo simulado com dados PROIBIDOS de aparecer nos logs:
const guardianId = '11111111-2222-3333-4444-555555555555'
const familyId = '99999999-8888-7777-6666-555555555555'
const incidentId = 'aa111111-bb22-cc33-dd44-ee5555555555'
const badPhone = '+5511987654321'
const badMessage = 'Oi vô, é seu neto! Manda um Pix urgente...'
const badEmail = 'attacker@evil.com'

// Cenário 1 — dev honesto: passou só IDs e tipo. Log deve conter tudo.
gateway.info('mensagem recebida', {
  guardian_id: guardianId,
  family_id: familyId,
  event_type: 'inbound_text',
})

// Cenário 2 — dev distraído: mandou o telefone num campo com nome "phone".
gateway.info('novo contato', { phone: badPhone, event_type: 'contact_added' })

// Cenário 3 — dev muito distraído: mandou o CONTEÚDO num campo "message".
risk.warn('classificador detectou sinal', {
  incident_id: incidentId,
  severity: 'high',
  message: badMessage,
  content: badMessage,
})

// Cenário 4 — telefone escondido dentro de string livre num campo inocente:
gateway.info('evento normalizado', {
  event_type: 'inbound_text',
  summary: `contato de ${badPhone} pedindo transferência`,
})

// Cenário 5 — e-mail dentro de metadata livre:
gateway.info('audit event', { note: `feedback do usuário: ${badEmail}` })

// Cenário 6 — objeto aninhado com o corpo bruto:
risk.error('falha ao classificar', {
  incident_id: incidentId,
  raw_event: { body: badMessage, phone_number: badPhone },
})

// Restaura console
console.log = originalLog
console.error = originalError

// Junta todas as linhas num só bloco para verificação
const allOutput = captured.join('\n')

// Asserts positivos — os campos SEGUROS devem estar lá
assert(allOutput.includes(guardianId), 'guardian_id aparece nos logs (é seguro)')
assert(allOutput.includes(familyId), 'family_id aparece nos logs (é seguro)')
assert(allOutput.includes(incidentId), 'incident_id aparece nos logs (é seguro)')
assert(allOutput.includes('inbound_text'), 'event_type aparece (é seguro)')
assert(allOutput.includes('pipeline_version'), 'bindings do child aparecem')
assert(allOutput.includes('high'), 'severity aparece (é seguro)')

// Asserts negativos — NENHUM dado sensível pode aparecer
assert(!allOutput.includes(badMessage), 'conteúdo bruto da mensagem NÃO aparece')
assert(
  !allOutput.includes('Oi vô'),
  'nem trecho parcial do texto da mensagem aparece',
)
assert(
  !allOutput.includes(badPhone),
  'telefone completo com prefixo (+5511987654321) NÃO aparece',
)
assert(
  !allOutput.includes('11987654321'),
  'telefone sem prefixo (11987654321) também NÃO aparece',
)
assert(!allOutput.includes(badEmail), 'e-mail completo NÃO aparece')
assert(
  !allOutput.includes('attacker@'),
  'nem parte local do e-mail aparece',
)

// Verifica que o formato é JSON estruturado
const lines = captured.filter((l) => l.trim().length > 0)
assert(lines.length >= 6, `pelo menos 6 linhas de log (foram ${lines.length})`)
for (const line of lines) {
  try {
    const parsed = JSON.parse(line)
    assert(
      typeof parsed.ts === 'string' &&
        typeof parsed.level === 'string' &&
        typeof parsed.module === 'string' &&
        typeof parsed.msg === 'string',
      `linha JSON tem ts/level/module/msg: ${parsed.msg}`,
    )
  } catch {
    console.error(`[fail] linha não é JSON válido: ${line}`)
    process.exit(1)
  }
}

// Mostra pro dev o que foi realmente logado — assim vê que o mascaramento
// preserva os últimos 4 dígitos ("***4321") sem vazar o número inteiro.
console.log('\n--- linhas efetivamente emitidas ---')
for (const line of lines) console.log(line)

console.log('\n✓ smoke test de logging passou — nenhum dado sensível vazou')
