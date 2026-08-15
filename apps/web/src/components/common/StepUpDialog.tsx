import { useState } from 'react'
import { CircleAlert } from 'lucide-react'
import { SystemStateNotice } from '@/components/common/SystemStatus'

interface StepUpDialogProps {
  open: boolean
  error: string | null
  loading: boolean
  onVerify: (code: string) => void
  onCancel: () => void
}

export default function StepUpDialog({
  open,
  error,
  loading,
  onVerify,
  onCancel,
}: StepUpDialogProps) {
  const [code, setCode] = useState('')

  if (!open) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code.length === 6) onVerify(code)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="bg-surface rounded-2xl shadow-xl p-6 w-full max-w-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="step-up-title"
      >
        <h2 id="step-up-title" className="text-lg font-bold text-text text-center mb-1">
          Confirme sua identidade
        </h2>
        <p className="text-text-muted text-center text-sm mb-5">
          Esta acao requer verificacao extra. Digite o codigo do seu app autenticador.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text text-center tracking-widest placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            placeholder="000000"
          />

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
            {loading ? 'Verificando...' : 'Confirmar'}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full text-sm text-text-muted hover:underline"
          >
            Cancelar
          </button>
        </form>
      </div>
    </div>
  )
}
