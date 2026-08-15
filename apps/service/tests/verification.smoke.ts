import { assessText } from '../src/verification/assess.js'

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

console.log('=== Verificação: cenários de golpe clássico (dangerous) ===')

const scam1 = assessText(
  'Mãe, preciso de um Pix urgente de R$ 500, meu celular quebrou e estou usando o número de um amigo'
)
assert(scam1.risk_level === 'dangerous', 'impersonation + pix + urgency + device → dangerous')
assert(scam1.signals.pix_mention === true, 'pix_mention detectado')
assert(scam1.signals.urgency_language === true, 'urgency_language detectado')
assert(scam1.signals.impersonation_pattern === true, 'impersonation_pattern detectado')
assert(scam1.signals.device_excuse === true, 'device_excuse detectado')
assert(scam1.advice.includes('ALTO RISCO'), 'advice contém ALTO RISCO')
assert(scam1.advice.includes('senha combinada'), 'advice orienta pedir senha')

const scam2 = assessText(
  'Pai, faz um Pix agora pra mim, é urgente, depois te explico'
)
assert(scam2.risk_level === 'dangerous', 'pai + pix + urgente → dangerous')

const scam3 = assessText(
  'Filha, preciso de uma transferência urgente, não conte pra ninguém'
)
assert(scam3.risk_level === 'dangerous', 'filha + transferência + sigilo → dangerous')

console.log('\n=== Verificação: cenários suspeitos (suspicious) ===')

const sus1 = assessText(
  'Mãe, preciso falar com você urgente, me liga por favor'
)
assert(sus1.risk_level === 'suspicious', 'impersonation + urgência sem pix → suspicious')
assert(sus1.advice.includes('peça a senha combinada mesmo assim'), 'honesty rule no suspeito')

const sus2 = assessText(
  'Troquei de número, salva esse aqui. Depois te mando o novo.'
)
// device_excuse alone may not trigger a rule, let's check
const sus2Level = sus2.risk_level
assert(
  sus2Level === 'suspicious' || sus2Level === 'safe',
  `device excuse sozinho → ${sus2Level} (não é dangerous)`
)

console.log('\n=== Verificação: mensagem segura (safe) ===')

const safe1 = assessText('Oi, tudo bem? Que horas você chega hoje?')
assert(safe1.risk_level === 'safe', 'mensagem comum → safe')
assert(safe1.advice.includes('peça a senha combinada mesmo assim'), 'honesty rule na mensagem segura')
assert(safe1.advice.includes('nenhuma ferramenta é infalível'), 'disclaimer de falibilidade')

const safe2 = assessText('Bom dia! O almoço está pronto, venha quando quiser.')
assert(safe2.risk_level === 'safe', 'outra mensagem comum → safe')
assert(Object.values(safe2.signals).filter(Boolean).length === 0, 'nenhum sinal ativo')

console.log('\n=== Verificação: honesty rule (nunca dar falsa segurança) ===')

const ambiguous = assessText(
  'Oi vó, troquei de número. Me adiciona nesse aqui.'
)
assert(
  ambiguous.advice.includes('senha combinada'),
  'caso ambíguo sempre orienta pedir senha'
)

const withLink = assessText(
  'Olha essa promoção urgente: bit.ly/promo123'
)
assert(withLink.risk_level === 'suspicious', 'link suspeito + urgência → suspicious')
assert(withLink.signals.link_suspicious === true, 'link_suspicious detectado')

console.log('\n=== Verificação: resultado completo tem todos os campos ===')

const full = assessText('Pai, faz um Pix de R$ 1000 agora, é emergência, não fala pra sua mãe')
assert(full.risk_level === 'dangerous', 'nível correto')
assert(typeof full.severity === 'string', 'severity presente')
assert(typeof full.decision === 'string', 'decision presente')
assert(typeof full.classifier_score === 'number', 'classifier_score presente')
assert(full.classifier_score > 0, 'classifier_score positivo')
assert(Array.isArray(full.triggered_rules), 'triggered_rules é array')
assert(full.triggered_rules.length > 0, 'regras disparadas')
assert(typeof full.advice === 'string', 'advice presente')
assert(full.advice.length > 0, 'advice não vazio')

console.log(`\n--- Resultado: ${passed} passaram, ${failed} falharam ---`)
if (failed > 0) process.exit(1)
