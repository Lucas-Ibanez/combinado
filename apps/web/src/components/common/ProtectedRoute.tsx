import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

export default function ProtectedRoute() {
  const location = useLocation()

  const { data, isLoading } = useQuery({
    queryKey: ['auth-state'],
    queryFn: async () => {
      const { data: sessionData, error } = await supabase.auth.getSession()
      if (error) throw error
      if (!sessionData.session) return { session: null, aal: null, hasTotp: false, hasFamily: false }

      const { data: aalData } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const hasTotp = (factors?.totp?.length ?? 0) > 0

      const { data: guardian } = await supabase
        .from('guardians')
        .select('family_id')
        .eq('id', sessionData.session.user.id)
        .maybeSingle()

      return {
        session: sessionData.session,
        aal: aalData,
        hasTotp,
        hasFamily: !!guardian?.family_id,
      }
    },
    staleTime: 1000 * 60 * 5,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <p className="flex items-center gap-2 text-text-muted text-sm" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Verificando acesso...
        </p>
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

  if (!data.hasFamily && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
