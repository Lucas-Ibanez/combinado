import {
  useProtectedPersons,
  useGuardians,
  type ProtectedPersonStatus,
  type GuardianInfo,
} from '@/features/protection/hooks/useProtectionStatus'
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
} from 'lucide-react'

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
        {guardian.is_primary && (
          <span className="text-xs font-medium text-brand bg-brand-surface rounded-full px-2 py-0.5">
            Principal
          </span>
        )}
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

export default function ProtectionPage() {
  const { data: persons, isLoading: loadingPersons, error: errorPersons } = useProtectedPersons()
  const { data: guardians, isLoading: loadingGuardians, error: errorGuardians } = useGuardians()

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
