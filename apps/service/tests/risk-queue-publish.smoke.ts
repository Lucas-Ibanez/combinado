// Smoke test do publish em risk_queue (T5.5).
//
// Prova o round-trip: um WAMessage sintético → normalize → queue.enqueue →
// queue.consume → asserts na payload. Sem WhatsApp real; a lógica de
// entrega do listener foi validada em T5.3, o normalize em T5.4, e este
// aqui prova que o evento chega à fila com o formato certo.
//
// Rodar: pnpm --filter @combinado/service test:risk-publish
import { randomUUID } from 'node:crypto'
import type { WAMessage } from '@whiskeysockets/baileys'
import type { MinimalEvent } from '@combinado/shared'
import { normalize } from '../src/gateway/normalize/index.js'
import { queue } from '../src/shared/queue/index.js'

let passes = 0, failures = 0
function assert(cond: unknown, msg: string): void {
  if (cond) { passes += 1; console.log(`[ok]   ${msg}`) }
  else { failures += 1; console.error(`[fail] ${msg}`) }
}

const CTX = {
  familyId: randomUUID(),
  protectedPersonId: randomUUID(),
}

// InboundMessage sintética representando uma mensagem "de golpe"
const bait = 'Oi vovó, é seu neto! Manda um Pix urgente, R$ 500!'
const eventId = `MSG_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const raw = {
  key: {
    fromMe: false,
    remoteJid: '5511999999999@s.whatsapp.net',
    id: eventId,
  },
  message: { conversation: bait },
  pushName: 'Neto',
  messageTimestamp: 1723027200,
} as unknown as WAMessage

const inbound = {
  raw,
  remoteJid: raw.key.remoteJid!,
  messageId: raw.key.id!,
  timestamp: 1723027200,
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

async function main() {
  // 1) Normalize
  const event: MinimalEvent = normalize(inbound, CTX)
  assert(event.event_id === eventId, `event_id preservado (${event.event_id})`)
  assert(event.signals.pix_mention === true, 'sinais extraídos (pix_mention)')
  assert(!JSON.stringify(event).includes(bait), 'evento não carrega o texto bruto')

  // 2) Publish — o que o manager faz em handleInboundMessage
  const queueMsgId = await queue.enqueue('risk_queue', event)
  assert(typeof queueMsgId === 'number' && queueMsgId > 0, `enqueue devolveu msg_id=${queueMsgId}`)

  // 3) Consume e localize nossa msg pelo event_id (podem chegar outras)
  const messages = await queue.consume<MinimalEvent>('risk_queue', {
    visibilitySeconds: 30,
    batchSize: 10,
  })
  const ours = messages.find((m) => m.body?.event_id === eventId)
  assert(ours !== undefined, 'evento publicado foi consumido de volta da risk_queue')

  if (ours) {
    // 4) Valida shape completo
    const body = ours.body
    assert(body.family_id === CTX.familyId, 'family_id preservado no round-trip')
    assert(body.protected_person_id === CTX.protectedPersonId, 'protected_person_id preservado')
    assert(body.sender_jid === '5511999999999@s.whatsapp.net', 'sender_jid preservado')
    assert(body.message_type === 'text', 'message_type preservado')
    assert(typeof body.text_length === 'number' && body.text_length > 0, 'text_length preservado')
    assert(body.signals.pix_mention === true, 'signal pix_mention preservado')
    assert(body.signals.urgency_language === true, 'signal urgency_language preservado')
    assert(body.signals.impersonation_pattern === true, 'signal impersonation_pattern preservado')
    assert(typeof body.captured_at === 'string' && body.captured_at.length > 0, 'captured_at preservado')
    assert(body.wa_timestamp === 1723027200, 'wa_timestamp preservado')

    // ★ Verificação de privacidade: nem no JSON serializado do body há texto bruto
    const serialized = JSON.stringify(body)
    assert(!serialized.includes(bait), 'texto original ausente após round-trip na fila')
    assert(!serialized.includes('vovó'), 'trecho do texto ausente após round-trip')
    assert(!serialized.includes('R$ 500'), 'valor específico ausente após round-trip')
  }

  // 5) Ack de todas as consumidas — limpa qualquer resíduo
  for (const m of messages) {
    await queue.ack('risk_queue', m.msgId)
  }
  const drained = await drain()
  console.log(`[info] fila limpa: ${drained} mensagens residuais purgadas`)

  console.log(`\nresumo: ${passes} ok, ${failures} fail`)
  if (failures > 0) process.exit(1)
  console.log('\n✓ smoke test de publish em risk_queue passou')
}

main().catch(async (err) => {
  console.error('smoke test falhou:', err)
  try { await drain() } catch {}
  process.exit(1)
})
