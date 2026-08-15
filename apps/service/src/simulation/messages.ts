const SIMULATION_TEMPLATES = [
  (name: string) => [
    `Oi ${name}! Tudo bem?`,
    '',
    'Estou precisando de uma ajuda urgente... Pode me fazer um Pix de R$ 500 agora? Depois te devolvo!',
    '',
    'Meu celular quebrou e estou usando o número de um amigo.',
    '',
    '⚠️ _[SIMULAÇÃO COMBINADO] Esta é uma mensagem de teste. Pratique pedir a senha combinada antes de transferir._',
  ].join('\n'),

  (name: string) => [
    `${name}, preciso de ajuda urgente!`,
    '',
    'Tive um problema sério e preciso que faça uma transferência pra mim agora. É urgente, depois te explico tudo.',
    '',
    '⚠️ _[SIMULAÇÃO COMBINADO] Esta é uma mensagem de teste. Lembre-se: peça a senha combinada._',
  ].join('\n'),

  (name: string) => [
    `Oi ${name}! Troquei de número, salva esse aqui.`,
    '',
    'Aproveitando, pode me ajudar com uma coisa? Preciso pagar um boleto urgente e meu app do banco não tá funcionando. Pode fazer um Pix pra mim?',
    '',
    '⚠️ _[SIMULAÇÃO COMBINADO] Mensagem de teste. Peça a senha antes de qualquer transferência._',
  ].join('\n'),
]

export function buildSimulationMessage(protectedName: string): string {
  const idx = Math.floor(Math.random() * SIMULATION_TEMPLATES.length)
  return SIMULATION_TEMPLATES[idx]!(protectedName)
}

const POSITIVE_KEYWORDS = [
  'senha',
  'combinado',
  'combinada',
  'palavra',
  'código',
  'codigo',
  'segurança',
  'seguranca',
  'qual a senha',
  'qual é a senha',
  'me diz a senha',
  'fala a senha',
  'não vou transferir',
  'nao vou transferir',
  'não vou fazer',
  'nao vou fazer',
  'vou ligar',
  'vou confirmar',
]

export function evaluateResponse(responseText: string): boolean {
  const normalized = responseText.toLowerCase().trim()
  return POSITIVE_KEYWORDS.some((kw) => normalized.includes(kw))
}
