import { Link } from 'react-router-dom'
import { useSession } from '@/hooks/useSession'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useSimulations, useStartSimulation } from '@/features/simulations/hooks/useSimulations'
import { useProtectedPerson } from '@/features/simulations/hooks/useProtectedPerson'

export default function DashboardPage() {
  const { data: session, isLoading } = useSession()
  const { data: pp } = useProtectedPerson()
  const { data: simData } = useSimulations(pp?.id ?? null)
  const startMutation = useStartSimulation(pp?.id ?? null)

  const stats = simData?.stats

  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-12 h-12 rounded-full bg-brand-surface flex items-center justify-center mb-4">
        <span className="text-brand text-xl">&#x2705;</span>
      </div>
      <h1 className="text-xl font-bold text-text mb-2">Tudo tranquilo</h1>
      <p className="text-text-muted text-sm max-w-xs mb-2">
        Nenhuma atividade suspeita detectada. Sua família está protegida.
      </p>
      <p className="text-xs text-text-muted mb-6">
        {isLoading ? 'Carregando...' : session?.user?.email ?? ''}
      </p>

      {stats && stats.total > 0 && (
        <Card className="w-full max-w-xs mb-4">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-xs text-text-muted">Progresso do Hábito</p>
                <p className="text-sm font-medium text-text">
                  {stats.successRate}% de acerto
                  {stats.streak > 0 && ` · ${stats.streak} seguidos`}
                </p>
              </div>
              <Link
                to="/simulations"
                className="text-xs text-brand font-medium hover:underline"
              >
                Ver mais
              </Link>
            </div>
            <div className="w-full bg-neutral-100 rounded-full h-1.5 mt-2">
              <div
                className="bg-success h-1.5 rounded-full transition-all"
                style={{ width: `${stats.successRate}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Button
        onClick={() => startMutation.mutate()}
        disabled={startMutation.isPending || !pp}
      >
        {startMutation.isPending ? 'Enviando...' : 'Simular alerta'}
      </Button>

      {startMutation.isSuccess && (
        <p className="text-xs text-success mt-2">Simulação enviada!</p>
      )}
      {startMutation.error && (
        <p className="text-xs text-attention-dark mt-2">{startMutation.error.message}</p>
      )}

      {pp && (
        <Link
          to="/simulations"
          className="text-xs text-text-muted mt-3 hover:text-brand transition-colors"
        >
          Ver histórico de simulações
        </Link>
      )}
    </div>
  )
}
