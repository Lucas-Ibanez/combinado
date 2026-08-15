import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import EmotionalModeFrame from '@/components/common/EmotionalModeFrame'
import { CircleAlert } from 'lucide-react'
import { SystemStateNotice } from '@/components/common/SystemStatus'

type Mode = 'login' | 'signup'

function friendlyError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('invalid login credentials'))
    return 'E-mail ou senha incorretos.'
  if (lower.includes('email not confirmed'))
    return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.'
  if (lower.includes('user already registered'))
    return 'Esse e-mail já está cadastrado. Tente entrar.'
  if (lower.includes('password') && lower.includes('characters'))
    return 'A senha precisa ter pelo menos 8 caracteres, com letras maiúsculas, minúsculas e números.'
  if (lower.includes('rate limit') || lower.includes('too many requests'))
    return 'Muitas tentativas seguidas. Aguarde um momento e tente novamente.'
  if (lower.includes('network') || lower.includes('fetch'))
    return 'Problema de conexão. Verifique sua internet e tente novamente.'
  return 'Algo deu errado. Tente novamente em alguns instantes.'
}

export default function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })
        if (signUpError) {
          setError(friendlyError(signUpError.message))
          return
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) {
          setError(friendlyError(signInError.message))
          return
        }
      }
      queryClient.removeQueries({ queryKey: ['session'] })
      queryClient.removeQueries({ queryKey: ['auth-state'] })
      navigate('/', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <EmotionalModeFrame mode="normal" className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="bg-surface rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-brand text-center mb-1">Combinado</h1>
        <p className="text-text-muted text-center text-sm mb-6">
          Proteção familiar contra golpes
        </p>

        <div className="flex rounded-lg bg-surface-muted p-1 mb-6" role="tablist" aria-label="Tipo de acesso">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => { setMode('login'); setError(null) }}
            className={`flex-1 text-sm font-medium py-2 rounded-md transition-colors ${
              mode === 'login'
                ? 'bg-surface text-brand shadow-sm'
                : 'text-text-muted'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            onClick={() => { setMode('signup'); setError(null) }}
            className={`flex-1 text-sm font-medium py-2 rounded-md transition-colors ${
              mode === 'signup'
                ? 'bg-surface text-brand shadow-sm'
                : 'text-text-muted'
            }`}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text mb-1">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text mb-1">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              placeholder={mode === 'signup' ? 'Mín. 8 caracteres, maiúsculas e números' : '••••••••'}
            />
          </div>

          {error && (
            <SystemStateNotice
              icon={CircleAlert}
              title="Não foi possível continuar"
              description={error}
              tone="attention"
              live="assertive"
            />
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand text-brand-foreground font-medium py-2.5 rounded-lg hover:bg-brand-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? 'Aguarde...'
              : mode === 'login'
                ? 'Entrar'
                : 'Criar conta'}
          </button>
        </form>
      </div>
    </EmotionalModeFrame>
  )
}
