import type { MinimalEvent } from '@combinado/shared'
import type { InboundMessage } from '../baileys/index.js'
import { detectMessageType, extractText, isForwarded } from './text.js'
import { computeSignals } from './signals.js'

export interface NormalizeContext {
  familyId: string
  protectedPersonId: string
}

// Converte um InboundMessage do Baileys em um MinimalEvent — a fronteira onde
// o conteúdo bruto vira SINAL. Depois deste ponto, nada além dos flags e IDs
// trafega. É a materialização de privacidade da F11 (nascendo aqui).
export function normalize(
  inbound: InboundMessage,
  ctx: NormalizeContext,
): MinimalEvent {
  const messageType = detectMessageType(inbound.raw)
  // Texto extraído LOCALMENTE — só serve para computar sinais neste escopo.
  // Não é atribuído ao evento; sai daqui como flag/length.
  const text = extractText(inbound.raw)
  const signals = computeSignals({ text, messageType })

  if (isForwarded(inbound.raw)) {
    signals.forwarded = true
  }

  // Heurística best-effort de "sender desconhecido": pushName vazio.
  // Refinamento com a lista de contatos vem em F6/F7.
  if (!inbound.raw.pushName || !inbound.raw.pushName.trim()) {
    signals.unknown_sender = true
  }

  return {
    event_id: inbound.messageId,
    family_id: ctx.familyId,
    protected_person_id: ctx.protectedPersonId,
    sender_jid: inbound.remoteJid,
    message_type: messageType,
    text_length: text ? text.length : null,
    signals,
    captured_at: new Date().toISOString(),
    wa_timestamp: inbound.timestamp,
  }
}

// Reexporta primitivas para os testes que exercitam partes isoladamente.
export { extractText, detectMessageType, isForwarded } from './text.js'
export { computeSignals } from './signals.js'
