import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface Props {
  protectedName: string
  onComplete: () => void
  onSkip: () => void
}

const OFFICIAL_NUMBER = '+55 11 91732-1422'

export default function StepChannelCeremony({ protectedName, onComplete, onSkip }: Props) {
  const [saved, setSaved] = useState(false)
  const [tested, setTested] = useState(false)

  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <div className="w-14 h-14 rounded-full bg-brand-surface flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">📋</span>
        </div>
        <h2 className="text-xl font-bold text-text">Cerimônia do Canal</h2>
        <p className="text-sm text-text-muted mt-1">
          Prepare o celular de {protectedName || 'seu protegido'} para reconhecer o Combinado
        </p>
      </div>

      <Card className="border-attention-surface border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-attention-dark">Por que isso importa</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">
            Sem esta etapa, {protectedName || 'seu protegido'} pode confundir uma mensagem legítima do Combinado
            com um golpe. Salvar o número oficial e reconhecer a mensagem de teste
            é o que garante que o sistema funcione quando for necessário.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Passo 1: Salvar o número oficial</CardTitle>
          <CardDescription>
            No celular de {protectedName || 'seu protegido'}, salve este contato:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-brand-surface rounded-lg p-4 text-center">
            <p className="text-xs text-text-muted mb-1">Número do Combinado</p>
            <p className="text-lg font-bold text-brand">{OFFICIAL_NUMBER}</p>
            <p className="text-xs text-text-muted mt-1">Salve como "Combinado Proteção"</p>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
              className="w-5 h-5 rounded border-border text-brand accent-brand"
            />
            <span className="text-sm text-text">Número salvo no celular do protegido</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Passo 2: Ensinar o protegido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-text-muted">
            Explique ao protegido:
          </p>
          <ul className="space-y-2 text-sm text-text-muted">
            <li className="flex gap-2">
              <span className="text-brand shrink-0">•</span>
              "Se receber uma mensagem do Combinado, <strong>peça a senha combinada</strong> para quem está pedindo dinheiro"
            </li>
            <li className="flex gap-2">
              <span className="text-brand shrink-0">•</span>
              "O Combinado <strong>nunca</strong> pede senha, Pix ou código por mensagem"
            </li>
            <li className="flex gap-2">
              <span className="text-brand shrink-0">•</span>
              "Na dúvida, <strong>ligue</strong> para o familiar por outro meio"
            </li>
          </ul>
          <label className="flex items-center gap-3 cursor-pointer mt-2">
            <input
              type="checkbox"
              checked={tested}
              onChange={(e) => setTested(e.target.checked)}
              className="w-5 h-5 rounded border-border text-brand accent-brand"
            />
            <span className="text-sm text-text">Protegido orientado e ciente</span>
          </label>
        </CardContent>
      </Card>

      <Button
        className="w-full"
        onClick={onComplete}
        disabled={!saved || !tested}
      >
        Continuar
      </Button>

      <Button variant="ghost" className="w-full" onClick={onSkip}>
        Pular por agora
      </Button>
    </div>
  )
}
