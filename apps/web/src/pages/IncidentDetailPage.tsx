import { useParams, Link, useNavigate } from 'react-router-dom'
import { useIncidentDetail } from '@/features/incidents/hooks/useIncidentDetail'
import { useAcknowledgeIncident } from '@/features/incidents/hooks/useAcknowledgeIncident'
import DeliveryTimeline from '@/features/incidents/components/DeliveryTimeline'
import CrisisView from '@/features/incidents/components/CrisisView'
import type { Severity, IncidentStatus, IncidentDelivery } from '@combinado/shared'

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: 'bg-attention-surface text-attention-dark',
  high: 'bg-attention-surface text-attention-dark',
  medium: 'bg-attention-surface text-attention-dark',
  low: 'bg-brand-surface text-brand-dark',
}

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Médio',
  low: 'Baixo',
}

const STATUS_LABELS: Record<IncidentStatus, string> = {
  open: 'Aberto',
  notifying: 'Notificando',
  escalated: 'Escalado',
  acknowledged: 'Confirmado',
  expired: 'Expirado',
  closed: 'Encerrado',
}

const ACTIVE_STATUSES = new Set<string>(['open', 'notifying', 'escalated'])

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: incident, isLoading, error } = useIncidentDetail(id)
  const ackMutation = useAcknowledgeIncident()

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted text-sm">Carregando detalhes...</p>
      </div>
    )
  }

  if (error || !incident) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-attention-dark text-sm">Incidente não encontrado.</p>
        <Link to="/alerts" className="text-brand text-sm mt-2 underline">
          Voltar aos alertas
        </Link>
      </div>
    )
  }

  const severity = incident.severity as Severity
  const status = incident.status as IncidentStatus
  const personName = incident.protected_persons?.display_name ?? 'Protegido'
  const personPhone = incident.protected_persons?.phone ?? null
  const deliveries = (incident.incident_deliveries ?? []) as IncidentDelivery[]
  const isActive = ACTIVE_STATUSES.has(status)

  const handleAcknowledge = (action: string) => {
    if (ackMutation.isPending) return
    ackMutation.mutate(
      { incidentId: incident.id, ackAction: action },
      {
        onSuccess: () => {
          if (action === 'escalate') return
          navigate('/alerts')
        },
      },
    )
  }

  if (isActive) {
    return (
      <CrisisView
        personName={personName}
        personPhone={personPhone}
        severity={severity}
        summary={incident.summary}
        openedAt={incident.opened_at}
        incidentId={incident.id}
        deliveries={deliveries}
        onAcknowledge={handleAcknowledge}
        isPending={ackMutation.isPending}
        ackError={ackMutation.error?.message ?? null}
      />
    )
  }

  return (
    <div className="p-4 pb-6">
      <Link
        to="/alerts"
        className="text-sm text-brand mb-4 inline-block"
      >
        ← Alertas
      </Link>

      <div className="rounded-xl border border-border bg-surface p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_STYLES[severity]}`}
          >
            {SEVERITY_LABELS[severity]}
          </span>
          <span className="text-xs text-text-muted">
            {STATUS_LABELS[status]}
          </span>
        </div>

        <h1 className="text-lg font-bold text-text mb-1">{personName}</h1>

        {incident.summary && (
          <p className="text-sm text-text-muted mb-3">{incident.summary}</p>
        )}

        <div className="grid grid-cols-2 gap-y-2 text-xs text-text-muted">
          <div>
            <span className="block text-text font-medium">Aberto em</span>
            {formatDateTime(incident.opened_at)}
          </div>
          {incident.acknowledged_at && (
            <div>
              <span className="block text-text font-medium">Confirmado em</span>
              {formatDateTime(incident.acknowledged_at)}
            </div>
          )}
          {incident.closed_at && (
            <div>
              <span className="block text-text font-medium">Encerrado em</span>
              {formatDateTime(incident.closed_at)}
            </div>
          )}
        </div>
      </div>

      <h2 className="text-sm font-semibold text-text mb-3">
        Linha do tempo de entregas
      </h2>
      <DeliveryTimeline deliveries={deliveries} />
    </div>
  )
}
