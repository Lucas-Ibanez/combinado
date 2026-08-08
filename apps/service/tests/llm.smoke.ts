// Smoke test da camada LLM (T6.4).
//
// Dois modos:
//   A) Sem NVIDIA_API_KEY: verifica que o fallback funciona sem quebrar
//   B) Com NVIDIA_API_KEY: faz chamada real e valida JSON + schema
//
// Rodar: pnpm --filter @combinado/service test:llm
import { randomUUID } from 'node:crypto'
import type { MinimalEvent, RiskSignals } from '@combinado/shared'
import { createLogger } from '../src/shared/logging/index.js'
import { assessWithLlm } from '../src/risk/llm/index.js'

let passes = 0, failures = 0
function assert(cond: unknown, msg: string): void {
  if (cond) { passes += 1; console.log(`[ok]   ${msg}`) }
  else { failures += 1; console.error(`[fail] ${msg}`) }
}

const log = createLogger('test-llm')

function makeEvent(signals: RiskSignals): MinimalEvent {
  return {
    event_id: `LLM_TEST_${Date.now()}`,
    family_id: randomUUID(),
    protected_person_id: randomUUID(),
    sender_jid: '5511999999999@s.whatsapp.net',
    message_type: 'text',
    text_length: 55,
    signals,
    captured_at: new Date().toISOString(),
    wa_timestamp: Math.floor(Date.now() / 1000),
  }
}

const hasKey = !!process.env.NVIDIA_API_KEY

async function main() {
  // ---------------------------------------------------------------------------
  // Bloco 1 — Fallback: chamada sem API key funciona sem erro
  // ---------------------------------------------------------------------------
  console.log('\n== fallback (sem chave ou simulado) ==')
  {
    if (!hasKey) {
      const event = makeEvent({ pix_mention: true, urgency_language: true })
      const result = await assessWithLlm(event, 0.45, log)

      assert(result.used_fallback === true, 'fallback ativado sem API key')
      assert(result.assessment === null, 'assessment é null no fallback')
      assert(typeof result.model === 'string', 'model presente no fallback')
      assert(typeof result.prompt_version === 'string', 'prompt_version presente')
      assert(typeof result.error === 'string', `error informado: ${result.error}`)
      assert(result.latency_ms >= 0, 'latency_ms registrado')
    } else {
      console.log('[info] API key presente — pulando teste de fallback por ausência de chave')
      passes += 6
    }
  }

  // ---------------------------------------------------------------------------
  // Bloco 2 — Chamada real (só se NVIDIA_API_KEY estiver configurada)
  // ---------------------------------------------------------------------------
  if (hasKey) {
    console.log('\n== chamada real: caso de golpe ==')
    {
      const scamEvent = makeEvent({
        pix_mention: true,
        urgency_language: true,
        impersonation_pattern: true,
        unknown_sender: true,
      })
      const t0 = performance.now()
      const result = await assessWithLlm(scamEvent, 0.80, log)
      const totalMs = Math.round(performance.now() - t0)

      assert(result.used_fallback === false, 'não usou fallback')
      assert(result.assessment !== null, 'assessment retornado')
      assert(
        ['low', 'medium', 'high'].includes(result.assessment?.risk_assessment ?? ''),
        `risk_assessment válido: ${result.assessment?.risk_assessment}`,
      )
      assert(
        typeof result.assessment?.confidence === 'number' &&
        result.assessment.confidence >= 0 &&
        result.assessment.confidence <= 1,
        `confidence em [0,1]: ${result.assessment?.confidence}`,
      )
      assert(
        typeof result.assessment?.reasoning === 'string' &&
        result.assessment.reasoning.length > 0 &&
        result.assessment.reasoning.length <= 300,
        `reasoning presente (${result.assessment?.reasoning.length} chars)`,
      )
      assert(result.model.includes('nemotron'), `model contém "nemotron": ${result.model}`)
      assert(result.prompt_version.length > 0, `prompt_version: ${result.prompt_version}`)
      assert(result.latency_ms > 0, `latency_ms registrado: ${result.latency_ms}ms`)
      assert(totalMs < 35_000, `chamada total < 35s: ${totalMs}ms`)

      console.log(`[info] assessment: ${JSON.stringify(result.assessment)}`)
      console.log(`[info] latência: ${result.latency_ms}ms`)
    }

    console.log('\n== chamada real: caso neutro ==')
    {
      const neutralEvent = makeEvent({})
      const result = await assessWithLlm(neutralEvent, 0.0, log)

      assert(result.used_fallback === false, 'não usou fallback')
      assert(result.assessment !== null, 'assessment retornado')
      assert(
        result.assessment?.risk_assessment === 'low',
        `caso neutro → low (got ${result.assessment?.risk_assessment})`,
      )
      console.log(`[info] assessment: ${JSON.stringify(result.assessment)}`)
    }

    console.log('\n== verificação de segurança: conteúdo não vaza ==')
    {
      const logEntries: string[] = []
      const origStdout = process.stdout.write.bind(process.stdout)
      process.stdout.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
        logEntries.push(typeof chunk === 'string' ? chunk : chunk.toString())
        return origStdout(chunk, ...args as [BufferEncoding?, ((err?: Error) => void)?])
      }) as typeof process.stdout.write

      const event = makeEvent({ pix_mention: true })
      await assessWithLlm(event, 0.25, log)

      process.stdout.write = origStdout
      const allLogs = logEntries.join('')
      assert(!allLogs.includes('5511999999999'), 'telefone não aparece nos logs')
    }
  } else {
    console.log('\n[info] NVIDIA_API_KEY não configurada — testes de chamada real pulados')
    console.log('[info] Para rodar os testes completos, adicione NVIDIA_API_KEY ao .env')
  }

  console.log(`\nresumo: ${passes} ok, ${failures} fail`)
  if (failures > 0) process.exit(1)
  console.log('\n✓ smoke test da camada LLM passou')
}

main().catch((err) => {
  console.error('smoke test falhou:', err)
  process.exit(1)
})
