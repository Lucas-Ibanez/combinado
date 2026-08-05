import { Navigate, Outlet } from 'react-router-dom'
import { useSession } from '@/hooks/useSession'

export default function ProtectedRoute() {
  const { data: session, isLoading } = useSession()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <p className="text-text-muted text-sm">Carregando...</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
