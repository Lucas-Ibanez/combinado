// Smoke test do listener messages.upsert (T5.3) — sem pareamento vivo.
//
// Cobre exatamente o que o listener em connection.ts faz:
//   1. filterInbound(raw) — decide se cada WAMessage individual passa
//   2. dispatchInbound(payload, cb) — filtra o batch inteiro e chama cb
//      só para mensagens que passam E somente quando type='notify'
//
// A verificação end-to-end com WhatsApp real está agendada para amanhã
// (rate limit do WA precisa expirar). Veja apps/service/tests/README-T5.3.md.
import { filterInbound, dispatchInbound, type InboundMessage } from '../src/gateway/baileys/index.js'
import type { WAMessage } from '@whiskeysockets/baileys'

let failures = 0
let passes = 0

function assert(cond: unknown, msg: string): void {
  if (cond) {
    passes += 1
    console.log(`[ok]   ${msg}`)
  } else {
    failures += 1
    console.error(`[fail] ${msg}`)
  }
}

// Constrói WAMessage sintético — usamos só os campos que o filtro lê.
function makeMsg(overrides: {
  fromMe?: boolean
  remoteJid?: string | null
  id?: string | null
  message?: Record<string, unknown> | null | undefined
  messageTimestamp?: number | { toNumber(): number }
}): WAMessage {
  const key = {
    fromMe: overrides.fromMe ?? false,
    remoteJid: overrides.remoteJid === undefined ? '5511999999999@s.whatsapp.net' : overrides.remoteJid,
    id: overrides.id === undefined ? 'MSG_ABC' : overrides.id,
  } as unknown as WAMessage['key']
  return {
    key,
    message: overrides.message as WAMessage['message'],
    messageTimestamp: overrides.messageTimestamp as WAMessage['messageTimestamp'],
  } as WAMessage
}

// ---------- Bloco 1: filterInbound (função pura) ----------

console.log('\n== filterInbound ==')

// PASSA: mensagem de texto normal de terceiro
const okText = filterInbound(makeMsg({ message: { conversation: 'oi, teste' } }))
assert(okText !== null, 'texto normal de terceiro passa')
assert(okText?.remoteJid === '5511999999999@s.whatsapp.net', 'preserva remoteJid')
assert(okText?.messageId === 'MSG_ABC', 'preserva id')

// PASSA: mensagem de áudio
const okAudio = filterInbound(makeMsg({
  message: { audioMessage: { url: 'x', seconds: 5 } },
  messageTimestamp: 1723027200,
}))
assert(okAudio !== null, 'áudio de terceiro passa')
assert(okAudio?.timestamp === 1723027200, 'preserva timestamp numérico')

// PASSA: mensagem com extendedTextMessage (link, resposta, etc.)
const okExt = filterInbound(makeMsg({
  message: { extendedTextMessage: { text: 'clique aqui' } },
}))
assert(okExt !== null, 'extendedTextMessage passa')

// PASSA: timestamp em formato Long (toNumber)
const okLong = filterInbound(makeMsg({
  message: { conversation: 'com Long' },
  messageTimestamp: { toNumber: () => 1723027300 },
}))
assert(okLong?.timestamp === 1723027300, 'timestamp Long convertido com toNumber')

// PASSA: imagem, vídeo, documento — só checamos que passam
for (const kind of ['imageMessage', 'videoMessage', 'documentMessage', 'stickerMessage']) {
  const r = filterInbound(makeMsg({ message: { [kind]: { url: 'x' } } }))
  assert(r !== null, `${kind} passa`)
}

// DESCARTA: fromMe (o próprio protegido enviou)
assert(
  filterInbound(makeMsg({ fromMe: true, message: { conversation: 'saída' } })) === null,
  'fromMe é descartada',
)

// DESCARTA: status@broadcast (status do WhatsApp)
assert(
  filterInbound(makeMsg({
    remoteJid: 'status@broadcast',
    message: { conversation: 'status alheio' },
  })) === null,
  'status@broadcast é descartada',
)

// DESCARTA: qualquer @broadcast
assert(
  filterInbound(makeMsg({
    remoteJid: '99999@broadcast',
    message: { conversation: 'lista de transmissão' },
  })) === null,
  'lista de broadcast é descartada',
)

// DESCARTA: mensagens sem message (só key, ex.: receipt)
assert(filterInbound(makeMsg({ message: null })) === null, 'sem payload de mensagem é descartada')
assert(filterInbound(makeMsg({ message: undefined })) === null, 'message undefined é descartada')

// DESCARTA: só protocolMessage (revoke, ephemeral setting, etc.)
assert(
  filterInbound(makeMsg({
    message: { protocolMessage: { type: 0 } },
  })) === null,
  'só protocolMessage é descartada',
)

// DESCARTA: só senderKeyDistribution (setup de grupo)
assert(
  filterInbound(makeMsg({
    message: { senderKeyDistributionMessage: { groupId: 'g' } },
  })) === null,
  'só senderKeyDistribution é descartada',
)

// DESCARTA: só reactionMessage (emoji reagindo em outra msg)
assert(
  filterInbound(makeMsg({
    message: { reactionMessage: { text: '👍' } },
  })) === null,
  'só reactionMessage é descartada',
)

// DESCARTA: só messageContextInfo (metadata protocol-only)
assert(
  filterInbound(makeMsg({
    message: { messageContextInfo: { deviceListMetadata: {} } },
  })) === null,
  'só messageContextInfo é descartada',
)

// DESCARTA: payload vazio {}
assert(filterInbound(makeMsg({ message: {} })) === null, 'payload vazio é descartada')

// DESCARTA: key.remoteJid ausente
assert(
  filterInbound(makeMsg({ remoteJid: null, message: { conversation: 'órfã' } })) === null,
  'sem remoteJid é descartada',
)

// DESCARTA: key.id ausente
assert(
  filterInbound(makeMsg({ id: null, message: { conversation: 'sem id' } })) === null,
  'sem id é descartada',
)

// PASSA: protocolMessage MAS com conteúdo real junto (edge case defensivo)
// O código atual só descarta quando é a ÚNICA chave; se veio junto de conversation
// (não é o normal, mas defensivo), preferimos passar.
const mixed = filterInbound(makeMsg({
  message: { protocolMessage: { type: 0 }, conversation: 'olá' },
}))
assert(mixed !== null, 'protocolMessage misturada com texto real passa (edge case)')

// ---------- Bloco 2: dispatchInbound (integração do listener) ----------

console.log('\n== dispatchInbound ==')

function collect(): { fired: InboundMessage[]; cb: (m: InboundMessage) => void } {
  const fired: InboundMessage[] = []
  return { fired, cb: (m) => { fired.push(m) } }
}

// Type='notify' com uma msg boa e várias descartáveis
{
  const { fired, cb } = collect()
  dispatchInbound({
    type: 'notify',
    messages: [
      makeMsg({ id: 'A', message: { conversation: 'oi' } }),
      makeMsg({ id: 'B', fromMe: true, message: { conversation: 'saída' } }),
      makeMsg({ id: 'C', remoteJid: 'status@broadcast', message: { conversation: 'status' } }),
      makeMsg({ id: 'D', message: { protocolMessage: {} } }),
      makeMsg({ id: 'E', message: { audioMessage: {} } }),
    ],
  }, cb)
  assert(fired.length === 2, `batch com 5 msgs, 2 passam (foi ${fired.length})`)
  assert(fired[0]?.messageId === 'A', 'primeira msg que passou é A (texto)')
  assert(fired[1]?.messageId === 'E', 'segunda msg que passou é E (áudio)')
}

// Type != 'notify' — nada dispara (sync histórico, replace, etc.)
{
  const { fired, cb } = collect()
  dispatchInbound({
    type: 'append',
    messages: [makeMsg({ message: { conversation: 'da história' } })],
  }, cb)
  assert(fired.length === 0, "type='append' não dispara handler")
}
{
  const { fired, cb } = collect()
  dispatchInbound({
    type: 'prepend',
    messages: [makeMsg({ message: { conversation: 'histórico velho' } })],
  }, cb)
  assert(fired.length === 0, "type='prepend' não dispara handler")
}

// Sem callback definido — não explode
{
  dispatchInbound({
    type: 'notify',
    messages: [makeMsg({ message: { conversation: 'sem handler' } })],
  }, undefined)
  assert(true, 'sem callback: dispatchInbound não lança')
}

// Callback que lança — não interrompe o loop; erro chega no onCallbackError
{
  const errs: Error[] = []
  const boom: (m: InboundMessage) => void = () => {
    throw new Error('boom')
  }
  dispatchInbound(
    {
      type: 'notify',
      messages: [
        makeMsg({ id: 'X1', message: { conversation: 'primeira' } }),
        makeMsg({ id: 'X2', message: { conversation: 'segunda' } }),
      ],
    },
    boom,
    (err) => errs.push(err),
  )
  // O throw acontece dentro de Promise.resolve().catch, então o loop já
  // processou as duas. Damos um tick pra promises resolverem.
  setTimeout(() => {
    assert(errs.length === 2, `callback que lança é capturado pra cada msg (foram ${errs.length})`)
    printSummary()
  }, 10)
}

function printSummary() {
  console.log(`\nresumo: ${passes} ok, ${failures} fail`)
  if (failures > 0) process.exit(1)
  console.log('\n✓ smoke test de messages.upsert passou')
}
