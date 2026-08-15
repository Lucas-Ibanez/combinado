import { useIncidents } from '@/features/incidents/hooks/useIncidents'
import IncidentCard from '@/features/incidents/components/IncidentCard'
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react'
import { SystemStateNotice } from '@/components/common/SystemStatus'

export default function IncidentsPage() {
  const { data: incidents, isLoading, error, refetch } = useIncidents()

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <p className="flex items-center gap-2 text-text-muted text-sm" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Carregando alertas...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <SystemStateNotice
          icon={ShieldAlert}
          title="Não foi possível carregar os alertas"
          description="Verifique sua conexão e tente novamente."
          tone="attention"
          actionLabel="Tentar novamente"
          onAction={() => void refetch()}
          live="assertive"
          className="w-full max-w-sm text-left"
        />
      </div>
    )
  }

  if (!incidents || incidents.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-12 h-12 rounded-full bg-brand-surface flex items-center justify-center mb-4">
          <ShieldCheck className="h-6 w-6 text-brand" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-text mb-2">Nenhum alerta no momento</h1>
        <p className="text-text-muted text-sm max-w-xs">
          Quando algo suspeito for detectado, você verá os alertas aqui com todos os detalhes para agir.
        </p>
      </div>
    )
  }

  const active = incidents.filter(
    (i) => i.status === 'open' || i.status === 'notifying' || i.status === 'escalated',
  )
  const resolved = incidents.filter(
    (i) => i.status !== 'open' && i.status !== 'notifying' && i.status !== 'escalated',
  )

  return (
    <div className="p-4 pb-6 space-y-6">
      {active.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-danger mb-3">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            Ativos ({active.length})
          </h2>
          <div className="space-y-3">
            {active.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} />
            ))}
          </div>
        </section>
      )}

      {resolved.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text-muted mb-3">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Resolvidos ({resolved.length})
          </h2>
          <div className="space-y-3">
            {resolved.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
