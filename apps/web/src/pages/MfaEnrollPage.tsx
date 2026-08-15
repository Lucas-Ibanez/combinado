import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import EmotionalModeFrame from '@/components/common/EmotionalModeFrame'

export default function MfaEnrollPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const enrolled = useRef(false)

  useEffect(() => {
    if (enrolled.current) return
    enrolled.current = true

    async function enroll() {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Combinado Authenticator',
      })
      if (enrollError) {
        setError('Não foi possível gerar o QR code. Tente recarregar a página.')
        return
      }
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setFactorId(data.id)
    }
    enroll()
  }, [])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId })
      if (challengeError) {
        setError('Erro ao iniciar verificação. Tente novamente.')
        return
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      })
      if (verifyError) {
        setError('Código incorreto. Verifique o app autenticador e tente novamente.')
        return
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
        <h1 className="text-xl font-bold text-brand text-center mb-1">
          Ativar verificação em duas etapas
        </h1>
        <p className="text-text-muted text-center text-sm mb-6">
          Essa proteção extra impede que alguém acesse sua conta mesmo com sua senha.
        </p>

        {qrCode ? (
          <>
            <div className="flex justify-center mb-4">
              <img
                src={qrCode}
                alt="QR Code para autenticador"
                className="w-48 h-48 rounded-lg"
              />
            </div>

            <p className="text-xs text-text-muted text-center mb-2">
              Abra seu app autenticador (Google Authenticator, Authy, etc.) e escaneie o QR code acima.
            </p>

            <div className="mb-6">
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="text-xs text-brand hover:underline w-full text-center"
              >
                {showSecret ? 'Ocultar código manual' : 'Não consegue escanear? Insira o código manualmente'}
              </button>
              {showSecret && (
                <p className="mt-2 text-xs text-text bg-surface-muted rounded-lg p-3 text-center font-mono break-all select-all">
                  {secret}
                </p>
              )}
            </div>

            <form onSubmit={handleVerify} className="flex flex-col gap-4">
              <div>
                <label htmlFor="totp-code" className="block text-sm font-medium text-text mb-1">
                  Código do autenticador
                </label>
                <input
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text text-center tracking-widest placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                  placeholder="000000"
                />
              </div>

              {error && (
                <p className="text-sm text-attention-dark bg-attention-surface rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full bg-brand text-brand-foreground font-medium py-2.5 rounded-lg hover:bg-brand-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verificando...' : 'Ativar proteção'}
              </button>
            </form>

            <p className="text-xs text-text-muted text-center mt-6">
              Se perder o acesso ao autenticador, entre em contato com o suporte para recuperar sua conta.
            </p>
          </>
        ) : error ? (
          <p className="text-sm text-attention-dark bg-attention-surface rounded-lg px-3 py-2">
            {error}
          </p>
        ) : (
          <p className="text-text-muted text-center text-sm">Gerando QR code...</p>
        )}
      </div>
    </EmotionalModeFrame>
  )
}
