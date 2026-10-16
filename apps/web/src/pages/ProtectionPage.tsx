import {
  useProtectedPersons,
  useGuardians,
  type ProtectedPersonStatus,
  type GuardianInfo,
} from '@/features/protection/hooks/useProtectionStatus'
import { useCreateInvite, usePendingInvites } from '@/features/guardians'
import type { BaileysStatus } from '@combinado/shared'
import {
  ShieldCheck,
  ShieldOff,
  ShieldAlert,
  Wifi,
  WifiOff,
  Loader2,
  Phone,
  Bell,
  User,
  UserPlus,
  Copy,
  Check,
  BellOff,
  PhoneOff,
  Star,
  UserRound,
  UserX,
  CircleAlert,
} from 'lucide-react'
import { useState, useCallback } from 'react'
import { useStepUp } from '@/hooks/useStepUp'
import StepUpDialog from '@/components/common/StepUpDialog'
import {
  SystemStateNotice,
  SystemStatusBadge,
  type SystemStatusTone,
} from '@/components/common/SystemStatus'

const STATUS_CONFIG: Record<
  BaileysStatus,
  { label: string; tone: SystemStatusTone; icon: typeof Wifi; urgent: boolean }
> = {
  paired: { label: 'Conectado', tone: 'normal', icon: Wifi, urgent: false },
  reconnecting: { label: 'Reconectando...', tone: 'attention', icon: Loader2, urgent: false },
  pairing: { label: 'Pareando...', tone: 'attention', icon: Loader2, urgent: false },
  disconnected: { label: 'Desconectado', tone: 'attention', icon: WifiOff, urgent: true },
  unpaired: { label: 'Não vinculado', tone: 'neutral', icon: WifiOff, urgent: false },
}

function SessionCard({
  person,
  onRetry,
}: {
  person: ProtectedPersonStatus
  onRetry: () => void
}) {
  const status = person.baileys_status as BaileysStatus
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.unpaired
  const Icon = config.icon
  const isDisconnected = status === 'disconnected'

  return (
    <div
      className={`rounded-xl border p-4 ${
        isDisconnected
          ? 'border-attention bg-attention-surface'
          : 'border-border bg-surface'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text">{person.display_name}</p>
          {person.phone && (
            <p className="text-xs text-text-muted mt-0.5">{person.phone}</p>
          )}
        </div>
        <SystemStatusBadge
          icon={Icon}
          label={config.label}
          tone={config.tone}
          className={status === 'reconnecting' || status === 'pairing' ? '[&>svg]:animate-spin' : undefined}
        />
      </div>

      {isDisconnected && (
        <SystemStateNotice
          icon={WifiOff}
          title="Proteção interrompida"
          description="As mensagens deste protegido não estão sendo monitoradas. O serviço tenta reconectar automaticamente."
          tone="attention"
          actionLabel="Verificar conexão novamente"
          onAction={onRetry}
          live="assertive"
          className="mt-3"
        />
      )}

      <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
        <SystemStatusBadge
          icon={person.opted_in ? ShieldCheck : ShieldOff}
          label={person.opted_in ? 'Consentimento ativo' : 'Sem consentimento'}
          tone={person.opted_in ? 'normal' : 'neutral'}
        />
      </div>

    </div>
  )
}

function GuardianCard({ guardian }: { guardian: GuardianInfo }) {
  const hasPush = !!guardian.push_subscription

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-brand-surface flex items-center justify-center">
            <User className="w-4 h-4 text-brand" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text">{guardian.display_name}</p>
            {guardian.phone && (
              <p className="text-xs text-text-muted">{guardian.phone}</p>
            )}
          </div>
        </div>
        <SystemStatusBadge
          icon={guardian.is_primary ? Star : UserRound}
          label={guardian.is_primary ? 'Guardião principal' : 'Guardião secundário'}
          tone={guardian.is_primary ? 'normal' : 'neutral'}
        />
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
        <SystemStatusBadge
          icon={guardian.phone ? Phone : PhoneOff}
          label={guardian.phone ? 'SMS e ligação ativos' : 'Sem telefone'}
          tone={guardian.phone ? 'normal' : 'neutral'}
        />
        <SystemStatusBadge
          icon={hasPush ? Bell : BellOff}
          label={hasPush ? 'Push ativo' : 'Push inativo'}
          tone={hasPush ? 'normal' : 'neutral'}
        />
      </div>
    </div>
  )
}

function InviteSection({
  persons,
  requireStepUp,
}: {
  persons: ProtectedPersonStatus[]
  requireStepUp: (action: () => void) => Promise<void>
}) {
  const createInvite = useCreateInvite()
  const { data: pendingInvites } = usePendingInvites()
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [selectedPerson, setSelectedPerson] = useState<string>(persons[0]?.id ?? '')

  async function handleInvite() {
    if (!selectedPerson) return
    await requireStepUp(() => createInvite.mutate(selectedPerson))
  }

  async function handleCopyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch { /* fallback */ }
  }

  const activeInvite = createInvite.data ?? pendingInvites?.find(
    (inv) => inv.protected_person_id === selectedPerson,
  )

  return (
    <section>
      <h2 className="text-sm font-semibold text-text mb-3 flex items-center gap-1.5">
        <UserPlus className="w-4 h-4 text-brand" />
        Convidar guardião
      </h2>

      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <p className="text-xs text-text-muted">
          Convide um familiar (irmão, filho, neto) para compartilhar a proteção.
          Se você não responder a um alerta, o segundo guardião será acionado automaticamente.
        </p>

        {persons.length > 1 && (
          <div>
            <label htmlFor="invite-person" className="block text-xs font-medium text-text mb-1">
              Protegido
            </label>
            <select
              id="invite-person"
              value={selectedPerson}
              onChange={(e) => setSelectedPerson(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            >
              {persons.map((p) => (
                <option key={p.id} value={p.id}>{p.display_name}</option>
              ))}
            </select>
          </div>
        )}

        {activeInvite ? (
          <div className="rounded-lg bg-brand-surface px-4 py-3 space-y-2">
            <p className="text-xs font-medium text-brand">Código de convite:</p>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-mono tracking-[0.3em] text-brand font-bold">
                {activeInvite.invite_code}
              </span>
              <button
                type="button"
                onClick={() => handleCopyCode(activeInvite.invite_code)}
                className="flex items-center gap-1 text-xs text-brand hover:text-brand/80 transition-colors"
              >
                {copiedCode === activeInvite.invite_code ? (
                  <><Check className="w-3.5 h-3.5" /> Copiado</>
                ) : (
                  <><Copy className="w-3.5 h-3.5" /> Copiar</>
                )}
              </button>
            </div>
            <p className="text-xs text-text-muted">
              Válido por 7 dias. Envie este código ao familiar — ele deve criar uma conta e inserir o código na tela "Aceitar convite".
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleInvite}
            disabled={createInvite.isPending || !selectedPerson}
            className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {createInvite.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Gerando convite...</>
            ) : (
              <><UserPlus className="w-4 h-4" /> Gerar código de convite</>
            )}
          </button>
        )}

        {createInvite.error && (
          <SystemStateNotice
            icon={CircleAlert}
            title="Não foi possível gerar o convite"
            description={createInvite.error.message}
            tone="attention"
            actionLabel="Tentar novamente"
            onAction={() => void handleInvite()}
            live="assertive"
          />
        )}
      </div>
    </section>
  )
}

export default function ProtectionPage() {
  const {
    data: persons,
    isLoading: loadingPersons,
    error: errorPersons,
    refetch: refetchPersons,
  } = useProtectedPersons()
  const {
    data: guardians,
    isLoading: loadingGuardians,
    error: errorGuardians,
    refetch: refetchGuardians,
  } = useGuardians()
  const stepUp = useStepUp()
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  const requireStepUp = useCallback(async (action: () => void) => {
    const ok = await stepUp.ensureAal2()
    if (ok) {
      action()
    } else {
      setPendingAction(() => action)
    }
  }, [stepUp])

  async function handleStepUpVerify(code: string) {
    const ok = await stepUp.verify(code)
    if (ok && pendingAction) {
      pendingAction()
      setPendingAction(null)
    }
  }

  function handleStepUpCancel() {
    setPendingAction(null)
    stepUp.reset()
  }

  const isLoading = loadingPersons || loadingGuardians
  const error = errorPersons || errorGuardians
  const refreshProtection = () => {
    void Promise.all([refetchPersons(), refetchGuardians()])
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <p className="flex items-center gap-2 text-text-muted text-sm" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Carregando estado da proteção...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <SystemStateNotice
          icon={ShieldAlert}
          title="Não foi possível verificar a proteção"
          description="Verifique sua conexão e tente carregar os estados novamente."
          tone="attention"
          actionLabel="Tentar novamente"
          onAction={refreshProtection}
          live="assertive"
          className="w-full max-w-sm text-left"
        />
      </div>
    )
  }

  const hasDisconnected = persons?.some(
    (p) => p.baileys_status === 'disconnected',
  )

  return (
    <div className="p-4 pb-6 space-y-6">
      {hasDisconnected && (
        <SystemStateNotice
          icon={ShieldAlert}
          title="Proteção interrompida — sessão desconectada"
          description="Há mensagens que não estão sendo monitoradas neste momento."
          tone="attention"
          actionLabel="Verificar todas as conexões"
          onAction={refreshProtection}
          live="assertive"
        />
      )}

      <section>
        <h2 className="text-sm font-semibold text-text mb-3">
          Protegidos ({persons?.length ?? 0})
        </h2>
        {(!persons || persons.length === 0) ? (
          <SystemStateNotice
            icon={UserX}
            title="Nenhum protegido cadastrado"
            description="Complete a configuração inicial para ativar a proteção."
            tone="neutral"
          />
        ) : (
          <div className="space-y-3">
            {persons.map((person) => (
              <SessionCard key={person.id} person={person} onRetry={refreshProtection} />
            ))}
          </div>
        )}
      </section>

      {persons && persons.length > 0 && (
        <InviteSection persons={persons} requireStepUp={requireStepUp} />
      )}

      <StepUpDialog
        open={stepUp.status === 'needed' || stepUp.status === 'verifying'}
        error={stepUp.error}
        loading={stepUp.status === 'verifying'}
        onVerify={handleStepUpVerify}
        onCancel={handleStepUpCancel}
      />

      <section>
        <h2 className="text-sm font-semibold text-text mb-3">
          Guardiões ({guardians?.length ?? 0})
        </h2>
        {(!guardians || guardians.length === 0) ? (
          <SystemStateNotice
            icon={UserX}
            title="Nenhum guardião cadastrado"
            description="Use o convite acima para adicionar uma pessoa de confiança."
            tone="neutral"
          />
        ) : (
          <div className="space-y-3">
            {guardians.map((guardian) => (
              <GuardianCard key={guardian.id} guardian={guardian} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
