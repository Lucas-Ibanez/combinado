import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface InviteResult {
  ok: boolean
  invite_code: string
  expires_at: string
  reused: boolean
}

export function useCreateInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (protectedPersonId: string): Promise<InviteResult> => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Não autenticado')

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-guardian`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ protected_person_id: protectedPersonId }),
        },
      )

      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Erro ao criar convite')
      }
      return data as InviteResult
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardian-invites'] })
    },
  })
}

export interface GuardianInvite {
  id: string
  invite_code: string
  status: string
  protected_person_id: string
  expires_at: string
  created_at: string
}

export function usePendingInvites() {
  return useQuery({
    queryKey: ['guardian-invites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guardian_invites')
        .select('id, invite_code, status, protected_person_id, expires_at, created_at')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as GuardianInvite[]
    },
  })
}
