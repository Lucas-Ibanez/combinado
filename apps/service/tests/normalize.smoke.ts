// Smoke test do normalize (T5.4).
//
// Verifica:
//   1. Cada tipo de WAMessage vira o MinimalEvent correto
//   2. Sinais determinísticos são extraídos (pix_mention, urgency_language,
//      impersonation_pattern, link_suspicious, voice_note, forwarded, unknown_sender)
//   3. O evento produzido não carrega o conteúdo bruto — checagem por
//      substring do texto sensível no JSON.stringify do evento
//   4. Áudio guarda referência (event_id = msgId), não binário
import type { WAMessage } from '@whiskeysockets/baileys'
import type { InboundMessage } from '../src/gateway/baileys/index.js'
import { normalize } from '../src/gateway/normalize/index.js'

let passes = 0, failures = 0
function assert(cond: unknown, msg: string): void {
  if (cond) { passes += 1; console.log(`[ok]   ${msg}`) }
  else { failures += 1; console.error(`[fail] ${msg}`) }
}

const CTX = {
  familyId: '11111111-1111-1111-1111-111111111111',
  protectedPersonId: '22222222-2222-2222-2222-222222222222',
}

function makeInbound(overrides: {
  message: Record<string, unknown>
  msgId?: string
  remoteJid?: string
  pushName?: string
  timestamp?: number
}): InboundMessage {
  const raw = {
    key: {
      fromMe: false,
      remoteJid: overrides.remoteJid ?? '5511999999999@s.whatsapp.net',
      id: overrides.msgId ?? 'MSG_XYZ',
    },
    message: overrides.message,
    pushName: overrides.pushName,
    messageTimestamp: overrides.timestamp ?? 1723027200,
  } as unknown as WAMessage
  return {
    raw,
    remoteJid: raw.key.remoteJid!,
    messageId: raw.key.id!,
    timestamp: overrides.timestamp ?? 1723027200,
  }
}

// ---------------------------------------------------------------------------
// Bloco 1 — Cenário clássico de golpe: texto com todos os sinais
// ---------------------------------------------------------------------------
console.log('\n== golpe de impersonação (texto) ==')
{
  const bait = 'Oi vovó, é seu neto! Preciso de um Pix urgente agora, R$ 500!'
  const ev = normalize(
    makeInbound({ message: { conversation: bait }, pushName: 'Neto' }),
    CTX,
  )
  assert(ev.message_type === 'text', 'message_type=text')
  assert(ev.event_id === 'MSG_XYZ', 'event_id preservado do wa msg id')
  assert(ev.family_id === CTX.familyId, 'family_id repassado do contexto')
  assert(ev.protected_person_id === CTX.protectedPersonId, 'protected_person_id repassado')
  assert(ev.sender_jid === '5511999999999@s.whatsapp.net', 'sender_jid preservado')
  assert(ev.text_length === bait.length, `text_length=${bait.length}`)
  assert(ev.wa_timestamp === 1723027200, 'wa_timestamp preservado')
  assert(!!ev.captured_at, 'captured_at preenchido')
  assert(ev.signals.pix_mention === true, 'pix_mention detectado')
  assert(ev.signals.urgency_language === true, 'urgency_language detectado')
  assert(ev.signals.impersonation_pattern === true, 'impersonation_pattern detectado')
  assert(!ev.signals.voice_note, 'voice_note não é ativado para texto')
  assert(!ev.signals.unknown_sender, 'com pushName, unknown_sender fica falso')

  // ★★★ Verificação chave: o texto NÃO aparece no evento serializado ★★★
  const serialized = JSON.stringify(ev)
  assert(!serialized.includes(bait), 'texto completo não aparece no JSON do evento')
  assert(!serialized.includes('vovó'), 'trecho do texto ("vovó") não aparece no JSON')
  assert(!serialized.includes('R$ 500'), 'valor específico não aparece no JSON')
}

// ---------------------------------------------------------------------------
// Bloco 2 — Texto neutro: nenhum sinal
// ---------------------------------------------------------------------------
console.log('\n== texto neutro (sem sinais) ==')
{
  const neutro = 'oi, tudo bem? te ligo depois'
  const ev = normalize(
    makeInbound({ message: { conversation: neutro }, pushName: 'João' }),
    CTX,
  )
  assert(ev.message_type === 'text', 'text neutro: message_type=text')
  assert(!ev.signals.pix_mention, 'sem pix_mention')
  assert(!ev.signals.urgency_language, 'sem urgency_language')
  assert(!ev.signals.impersonation_pattern, 'sem impersonation_pattern')
  assert(!ev.signals.link_suspicious, 'sem link_suspicious')
  assert(!ev.signals.voice_note, 'sem voice_note')
  const serialized = JSON.stringify(ev)
  assert(!serialized.includes(neutro), 'texto neutro também não vaza no evento')
}

// ---------------------------------------------------------------------------
// Bloco 3 — Áudio: guarda referência, sem binário
// ---------------------------------------------------------------------------
console.log('\n== áudio ==')
{
  const ev = normalize(
    makeInbound({
      message: { audioMessage: { url: 'https://mmg.whatsapp/audio.enc', seconds: 12, mediaKey: 'binkey' } },
      msgId: 'AUDIO_1',
      pushName: 'Voz',
    }),
    CTX,
  )
  assert(ev.message_type === 'audio', 'audio: message_type=audio')
  assert(ev.text_length === null, 'audio: text_length=null (sem texto)')
  assert(ev.signals.voice_note === true, 'audio: voice_note=true (vetor de voz clonada)')
  assert(ev.event_id === 'AUDIO_1', 'event_id serve como referência para transcrição futura')
  const serialized = JSON.stringify(ev)
  assert(!serialized.includes('binkey'), 'mediaKey do áudio não aparece no evento')
  assert(!serialized.includes('audio.enc'), 'url do binário não aparece no evento')
}

// ---------------------------------------------------------------------------
// Bloco 4 — Legenda de imagem: extraída pra sinais
// ---------------------------------------------------------------------------
console.log('\n== imagem com legenda golpista ==')
{
  const caption = 'MÃE, me deposita R$ 200 agora, urgente!'
  const ev = normalize(
    makeInbound({ message: { imageMessage: { url: 'x', caption } }, pushName: 'Filho' }),
    CTX,
  )
  assert(ev.message_type === 'image', 'imageMessage: message_type=image')
  assert(ev.text_length === caption.length, 'legenda entra em text_length')
  assert(ev.signals.pix_mention === true, 'legenda: pix_mention (deposita, R$)')
  assert(ev.signals.urgency_language === true, 'legenda: urgency_language (agora, urgente)')
  assert(ev.signals.impersonation_pattern === true, 'legenda: impersonation (MÃE)')
  const serialized = JSON.stringify(ev)
  assert(!serialized.includes(caption), 'legenda completa não aparece no evento')
  assert(!serialized.includes('deposita'), 'trecho da legenda não aparece')
}

// ---------------------------------------------------------------------------
// Bloco 5 — Link encurtador (encurtador clássico do golpe)
// ---------------------------------------------------------------------------
console.log('\n== link suspeito ==')
{
  const bait = 'Olha isso: https://bit.ly/xyz123'
  const ev = normalize(
    makeInbound({ message: { extendedTextMessage: { text: bait } }, pushName: 'X' }),
    CTX,
  )
  assert(ev.signals.link_suspicious === true, 'bit.ly acende link_suspicious')
  assert(!JSON.stringify(ev).includes('bit.ly'), 'URL não aparece no evento')
}

// ---------------------------------------------------------------------------
// Bloco 6 — Encaminhado
// ---------------------------------------------------------------------------
console.log('\n== forwarded ==')
{
  const ev = normalize(
    makeInbound({
      message: {
        extendedTextMessage: {
          text: 'texto qualquer',
          contextInfo: { isForwarded: true, forwardingScore: 3 },
        },
      },
      pushName: 'A',
    }),
    CTX,
  )
  assert(ev.signals.forwarded === true, 'contextInfo.isForwarded acende forwarded')
}
{
  const ev = normalize(
    makeInbound({
      message: {
        extendedTextMessage: {
          text: 'sem contexto',
          contextInfo: { forwardingScore: 5 },
        },
      },
      pushName: 'A',
    }),
    CTX,
  )
  assert(ev.signals.forwarded === true, 'forwardingScore>0 acende forwarded mesmo sem flag explícita')
}

// ---------------------------------------------------------------------------
// Bloco 7 — pushName vazio ativa unknown_sender
// ---------------------------------------------------------------------------
console.log('\n== unknown_sender ==')
{
  const evSem = normalize(
    makeInbound({ message: { conversation: 'oi' } }), // sem pushName
    CTX,
  )
  assert(evSem.signals.unknown_sender === true, 'sem pushName: unknown_sender=true')
  const evVazio = normalize(
    makeInbound({ message: { conversation: 'oi' }, pushName: '   ' }),
    CTX,
  )
  assert(evVazio.signals.unknown_sender === true, 'pushName só de espaço: unknown_sender=true')
  const evCom = normalize(
    makeInbound({ message: { conversation: 'oi' }, pushName: 'Maria' }),
    CTX,
  )
  assert(!evCom.signals.unknown_sender, 'com pushName real, unknown_sender fica falso')
}

// ---------------------------------------------------------------------------
// Bloco 8 — Outros tipos (sticker, video, document, other)
// ---------------------------------------------------------------------------
console.log('\n== outros tipos ==')
{
  const sticker = normalize(makeInbound({ message: { stickerMessage: { url: 'x' } } }), CTX)
  assert(sticker.message_type === 'sticker', 'sticker: message_type=sticker')
  assert(sticker.text_length === null, 'sticker: text_length=null')
}
{
  const video = normalize(makeInbound({ message: { videoMessage: { url: 'x', caption: 'ei, pix' } } }), CTX)
  assert(video.message_type === 'video', 'video: message_type=video')
  assert(video.signals.pix_mention === true, 'legenda de vídeo também gera sinal')
}
{
  const doc = normalize(makeInbound({ message: { documentMessage: { url: 'x' } } }), CTX)
  assert(doc.message_type === 'document', 'document: message_type=document')
}

// ---------------------------------------------------------------------------
// Bloco 9 — Sanity check final: nenhum evento carrega chaves proibidas
// ---------------------------------------------------------------------------
console.log('\n== sanity: MinimalEvent não expõe conteúdo bruto ==')
{
  const forbiddenKeys = ['conversation', 'text', 'content', 'body', 'message', 'caption', 'url', 'mediaKey', 'raw']
  const ev = normalize(
    makeInbound({ message: { conversation: 'oi vovó pix urgente R$ 500' } }),
    CTX,
  )
  const keys = Object.keys(ev)
  for (const k of forbiddenKeys) {
    assert(!keys.includes(k), `evento não tem a chave proibida "${k}"`)
  }
}

console.log(`\nresumo: ${passes} ok, ${failures} fail`)
if (failures > 0) process.exit(1)
console.log('\n✓ smoke test de normalize passou')
