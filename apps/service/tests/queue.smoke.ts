// Smoke test da interface Queue.
// Enfileira uma mensagem, consome, faz ack — tudo via a interface,
// sem chamar PGMQ diretamente. Rode com: pnpm --filter @combinado/service exec tsx tests/queue.smoke.ts
import { queue } from '../src/shared/queue/index.js'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`[fail] ${msg}`)
    process.exit(1)
  }
  console.log(`[ok]   ${msg}`)
}

async function main() {
  const marker = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const payload = { type: 'smoke_test', marker, ts: new Date().toISOString() }

  // 1. enqueue → devolve msgId numérico
  const msgId = await queue.enqueue('command_outbox', payload)
  assert(typeof msgId === 'number' && msgId > 0, `enqueue devolveu msgId=${msgId}`)

  // 2. consume — pode vir junto com outras mensagens (esperado); achamos a nossa
  //    pelo marker. Fazemos ack de todas as que consumirmos aqui pra deixar
  //    a fila limpa (a nossa incluída), então usamos visibility curta pro caso
  //    de re-teste rápido.
  const messages = await queue.consume<typeof payload>('command_outbox', {
    visibilitySeconds: 10,
    batchSize: 10,
  })
  assert(messages.length > 0, `consume devolveu ${messages.length} mensagem(ns)`)

  const ours = messages.find((m) => m.body?.marker === marker)
  assert(ours !== undefined, 'a mensagem enfileirada foi consumida via a interface')
  assert(ours!.msgId === msgId, `msgId consumido (${ours!.msgId}) == enfileirado (${msgId})`)
  assert(ours!.body.type === 'smoke_test', 'corpo preservou o campo type')
  assert(ours!.readCount >= 1, `readCount>=1 (foi ${ours!.readCount})`)

  // 3. ack — remove permanentemente
  for (const m of messages) {
    await queue.ack('command_outbox', m.msgId)
  }
  console.log(`[ok]   ${messages.length} mensagem(ns) marcada(s) como processada(s)`)

  // 4. próximo consume não deve trazer a nossa de volta
  const after = await queue.consume<typeof payload>('command_outbox', {
    visibilitySeconds: 5,
    batchSize: 10,
  })
  const stillThere = after.find((m) => m.body?.marker === marker)
  assert(stillThere === undefined, 'após ack, a mensagem não reaparece no consume')
  // limpa qualquer resto que apareceu depois (não é da gente)
  for (const m of after) {
    await queue.ack('command_outbox', m.msgId)
  }

  console.log('\n✓ smoke test da interface Queue passou')
}

main().catch((err) => {
  console.error('smoke test falhou:', err)
  process.exit(1)
})
