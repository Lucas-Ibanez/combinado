import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAcceptInvite } from '@/features/guardians'
import { ShieldCheck, UserPlus, Loader2, AlertTriangle } from 'lucide-react'
import EmotionalModeFrame from '@/components/common/EmotionalModeFrame'

export default function AcceptInvitePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialCode = searchParams.get('code') ?? ''

  const [code, setCode] = useState(initialCode)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  const acceptMutation = useAcceptInvite()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || !name.trim()) return

    acceptMutation.mutate(
      {
        invite_code: code.trim(),
        display_name: name.trim(),
        phone: phone.trim() || undefined,
      },
      {
        onSuccess: () => {
          navigate('/', { replace: true })
        },
      },
    )
  }

  return (
    <EmotionalModeFrame mode="normal" className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-brand-surface flex items-center justify-center mx-auto">
            <UserPlus className="w-7 h-7 text-brand" />
          </div>
          <h1 className="text-xl font-bold text-text">Entrar como Guardião</h1>
          <p className="text-sm text-text-muted">
            Um familiar convidou você para ajudar na proteção de um ente querido.
            Insira o código de convite para participar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-text mb-1">
              Código de convite
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex: A3BK7M"
              maxLength={6}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-center text-2xl font-mono tracking-[0.3em] text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-brand"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-text mb-1">
              Seu nome
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Como quer ser chamado(a)"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-text mb-1">
              Telefone <span className="text-text-muted font-normal">(opcional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+5511999999999"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <p className="text-xs text-text-muted mt-1">
              Necessário para receber alertas via SMS e ligação.
            </p>
          </div>

          {acceptMutation.error && (
            <div className="rounded-xl bg-attention-surface border border-attention/20 px-4 py-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-attention-dark shrink-0 mt-0.5" />
              <p className="text-sm text-attention-dark">{acceptMutation.error.message}</p>
            </div>
          )}

          {acceptMutation.isSuccess && (
            <div className="rounded-xl bg-success/10 border border-success/20 px-4 py-3 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-success shrink-0 mt-0.5" />
              <p className="text-sm text-success">
                Convite aceito! Redirecionando...
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={!code.trim() || !name.trim() || acceptMutation.isPending}
            className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {acceptMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Aceitando convite...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Aceitar convite e entrar
              </>
            )}
          </button>
        </form>

        <p className="text-xs text-text-muted text-center">
          Ao aceitar, você poderá acompanhar incidentes e receber alertas de proteção como guardião secundário.
        </p>
      </div>
    </EmotionalModeFrame>
  )
}
