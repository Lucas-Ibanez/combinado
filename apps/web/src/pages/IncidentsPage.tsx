import { useIncidents } from '@/features/incidents/hooks/useIncidents'
import IncidentCard from '@/features/incidents/components/IncidentCard'

export default function IncidentsPage() {
  const { data: incidents, isLoading, error } = useIncidents()

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted text-sm">Carregando alertas...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-danger text-sm">Erro ao carregar alertas.</p>
        <p className="text-text-muted text-xs mt-1">Tente novamente em instantes.</p>
      </div>
    )
  }

  if (!incidents || incidents.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-12 h-12 rounded-full bg-brand-surface flex items-center justify-center mb-4">
          <span className="text-brand text-xl">✓</span>
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
          <h2 className="text-sm font-semibold text-danger mb-3">
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
          <h2 className="text-sm font-semibold text-text-muted mb-3">
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
