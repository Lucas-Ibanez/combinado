// Smoke test do consumo da risk_queue (T6.1).
//
// Prova o ciclo completo: enqueue → risk worker consome → ack → fila vazia.
// Verifica que o evento é processado e removido da fila, e que o log não
// contém PII (sem texto bruto, sem telefone completo).
//
// Rodar: pnpm --filter @combinado/service test:risk-consume
import { randomUUID } from 'node:crypto'
import type { MinimalEvent } from '@combinado/shared'
import { queue } from '../src/shared/queue/index.js'
import { createLogger } from '../src/shared/logging/index.js'
import { startRisk } from '../src/risk/index.js'

let passes = 0, failures = 0
function assert(cond: unknown, msg: string): void {
  if (cond) { passes += 1; console.log(`[ok]   ${msg}`) }
  else { failures += 1; console.error(`[fail] ${msg}`) }
}

async function drain(): Promise<number> {
  let total = 0
  for (let i = 0; i < 5; i++) {
    const msgs = await queue.consume('risk_queue', { batchSize: 20, visibilitySeconds: 1 })
    for (const m of msgs) await queue.ack('risk_queue', m.msgId)
    total += msgs.length
    if (msgs.length === 0) break
    await new Promise((r) => setTimeout(r, 1200))
  }
  return total
}

const eventId = `RISK_TEST_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const testEvent: MinimalEvent = {
  event_id: eventId,
  family_id: randomUUID(),
  protected_person_id: randomUUID(),
  sender_jid: '5511999887766@s.whatsapp.net',
  message_type: 'text',
  text_length: 42,
  signals: {
    pix_mention: true,
    urgency_language: true,
    impersonation_pattern: false,
    voice_note: false,
    link_suspicious: false,
    unknown_sender: false,
  },
  captured_at: new Date().toISOString(),
  wa_timestamp: Math.floor(Date.now() / 1000),
}

async function main() {
  // 0) Limpa resíduos ANTES de subir o worker
  const drained = await drain()
  if (drained > 0) console.log(`[info] ${drained} mensagens residuais purgadas`)

  // 1) Captura logs do risk worker para verificação
  const logEntries: Record<string, unknown>[] = []
  const originalStdout = process.stdout.write.bind(process.stdout)
  process.stdout.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
    const line = typeof chunk === 'string' ? chunk : chunk.toString()
    try {
      const parsed = JSON.parse(line.trim())
      if (parsed.module === 'risk') logEntries.push(parsed)
    } catch { /* não é JSON, ignora */ }
    return originalStdout(chunk, ...args as [BufferEncoding?, ((err?: Error) => void)?])
  }) as typeof process.stdout.write

  // 2) Publica o evento de teste ANTES de subir o worker — assim o worker
  // encontra a mensagem na primeira poll, sem race com o teste.
  const queueMsgId = await queue.enqueue('risk_queue', testEvent)
  assert(typeof queueMsgId === 'number' && queueMsgId > 0, `enqueue devolveu msg_id=${queueMsgId}`)
  console.log(`[info] evento publicado: event_id=${eventId}, queue_msg_id=${queueMsgId}`)

  // 3) Sobe o risk worker — ele vai consumir na primeira iteração do loop
  const log = createLogger('risk')
  const risk = await startRisk(log)

  // 4) Espera o worker processar — checamos via log, NÃO via consume (que
  // roubaria a mensagem do worker). Até 20s.
  let ackSeen = false
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    ackSeen = logEntries.some(
      (e) => e.msg === 'evento processado e confirmado' && e.event_id === eventId,
    )
    if (ackSeen) break
  }

  assert(ackSeen, 'evento foi consumido e ackado pelo risk worker (visto no log)')

  // 5) Para o worker antes de verificar a fila — evita races
  process.stdout.write = originalStdout
  await risk.stop()

  // 6) Verifica que a fila está vazia (o ack removeu a mensagem)
  const remaining = await queue.consume<MinimalEvent>('risk_queue', {
    visibilitySeconds: 1,
    batchSize: 10,
  })
  const ours = remaining.find((m) => m.body?.event_id === eventId)
  assert(!ours, 'evento não está mais na fila após ack')
  // Devolve qualquer outra mensagem
  for (const m of remaining) {
    // Não faz ack — voltarão após vt expirar
  }

  // 7) Verifica os logs capturados
  const processLog = logEntries.find(
    (e) => e.msg === 'pipeline de risco executando' && e.event_id === eventId,
  )
  assert(!!processLog, 'log "pipeline de risco executando" emitido para o evento')

  const ackLog = logEntries.find(
    (e) => e.msg === 'evento processado e confirmado' && e.event_id === eventId,
  )
  assert(!!ackLog, 'log "evento processado e confirmado" emitido para o evento')

  // 8) Verificação de PII: nenhum log deve conter JID completo ou telefone
  const allLogJson = JSON.stringify(logEntries)
  assert(!allLogJson.includes('5511999887766@s.whatsapp.net'), 'JID completo ausente nos logs')
  assert(!allLogJson.includes('5511999887766'), 'telefone completo ausente nos logs')

  // 9) Sinais são dados seguros e aparecem no log
  if (processLog) {
    const signals = (processLog as Record<string, unknown>).signals as Record<string, boolean>
    assert(signals?.pix_mention === true, 'signal pix_mention logado corretamente')
    assert(signals?.urgency_language === true, 'signal urgency_language logado corretamente')
  }

  // 10) Metadados (não PII) aparecem no log
  if (processLog) {
    assert((processLog as Record<string, unknown>).wa_type === 'text', 'wa_type logado')
    assert((processLog as Record<string, unknown>).char_count === 42, 'char_count logado')
  }

  await drain()

  console.log(`\nresumo: ${passes} ok, ${failures} fail`)
  if (failures > 0) process.exit(1)
  console.log('\n✓ smoke test de consumo da risk_queue passou')
}

main().catch(async (err) => {
  console.error('smoke test falhou:', err)
  try { await drain() } catch {}
  process.exit(1)
})
