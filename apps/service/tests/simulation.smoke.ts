import { buildSimulationMessage, evaluateResponse } from '../src/simulation/messages.js'

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.error(`  ✗ ${label}`)
  }
}

console.log('=== Simulation Messages ===')

// buildSimulationMessage tests
const msg = buildSimulationMessage('Maria')
assert(msg.includes('Maria'), 'inclui nome do protegido')
assert(msg.includes('SIMULAÇÃO COMBINADO'), 'contém aviso de simulação')
assert(msg.includes('Pix') || msg.includes('transferência') || msg.includes('boleto'), 'contém cenário de golpe')

// Multiple calls produce valid messages (random template)
for (let i = 0; i < 10; i++) {
  const m = buildSimulationMessage('João')
  assert(m.includes('SIMULAÇÃO COMBINADO'), `template ${i + 1} tem aviso`)
}

console.log('\n=== Response Evaluation ===')

// Positive responses (should be correct)
assert(evaluateResponse('Qual é a senha combinada?') === true, 'pede senha combinada → correto')
assert(evaluateResponse('me diz a senha antes') === true, 'pede senha → correto')
assert(evaluateResponse('qual a senha?') === true, 'qual a senha → correto')
assert(evaluateResponse('fala a senha') === true, 'fala a senha → correto')
assert(evaluateResponse('não vou transferir sem confirmar') === true, 'recusa transferir → correto')
assert(evaluateResponse('vou ligar pra confirmar') === true, 'vai ligar → correto')
assert(evaluateResponse('Qual o código de segurança?') === true, 'código segurança → correto')
assert(evaluateResponse('SENHA por favor') === true, 'case insensitive → correto')
assert(evaluateResponse('qual é a palavra combinada?') === true, 'palavra combinada → correto')

// Negative responses (should be incorrect)
assert(evaluateResponse('ok vou mandar agora') === false, 'aceita imediatamente → incorreto')
assert(evaluateResponse('tá bom, mando já') === false, 'concorda → incorreto')
assert(evaluateResponse('quanto precisa?') === false, 'pergunta valor → incorreto')
assert(evaluateResponse('manda o pix') === false, 'oferece pix → incorreto')
assert(evaluateResponse('') === false, 'vazio → incorreto')

// Edge cases
assert(evaluateResponse('   SENHA   ') === true, 'com espaços → correto')
assert(evaluateResponse('não vou fazer') === true, 'recusa → correto')

console.log(`\n--- Resultado: ${passed} passaram, ${failed} falharam ---`)
if (failed > 0) process.exit(1)
