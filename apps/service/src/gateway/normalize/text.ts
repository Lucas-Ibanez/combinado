import type { WAMessage } from '@whiskeysockets/baileys'

// Extrai o texto plano de um WAMessage — usado LOCALMENTE apenas para computar
// sinais. Nunca retornado no evento mínimo, nunca logado.
export function extractText(raw: WAMessage): string | null {
  const m = raw.message
  if (!m) return null
  if (typeof m.conversation === 'string' && m.conversation.trim()) {
    return m.conversation
  }
  const ext = m.extendedTextMessage?.text
  if (typeof ext === 'string' && ext.trim()) return ext
  // Legendas em imagens/vídeos também podem virar mensagem de golpe.
  const imgCaption = m.imageMessage?.caption
  if (typeof imgCaption === 'string' && imgCaption.trim()) return imgCaption
  const vidCaption = m.videoMessage?.caption
  if (typeof vidCaption === 'string' && vidCaption.trim()) return vidCaption
  const docCaption = m.documentMessage?.caption
  if (typeof docCaption === 'string' && docCaption.trim()) return docCaption
  return null
}

// Tipo do payload — decide como o Risk Worker processa depois.
export function detectMessageType(
  raw: WAMessage,
):
  | 'text'
  | 'audio'
  | 'image'
  | 'video'
  | 'document'
  | 'sticker'
  | 'other' {
  const m = raw.message
  if (!m) return 'other'
  if (m.conversation || m.extendedTextMessage) return 'text'
  if (m.audioMessage) return 'audio'
  if (m.imageMessage) return 'image'
  if (m.videoMessage) return 'video'
  if (m.documentMessage) return 'document'
  if (m.stickerMessage) return 'sticker'
  return 'other'
}

// Baileys sinaliza forward via contextInfo.isForwarded ou forwardingScore>0.
export function isForwarded(raw: WAMessage): boolean {
  const m = raw.message
  if (!m) return false
  const ctx = m.extendedTextMessage?.contextInfo ??
    m.imageMessage?.contextInfo ??
    m.videoMessage?.contextInfo ??
    m.audioMessage?.contextInfo ??
    m.documentMessage?.contextInfo
  if (!ctx) return false
  if (ctx.isForwarded) return true
  if (typeof ctx.forwardingScore === 'number' && ctx.forwardingScore > 0) return true
  return false
}
