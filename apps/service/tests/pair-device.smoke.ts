// Smoke test do fluxo de pareamento acionado por job (T5.2).
//
// Ciclo:
//   1. Cria uma família + protegido de teste
//   2. Chama pair_device_tx (imita a Command API) — enfileira job em command_outbox
//   3. O serviço (que precisa estar rodando em paralelo, com `pnpm start`)
//      consome o job, abre Baileys, e grava o QR em protected_persons
//   4. Este teste imprime o QR pra você escanear
//   5. Aguarda o baileys_status virar 'paired' (com timeout)
//   6. Limpa: dropa protegido e família de teste
//
// Rodar em UM terminal:  pnpm --filter @combinado/service start
// Em OUTRO terminal:      pnpm --filter @combinado/service test:pair
import { randomUUID } from 'node:crypto'
import qrcode from 'qrcode-terminal'
import { db } from '../src/shared/db/index.js'

const TIMEOUT_MS = 5 * 60_000  // 5 min para você escanear
const POLL_MS = 2_000

// Guardian atual (usuário do próprio Lucas) — evita criar auth.user novo.
const GUARDIAN_ID = '05c10858-ed6f-49f9-a21f-97446591a100'

function log(...args: unknown[]) {
  console.log(new Date().toISOString(), ...args)
}

async function main() {
  // 1) Seed
  const familyId = randomUUID()
  const protectedPersonId = randomUUID()
  log('criando família e protegido de teste', { familyId, protectedPersonId })

  const { error: famErr } = await db
    .from('families')
    .insert({ id: familyId, name: 'Família Teste T5.2' })
  if (famErr) throw new Error(`insert family: ${famErr.message}`)

  // Garante que o guardian existe (idempotente se já criado por rodadas anteriores)
  const { data: existingGuardian } = await db
    .from('guardians').select('id').eq('id', GUARDIAN_ID).maybeSingle()
  if (!existingGuardian) {
    const { error: gErr } = await db.from('guardians').insert({
      id: GUARDIAN_ID, family_id: familyId, display_name: 'Guardião Teste', is_primary: true,
    })
    if (gErr) throw new Error(`insert guardian: ${gErr.message}`)
  } else {
    // Se já existe (rodada anterior), realoca a family_id do guardian
    await db.from('guardians').update({ family_id: familyId }).eq('id', GUARDIAN_ID)
  }

  const { error: ppErr } = await db.from('protected_persons').insert({
    id: protectedPersonId,
    family_id: familyId,
    display_name: 'Idoso Teste',
    baileys_status: 'unpaired',
  })
  if (ppErr) throw new Error(`insert protected_person: ${ppErr.message}`)

  try {
    // 2) Chama pair_device_tx (simula Command API)
    log('chamando pair_device_tx…')
    const { data: rpcRet, error: rpcErr } = await db.rpc('pair_device_tx', {
      p_family_id: familyId,
      p_guardian_id: GUARDIAN_ID,
      p_protected_person_id: protectedPersonId,
    })
    if (rpcErr) throw new Error(`pair_device_tx: ${rpcErr.message}`)
    log('pair_device_tx retornou:', rpcRet)

    // 3+4) Aguarda o serviço gravar o QR
    log('aguardando QR aparecer no banco (serviço precisa estar rodando)…')
    let qrPrinted = false
    const started = Date.now()
    let finalStatus = 'unknown'

    while (Date.now() - started < TIMEOUT_MS) {
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
        finalStatus = 'paired'
        log('SUCESSO — baileys_status = paired')
        break
      }

      if (data.baileys_status === 'disconnected') {
        finalStatus = 'disconnected'
        log('FALHOU — protegido ficou como disconnected')
        break
      }

      await sleep(POLL_MS)
    }

    if (finalStatus !== 'paired') {
      throw new Error(`Timeout ou status final inesperado: ${finalStatus}`)
    }

    console.log('\n✓ smoke test de pareamento passou')
  } finally {
    // 6) Cleanup
    log('limpando dados de teste…')
    await db.from('protected_persons').delete().eq('id', protectedPersonId)
    await db.from('families').delete().eq('id', familyId)
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

main().catch((err) => {
  console.error('smoke test falhou:', err)
  process.exit(1)
})
