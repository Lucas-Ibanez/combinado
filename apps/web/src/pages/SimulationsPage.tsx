import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useSimulations, useStartSimulation } from '@/features/simulations/hooks/useSimulations'
import { useProtectedPerson } from '@/features/simulations/hooks/useProtectedPerson'

function StatusBadge({ status, correct }: { status: string; correct: boolean | null }) {
  if (status === 'responded' && correct) {
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-success-surface text-success-dark">Acertou</span>
  }
  if (status === 'responded' && !correct) {
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-attention-surface text-attention-dark">Errou</span>
  }
  if (status === 'sent') {
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-attention-surface text-attention-dark">Aguardando</span>
  }
  if (status === 'scheduled') {
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-surface text-brand">Agendada</span>
  }
  if (status === 'expired') {
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-neutral-100 text-text-muted">Expirada</span>
  }
  return null
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SimulationsPage() {
  const { data: pp, isLoading: ppLoading } = useProtectedPerson()
  const { data, isLoading } = useSimulations(pp?.id ?? null)
  const startMutation = useStartSimulation(pp?.id ?? null)

  if (ppLoading || isLoading) {
    return (
      <div className="p-6 text-center text-text-muted text-sm">
        Carregando...
      </div>
    )
  }

  if (!pp) {
    return (
      <div className="p-6 text-center">
        <p className="text-text-muted text-sm">
          Nenhum protegido vinculado. Complete o onboarding primeiro.
        </p>
      </div>
    )
  }

  const stats = data?.stats
  const rows = data?.rows ?? []

  return (
    <div className="p-6 space-y-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-bold text-text">Simulações</h1>
        <p className="text-sm text-text-muted mt-1">
          Pratique o hábito de pedir a senha combinada
        </p>
      </div>

      {stats && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Progresso do Hábito</CardTitle>
            <CardDescription>
              Quanto mais {pp.name} praticar, mais automática será a resposta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div>
                <p className="text-2xl font-bold text-brand">{stats.total}</p>
                <p className="text-xs text-text-muted">Total</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-success">{stats.successRate}%</p>
                <p className="text-xs text-text-muted">Acerto</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-attention-dark">{stats.streak}</p>
                <p className="text-xs text-text-muted">Sequência</p>
              </div>
            </div>

            {stats.total > 0 && (
              <div className="w-full bg-neutral-100 rounded-full h-2.5">
                <div
                  className="bg-success h-2.5 rounded-full transition-all"
                  style={{ width: `${stats.successRate}%` }}
                />
              </div>
            )}

            {stats.streak >= 3 && (
              <p className="text-xs text-success-dark mt-2 text-center">
                {stats.streak} acertos seguidos — o hábito está se formando!
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <Button
          className="w-full"
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
        >
          {startMutation.isPending ? 'Enviando...' : 'Enviar Nova Simulação'}
        </Button>

        {startMutation.error && (
          <p className="text-sm text-attention-dark text-center">
            {startMutation.error.message}
          </p>
        )}

        {startMutation.isSuccess && (
          <p className="text-sm text-success text-center">
            Simulação enviada! Aguarde a resposta do protegido.
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {rows.map((sim) => (
                <div key={sim.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text">
                      {formatDate(sim.sent_at ?? sim.created_at)}
                    </p>
                    {sim.responded_at && (
                      <p className="text-xs text-text-muted">
                        Respondeu em {formatDate(sim.responded_at)}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={sim.status} correct={sim.response_correct} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {rows.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-text-muted">
            Nenhuma simulação enviada ainda.
          </p>
          <p className="text-xs text-text-muted mt-1">
            Envie a primeira simulação para começar a praticar.
          </p>
        </div>
      )}
    </div>
  )
}
