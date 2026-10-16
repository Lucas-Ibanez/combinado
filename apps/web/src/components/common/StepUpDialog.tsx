import { useState } from 'react'
import { CircleAlert } from 'lucide-react'
import { SystemStateNotice } from '@/components/common/SystemStatus'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer'

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code.length === 6) onVerify(code)
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setCode('')
      onCancel()
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Confirme sua identidade</DrawerTitle>
          <DrawerDescription>
            Esta acao requer verificacao extra. Digite o codigo do seu app autenticador.
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="px-4 pb-2 flex flex-col gap-4">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-lg text-text text-center tracking-widest placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            placeholder="000000"
          />

          {error && (
            <SystemStateNotice
              icon={CircleAlert}
              title="Codigo nao confirmado"
              description={error}
              tone="attention"
              live="assertive"
            />
          )}
        </form>

        <DrawerFooter>
          <button
            type="button"
            onClick={handleSubmit as any}
            disabled={loading || code.length < 6}
            className="w-full bg-brand text-brand-foreground font-medium py-3 rounded-lg hover:bg-brand-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
          >
            {loading ? 'Verificando...' : 'Confirmar'}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text hover:bg-surface-elevated transition-colors"
          >
            Cancelar
          </button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
