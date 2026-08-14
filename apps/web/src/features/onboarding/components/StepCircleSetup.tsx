import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useSetupFamily } from '../hooks/useSetupFamily'

interface Props {
  onComplete: (result: { protectedPersonId: string; protectedName: string }) => void
}

const CODE_WORD_TIPS = [
  'Use uma palavra que só vocês conhecem (ex.: nome de um bicho de estimação antigo, apelido de infância)',
  'Evite datas de aniversário, nomes de familiares conhecidos ou informações públicas',
  'A senha é fixa — não muda. Simplicidade é mais importante que complexidade',
  'Pratique com seu familiar: "Se alguém pedir dinheiro, peça a senha antes"',
]

export default function StepCircleSetup({ onComplete }: Props) {
  const [familyName, setFamilyName] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [protectedName, setProtectedName] = useState('')
  const [protectedPhone, setProtectedPhone] = useState('')
  const [codeWord, setCodeWord] = useState('')
  const [codeHint, setCodeHint] = useState('')

  const setupFamily = useSetupFamily()

  const isValid =
    familyName.trim() &&
    guardianName.trim() &&
    guardianPhone.trim() &&
    protectedName.trim() &&
    protectedPhone.trim() &&
    codeWord.trim()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return

    setupFamily.mutate(
      {
        family_name: familyName.trim(),
        guardian_name: guardianName.trim(),
        guardian_phone: guardianPhone.trim(),
        protected_name: protectedName.trim(),
        protected_phone: protectedPhone.trim(),
        code_word: codeWord.trim(),
        code_hint: codeHint.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          onComplete({ protectedPersonId: data.protected_person_id, protectedName: protectedName.trim() })
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-2">
        <div className="w-14 h-14 rounded-full bg-brand-surface flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">👨‍👩‍👧</span>
        </div>
        <h2 className="text-xl font-bold text-text">Criar seu Círculo</h2>
        <p className="text-sm text-text-muted mt-1">
          Configure sua família e a pessoa que você quer proteger
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sua Família</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm font-medium text-text mb-1 block" htmlFor="familyName">
              Nome da família
            </label>
            <Input
              id="familyName"
              placeholder="Ex.: Família Silva"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Seus dados (guardião)</CardTitle>
          <CardDescription>Você receberá os alertas de proteção</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm font-medium text-text mb-1 block" htmlFor="guardianName">
              Seu nome
            </label>
            <Input
              id="guardianName"
              placeholder="Seu nome completo"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text mb-1 block" htmlFor="guardianPhone">
              Seu telefone (com DDD)
            </label>
            <Input
              id="guardianPhone"
              type="tel"
              placeholder="+55 11 99999-0000"
              value={guardianPhone}
              onChange={(e) => setGuardianPhone(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pessoa protegida</CardTitle>
          <CardDescription>A pessoa cujo WhatsApp será monitorado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm font-medium text-text mb-1 block" htmlFor="protectedName">
              Nome
            </label>
            <Input
              id="protectedName"
              placeholder="Nome do familiar"
              value={protectedName}
              onChange={(e) => setProtectedName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text mb-1 block" htmlFor="protectedPhone">
              Telefone (com DDD)
            </label>
            <Input
              id="protectedPhone"
              type="tel"
              placeholder="+55 11 98888-0000"
              value={protectedPhone}
              onChange={(e) => setProtectedPhone(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Senha Combinada</CardTitle>
          <CardDescription>
            A palavra-código que só vocês dois conhecem
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm font-medium text-text mb-1 block" htmlFor="codeWord">
              Senha combinada
            </label>
            <Input
              id="codeWord"
              placeholder="Ex.: Pipoca"
              value={codeWord}
              onChange={(e) => setCodeWord(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text mb-1 block" htmlFor="codeHint">
              Dica (opcional)
            </label>
            <Input
              id="codeHint"
              placeholder="Ex.: O que comemos no cinema"
              value={codeHint}
              onChange={(e) => setCodeHint(e.target.value)}
            />
          </div>
          <div className="bg-brand-surface rounded-lg p-3 mt-2">
            <p className="text-sm font-medium text-brand mb-2">Dicas para uma boa senha:</p>
            <ul className="space-y-1.5">
              {CODE_WORD_TIPS.map((tip) => (
                <li key={tip} className="text-xs text-text-muted flex gap-2">
                  <span className="text-brand mt-0.5 shrink-0">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {setupFamily.error && (
        <p className="text-sm text-danger text-center">
          {setupFamily.error.message}
        </p>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={!isValid || setupFamily.isPending}
      >
        {setupFamily.isPending ? 'Criando...' : 'Criar Círculo'}
      </Button>
    </form>
  )
}
