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
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react'
import { useState, useCallback } from 'react'
import { useStepUp } from '@/hooks/useStepUp'
import StepUpDialog from '@/components/common/StepUpDialog'

const STATUS_CONFIG: Record<
  BaileysStatus,
  { label: string; color: string; icon: typeof Wifi; urgent: boolean }
> = {
  paired: { label: 'Conectado', color: 'text-success', icon: Wifi, urgent: false },
  reconnecting: { label: 'Reconectando...', color: 'text-attention', icon: Loader2, urgent: false },
  pairing: { label: 'Pareando...', color: 'text-attention', icon: Loader2, urgent: false },
  disconnected: { label: 'Desconectado', color: 'text-danger', icon: WifiOff, urgent: true },
  unpaired: { label: 'Não vinculado', color: 'text-text-muted', icon: WifiOff, urgent: false },
}

function PanelLinkButton({ token, name }: { token: string; name: string }) {
  const [copied, setCopied] = useState(false)
  const panelUrl = `${window.location.origin}/protected?token=${token}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(panelUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  return (
    <div className="mt-3 rounded-lg bg-brand-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-brand">
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="font-medium">Painel do Protegido</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-brand hover:text-brand/80 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copiar link
            </>
          )}
        </button>
      </div>
      <p className="text-xs text-text-muted mt-1">
        Envie este link para {name} — permite ver guardiões e revogar acesso de forma independente.
      </p>
    </div>
  )
}

function SessionCard({ person }: { person: ProtectedPersonStatus }) {
  const status = person.baileys_status as BaileysStatus
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.unpaired
  const Icon = config.icon
  const isDisconnected = status === 'disconnected'

  return (
    <div
      className={`rounded-xl border p-4 ${
        isDisconnected
          ? 'border-danger bg-danger-surface'
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
        <div className={`flex items-center gap-1.5 ${config.color}`}>
          <Icon className={`w-4 h-4 ${status === 'reconnecting' || status === 'pairing' ? 'animate-spin' : ''}`} />
          <span className="text-xs font-medium whitespace-nowrap">{config.label}</span>
        </div>
      </div>

      {isDisconnected && (
        <div className="mt-3 rounded-lg bg-danger/10 px-3 py-2">
          <p className="text-sm font-semibold text-danger">
            Proteção interrompida
          </p>
          <p className="text-xs text-danger-dark mt-0.5">
            As mensagens deste protegido não estão sendo monitoradas. Verifique a conexão do serviço.
          </p>
        </div>
      )}

      <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          {person.opted_in ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-success" />
              Opt-in ativo
            </>
          ) : (
            <>
              <ShieldOff className="w-3.5 h-3.5 text-text-muted" />
              Sem opt-in
            </>
          )}
        </span>
      </div>

      {person.panel_token && (
        <PanelLinkButton token={person.panel_token} name={person.display_name} />
      )}
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
        <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${
          guardian.is_primary
            ? 'text-brand bg-brand-surface'
            : 'text-text-muted bg-surface-elevated'
        }`}>
          {guardian.is_primary ? 'Principal' : 'Secundário'}
        </span>
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          <Phone className="w-3.5 h-3.5" />
          {guardian.phone ? 'SMS/Ligação' : 'Sem telefone'}
        </span>
        <span className="flex items-center gap-1">
          <Bell className="w-3.5 h-3.5" />
          {hasPush ? 'Push ativo' : 'Push inativo'}
        </span>
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
          <p className="text-xs text-danger">{createInvite.error.message}</p>
        )}
      </div>
    </section>
  )
}

export default function ProtectionPage() {
  const { data: persons, isLoading: loadingPersons, error: errorPersons } = useProtectedPersons()
  const { data: guardians, isLoading: loadingGuardians, error: errorGuardians } = useGuardians()
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

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted text-sm">Carregando estado da proteção...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-danger text-sm">Erro ao carregar estado da proteção.</p>
        <p className="text-text-muted text-xs mt-1">Tente novamente em instantes.</p>
      </div>
    )
  }

  const hasDisconnected = persons?.some(
    (p) => p.baileys_status === 'disconnected',
  )

  return (
    <div className="p-4 pb-6 space-y-6">
      {hasDisconnected && (
        <div className="rounded-xl bg-danger px-4 py-3 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-danger-foreground shrink-0" />
          <p className="text-sm font-semibold text-danger-foreground">
            Proteção interrompida — sessão desconectada
          </p>
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-text mb-3">
          Protegidos ({persons?.length ?? 0})
        </h2>
        {(!persons || persons.length === 0) ? (
          <p className="text-sm text-text-muted text-center py-4">
            Nenhum protegido cadastrado.
          </p>
        ) : (
          <div className="space-y-3">
            {persons.map((person) => (
              <SessionCard key={person.id} person={person} />
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
          <p className="text-sm text-text-muted text-center py-4">
            Nenhum guardião cadastrado.
          </p>
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
