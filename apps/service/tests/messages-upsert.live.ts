// Setup para retest LIVE de T5.3 — pareamento real e observação do handler
// disparando com mensagens de WhatsApp de verdade.
//
// Ver apps/service/tests/README-T5.3-live-retry.md para o procedimento.
//
// Fluxo:
//   1. Cria uma família + protegido de teste
//   2. Chama pair_device_tx → job em command_outbox
//   3. Serviço (rodando em outro terminal) consome o job, gera QR, grava no banco
//   4. Este script lê o QR do banco e imprime
//   5. Você escaneia; após "paired", envie mensagem de outro número
//   6. O log do SERVIÇO deve mostrar "mensagem inbound recebida" para cada uma
//   7. Ctrl+C encerra e limpa
import { randomUUID } from 'node:crypto'
import qrcode from 'qrcode-terminal'
import { db } from '../src/shared/db/index.js'

const GUARDIAN_ID = '05c10858-ed6f-49f9-a21f-97446591a100'
const POLL_MS = 2_000
const PAIR_TIMEOUT_MS = 5 * 60_000

function log(...args: unknown[]) {
  console.log(new Date().toISOString(), ...args)
}

async function main() {
  const familyId = randomUUID()
  const protectedPersonId = randomUUID()
  log('criando família e protegido de teste', { familyId, protectedPersonId })

  const { error: famErr } = await db
    .from('families').insert({ id: familyId, name: 'Família Teste T5.3 live' })
  if (famErr) throw new Error(`insert family: ${famErr.message}`)

  const { data: existingGuardian } = await db
    .from('guardians').select('id').eq('id', GUARDIAN_ID).maybeSingle()
  if (!existingGuardian) {
    const { error: gErr } = await db.from('guardians').insert({
      id: GUARDIAN_ID, family_id: familyId, display_name: 'Guardião Teste', is_primary: true,
    })
    if (gErr) throw new Error(`insert guardian: ${gErr.message}`)
  } else {
    await db.from('guardians').update({ family_id: familyId }).eq('id', GUARDIAN_ID)
  }

  const { error: ppErr } = await db.from('protected_persons').insert({
    id: protectedPersonId, family_id: familyId, display_name: 'Idoso T5.3 live',
    baileys_status: 'unpaired',
  })
  if (ppErr) throw new Error(`insert protected_person: ${ppErr.message}`)

  const cleanup = async () => {
    log('limpando dados de teste…')
    await db.from('protected_persons').delete().eq('id', protectedPersonId)
    await db.from('families').delete().eq('id', familyId)
  }
  process.on('SIGINT', () => { cleanup().finally(() => process.exit(0)) })
  process.on('SIGTERM', () => { cleanup().finally(() => process.exit(0)) })

  try {
    log('chamando pair_device_tx…')
    const { data: rpcRet, error: rpcErr } = await db.rpc('pair_device_tx', {
      p_family_id: familyId,
      p_guardian_id: GUARDIAN_ID,
      p_protected_person_id: protectedPersonId,
    })
    if (rpcErr) throw new Error(`pair_device_tx: ${rpcErr.message}`)
    log('pair_device_tx retornou:', rpcRet)

    log('aguardando QR…')
    let qrPrinted = false
    const started = Date.now()

    while (Date.now() - started < PAIR_TIMEOUT_MS) {
      const { data, error } = await db
        .from('protected_persons')
        .select('baileys_status, baileys_pairing_qr')
        .eq('id', protectedPersonId)
        .single()
      if (error) throw new Error(`poll: ${error.message}`)

      if (data.baileys_pairing_qr && !qrPrinted) {
        log('QR gravado. Escaneie no WhatsApp de teste:')
        qrcode.generate(data.baileys_pairing_qr, { small: true })
        qrPrinted = true
      }

      if (data.baileys_status === 'paired') {
        log('SUCESSO — pareado.')
        log('AGORA: mande uma mensagem de outro número para o número pareado.')
        log('O log do SERVIÇO deve mostrar "mensagem inbound recebida".')
        log('Ctrl+C aqui encerra e limpa o protegido de teste.')
        return
      }

      if (data.baileys_status === 'disconnected') {
        throw new Error('protegido ficou disconnected antes de parear')
      }

      await new Promise((r) => setTimeout(r, POLL_MS))
    }

    throw new Error('timeout aguardando pareamento')
  } catch (err) {
    await cleanup()
    throw err
  }
}

main().catch((err) => {
  console.error('setup falhou:', err)
  process.exit(1)
})
