import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface AcceptInviteParams {
  invite_code: string
  display_name: string
  phone?: string
}

interface AcceptInviteResult {
  ok: boolean
  family_id: string
  guardian_id: string
  protected_person_id: string
  role: string
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: async (params: AcceptInviteParams): Promise<AcceptInviteResult> => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Não autenticado')

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-invite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(params),
        },
      )

      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Erro ao aceitar convite')
      }
      return data as AcceptInviteResult
    },
  })
}
