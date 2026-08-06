import { Navigate, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export default function ProtectedRoute() {
  const { data, isLoading } = useQuery({
    queryKey: ['auth-state'],
    queryFn: async () => {
      const { data: sessionData, error } = await supabase.auth.getSession()
      if (error) throw error
      if (!sessionData.session) return { session: null, aal: null, hasTotp: false }

      const { data: aalData } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const hasTotp = (factors?.totp?.length ?? 0) > 0

      return {
        session: sessionData.session,
        aal: aalData,
        hasTotp,
      }
    },
    staleTime: 1000 * 60 * 5,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <p className="text-text-muted text-sm">Carregando...</p>
      </div>
    )
  }

  if (!data?.session) {
    return <Navigate to="/login" replace />
  }

  if (!data.hasTotp) {
    return <Navigate to="/mfa/enroll" replace />
  }

  if (data.aal && data.aal.currentLevel !== data.aal.nextLevel) {
    return <Navigate to="/mfa/verify" replace />
  }

  return <Outlet />
}
