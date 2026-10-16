import { Link } from 'react-router-dom'
import type { Incident, IncidentStatus, Severity } from '@combinado/shared'
import {
  BellRing,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Info,
  Radio,
  ShieldAlert,
  UserRoundPlus,
} from 'lucide-react'
import { SystemStatusBadge, type SystemStatusTone } from '@/components/common/SystemStatus'

interface IncidentWithPerson extends Incident {
  protected_persons: { display_name: string } | null
}

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Médio',
  low: 'Baixo',
}

const STATUS_CONFIG: Record<
  IncidentStatus,
  { icon: typeof ShieldAlert; tone: SystemStatusTone }
> = {
  open: { icon: ShieldAlert, tone: 'incident' },
  notifying: { icon: Radio, tone: 'incident' },
  escalated: { icon: UserRoundPlus, tone: 'incident' },
  acknowledged: { icon: CheckCircle2, tone: 'normal' },
  expired: { icon: Clock3, tone: 'neutral' },
  closed: { icon: CheckCircle2, tone: 'normal' },
}

const STATUS_LABELS: Record<IncidentStatus, string> = {
  open: 'Aberto',
  notifying: 'Notificando',
  escalated: 'Escalado',
  acknowledged: 'Confirmado',
  expired: 'Expirado',
  closed: 'Encerrado',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function isActiveStatus(status: string): boolean {
  return status === 'open' || status === 'notifying' || status === 'escalated'
}

export default function IncidentCard({ incident }: { incident: IncidentWithPerson }) {
  const severity = incident.severity as Severity
  const status = incident.status as IncidentStatus
  const personName = incident.protected_persons?.display_name ?? 'Protegido'
  const active = isActiveStatus(status)

  return (
    <Link
      to={`/alerts/${incident.id}`}
      className={`block rounded-xl border p-4 transition-colors ${
        active
          ? 'border-danger bg-danger-surface/50'
          : 'border-border bg-surface'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <SystemStatusBadge
              icon={severity === 'low' ? Info : CircleAlert}
              label={`Risco ${SEVERITY_LABELS[severity].toLowerCase()}`}
              tone={
                active && (severity === 'critical' || severity === 'high')
                  ? 'incident'
                  : severity === 'low'
                    ? 'normal'
                    : 'attention'
              }
            />
            <SystemStatusBadge
              icon={STATUS_CONFIG[status]?.icon ?? BellRing}
              label={STATUS_LABELS[status]}
              tone={STATUS_CONFIG[status]?.tone ?? 'neutral'}
            />
          </div>
          <p className="text-sm font-semibold text-text truncate">
            {personName}
          </p>
          {incident.summary && (
            <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
              {incident.summary}
            </p>
          )}
        </div>
        <span className="text-xs text-text-muted whitespace-nowrap mt-1">
          {timeAgo(incident.opened_at)}
        </span>
      </div>
    </Link>
  )
}
