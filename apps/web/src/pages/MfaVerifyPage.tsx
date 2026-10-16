import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import EmotionalModeFrame from '@/components/common/EmotionalModeFrame'
import { CircleAlert } from 'lucide-react'
import { SystemStateNotice } from '@/components/common/SystemStatus'

export default function MfaVerifyPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totp = factors?.totp?.[0]
      if (!totp) {
        setError('Nenhum autenticador configurado. Algo deu errado.')
        return
      }

      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: totp.id })
      if (challengeError) {
        setError('Erro ao iniciar verificação. Tente novamente.')
        return
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totp.id,
        challengeId: challenge.id,
        code,
      })
      if (verifyError) {
        setError('Código incorreto. Verifique o app autenticador e tente novamente.')
        setCode('')
        return
      }

      queryClient.removeQueries({ queryKey: ['session'] })
      queryClient.removeQueries({ queryKey: ['auth-state'] })
      navigate('/', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    queryClient.removeQueries({ queryKey: ['session'] })
    queryClient.removeQueries({ queryKey: ['auth-state'] })
    navigate('/login', { replace: true })
  }

  return (
    <EmotionalModeFrame mode="normal" className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="bg-surface rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-brand text-center mb-1">
          Verificação em duas etapas
        </h1>
        <p className="text-text-muted text-center text-sm mb-6">
          Digite o código do seu app autenticador para continuar.
        </p>

        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <div>
            <label htmlFor="totp-code" className="block text-sm font-medium text-text mb-1">
              Código de 6 dígitos
            </label>
            <input
              id="totp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text text-center tracking-widest placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              placeholder="000000"
            />
          </div>

          {error && (
            <SystemStateNotice
              icon={CircleAlert}
              title="Código não confirmado"
              description={error}
              tone="attention"
              live="assertive"
            />
          )}

          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full bg-brand text-brand-foreground font-medium py-2.5 rounded-lg hover:bg-brand-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verificando...' : 'Verificar'}
          </button>
        </form>

        <button
          type="button"
          onClick={handleSignOut}
          className="w-full text-sm text-text-muted hover:underline mt-4 text-center"
        >
          Sair e usar outra conta
        </button>

        <p className="text-xs text-text-muted text-center mt-6">
          Se perder o acesso ao autenticador, entre em contato com o suporte para recuperar sua conta.
        </p>
      </div>
    </EmotionalModeFrame>
  )
}
