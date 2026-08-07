import fs from 'node:fs/promises'
import qrcode from 'qrcode-terminal'
import { db } from '../../shared/db/index.js'
import type { Logger } from '../../shared/logging/index.js'
import {
  startBaileysConnection,
  keysDirFor,
  type BaileysHandle,
  type InboundMessage,
  type SessionHealth,
} from '../baileys/index.js'
import { normalize } from '../normalize/index.js'
import { queue } from '../../shared/queue/index.js'

interface Session {
  handle: BaileysHandle
  familyId: string
}

// PairingManager: uma instância Baileys por protected_person em memória.
// Roteia callbacks para o banco (baileys_status / baileys_pairing_qr) e
// mantém as sessões vivas durante o processo.
export class PairingManager {
  private sessions = new Map<string, Session>()

  constructor(private log: Logger) {}

  // Sobe o Baileys para um protegido. Novo pareamento (sem creds) mostra QR;
  // sessão já pareada (com creds) reconecta em silêncio.
  async open(protectedPersonId: string): Promise<void> {
    if (this.sessions.has(protectedPersonId)) {
      this.log.info('sessão já aberta para o protegido', {
        protected_person_id: protectedPersonId,
      })
      return
    }

    // Cacheia o family_id agora (o normalizer precisa dele por mensagem).
    const { data: ppRow, error: ppErr } = await db
      .from('protected_persons')
      .select('family_id')
      .eq('id', protectedPersonId)
      .single()
    if (ppErr || !ppRow) {
      this.log.error('protegido não encontrado — abortando open', {
        protected_person_id: protectedPersonId,
        error_name: ppErr?.name ?? 'not_found',
      })
      return
    }
    const familyId = ppRow.family_id

    const personLog = this.log.child({ protected_person_id: protectedPersonId })

    // Fallback de pareamento por código de 8 dígitos quando o WhatsApp
    // recusa QR (setando o env DEV_PAIRING_PHONE em E.164 sem +).
    const pairingPhoneNumber = process.env.DEV_PAIRING_PHONE

    const handle = await startBaileysConnection(
      protectedPersonId,
      personLog,
      {
      onQr: async (qr) => {
        personLog.info('QR de pareamento gerado')
        // Em dev, imprimir no terminal ajuda a validar rápido; em produção,
        // esse QR viaja só pelo banco até o app do guardião.
        qrcode.generate(qr, { small: true })

        const { error } = await db
          .from('protected_persons')
          .update({ baileys_pairing_qr: qr, baileys_status: 'pairing' })
          .eq('id', protectedPersonId)
        if (error) {
          personLog.error('falha ao gravar QR no banco', { error_name: error.name })
        }
      },
      onPairingCode: (code) => {
        // Formata para leitura humana: 8 dígitos, com hífen no meio.
        const formatted = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code
        // eslint-disable-next-line no-console
        console.log(`\n>>> CÓDIGO DE PAREAMENTO: ${formatted}\n>>> Vincule pelo WhatsApp: Dispositivos conectados → Conectar → Vincular com número → digite ${formatted}\n`)
      },
      onOpen: async () => {
        personLog.info('pareamento concluído — marcando paired')
        const { error } = await db
          .from('protected_persons')
          .update({ baileys_status: 'paired', baileys_pairing_qr: null })
          .eq('id', protectedPersonId)
        if (error) {
          personLog.error('falha ao marcar paired no banco', { error_name: error.name })
        }
      },
      onLoggedOut: async () => {
        personLog.warn('protegido foi deslogado do WhatsApp')
        await db
          .from('protected_persons')
          .update({ baileys_status: 'disconnected', baileys_pairing_qr: null })
          .eq('id', protectedPersonId)
        // Limpa keys locais para forçar novo QR se o guardião pedir pareamento
        // de novo.
        await fs.rm(keysDirFor(protectedPersonId), { recursive: true, force: true }).catch(() => {})
        this.sessions.delete(protectedPersonId)
      },
      onMessage: (msg) => this.handleInboundMessage({ protectedPersonId, familyId }, msg, personLog),
      onDisconnected: async () => {
        personLog.warn('sessão desconectada — atualizando health no banco')
        await db
          .from('protected_persons')
          .update({ baileys_status: 'disconnected' })
          .eq('id', protectedPersonId)
      },
      onReconnecting: async (attempt, delayMs) => {
        personLog.info('tentando reconectar', { attempt, delay_ms: delayMs })
        await db
          .from('protected_persons')
          .update({ baileys_status: 'reconnecting' })
          .eq('id', protectedPersonId)
      },
      },
      pairingPhoneNumber ? { pairingPhoneNumber } : {},
    )

    this.sessions.set(protectedPersonId, { handle, familyId })
  }

  // Restaura no boot as sessões que já estavam pareadas — reabre o socket
  // com as creds em disco (sem QR).
  async restorePaired(): Promise<void> {
    const { data, error } = await db
      .from('protected_persons')
      .select('id')
      .eq('baileys_status', 'paired')
    if (error) {
      this.log.error('falha ao listar protegidos pareados', { error_name: error.name })
      return
    }
    for (const row of data ?? []) {
      try {
        await this.open(row.id)
      } catch (err) {
        this.log.error('falha ao restaurar sessão', {
          protected_person_id: row.id,
          error_name: (err as Error).name,
        })
      }
    }
    this.log.info('restauração de sessões concluída', { count: (data ?? []).length })
  }

  // Handler de mensagem inbound — normaliza para o evento mínimo (T5.4) e
  // publica em risk_queue (T5.5). Fire-and-forget do ponto de vista do
  // Baileys: o Gateway captura e publica; a análise roda desacoplada.
  private async handleInboundMessage(
    ctx: { protectedPersonId: string; familyId: string },
    msg: InboundMessage,
    log: Logger,
  ): Promise<void> {
    const event = normalize(msg, {
      familyId: ctx.familyId,
      protectedPersonId: ctx.protectedPersonId,
    })
    try {
      const queueMsgId = await queue.enqueue('risk_queue', event)
      log.info('evento publicado em risk_queue', {
        protected_person_id: event.protected_person_id,
        family_id: event.family_id,
        wa_msg_id: event.event_id,
        remote_jid: event.sender_jid,
        wa_type: event.message_type,
        text_length: event.text_length,
        signals: event.signals,
        wa_timestamp: event.wa_timestamp,
        queue_msg_id: queueMsgId,
      })
    } catch (err) {
      // Falhar em publicar não pode derrubar o Gateway. Loga e segue —
      // a mensagem original ainda existe no WhatsApp; se for reprocessada
      // depois, event_id (wa msg id) garante idempotência downstream.
      log.error('falha ao publicar em risk_queue', {
        protected_person_id: event.protected_person_id,
        wa_msg_id: event.event_id,
        error_name: (err as Error).name,
      })
    }
  }

  getHealth(protectedPersonId: string): SessionHealth | null {
    const session = this.sessions.get(protectedPersonId)
    return session ? session.handle.health() : null
  }

  getAllHealth(): Record<string, SessionHealth> {
    const result: Record<string, SessionHealth> = {}
    for (const [id, session] of this.sessions) {
      result[id] = session.handle.health()
    }
    return result
  }

  async stopAll(): Promise<void> {
    const ids = Array.from(this.sessions.keys())
    for (const id of ids) {
      const session = this.sessions.get(id)
      if (session) await session.handle.stop()
    }
    this.sessions.clear()
  }
}
