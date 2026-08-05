import type { Incident } from '@combinado/shared'
import { useSession } from '@/hooks/useSession'

const recentIncidents: Incident[] = []

export default function DashboardPage() {
  const { data: session, isLoading } = useSession()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-text">Painel</h1>
      <p className="text-text-muted mt-2">Estado da proteção e incidentes recentes.</p>
      <p className="text-sm text-text-muted mt-4">
        Sessão: {isLoading ? 'carregando...' : session ? session.user.email : 'não logado'}
      </p>
      {recentIncidents.length === 0 && (
        <p className="text-sm text-text-muted mt-2">Nenhum incidente recente.</p>
      )}
    </div>
  )
}
