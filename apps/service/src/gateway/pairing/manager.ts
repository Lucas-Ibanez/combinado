import fs from 'node:fs/promises'
import qrcode from 'qrcode-terminal'
import { db } from '../../shared/db/index.js'
import type { Logger } from '../../shared/logging/index.js'
import {
  startBaileysConnection,
  keysDirFor,
  type BaileysHandle,
  type InboundMessage,
} from '../baileys/index.js'

// PairingManager: uma instância Baileys por protected_person em memória.
// Roteia callbacks para o banco (baileys_status / baileys_pairing_qr) e
// mantém as sessões vivas durante o processo.
export class PairingManager {
  private sessions = new Map<string, BaileysHandle>()

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
      onMessage: (msg) => this.handleInboundMessage(protectedPersonId, msg, personLog),
      },
      pairingPhoneNumber ? { pairingPhoneNumber } : {},
    )

    this.sessions.set(protectedPersonId, handle)
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

  // Handler de mensagem inbound — só loga metadados seguros (sem conteúdo).
  // A normalização em "evento mínimo" e publicação em risk_queue vêm em T5.4.
  private handleInboundMessage(
    protectedPersonId: string,
    msg: InboundMessage,
    log: Logger,
  ): void {
    log.info('mensagem inbound recebida', {
      protected_person_id: protectedPersonId,
      wa_msg_id: msg.messageId,
      remote_jid: msg.remoteJid,
      timestamp: msg.timestamp,
      payload_types: keysOf((msg.raw.message ?? {}) as Record<string, unknown>),
    })
  }

  async stopAll(): Promise<void> {
    const ids = Array.from(this.sessions.keys())
    for (const id of ids) {
      const handle = this.sessions.get(id)
      if (handle) await handle.stop()
    }
    this.sessions.clear()
  }
}

function keysOf(o: Record<string, unknown>): string[] {
  return Object.keys(o).filter((k) => o[k] != null)
}
