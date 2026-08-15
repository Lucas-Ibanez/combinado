import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface PanelGuardian {
  link_id: string
  guardian_id: string
  display_name: string
  phone: string
  role: string
  is_primary: boolean
  linked_at: string
}

export interface PanelIncident {
  id: string
  status: string
  severity: string
  opened_at: string
  acknowledged_at: string | null
  acknowledged_by_name: string | null
  closed_at: string | null
}

export interface PanelData {
  protected_person_id: string
  display_name: string
  family_name: string
  guardians: PanelGuardian[]
  incidents: PanelIncident[]
}

export function useProtectedPanel(token: string | null) {
  return useQuery({
    queryKey: ['protected-panel', token],
    queryFn: async (): Promise<PanelData> => {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/protected-panel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        },
      )

      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Erro ao carregar painel')
      }
      return data as PanelData
    },
    enabled: !!token,
    staleTime: 1000 * 30,
    retry: 1,
  })
}

export function useRevokeGuardian(token: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (guardianLinkId: string) => {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/revoke-guardian`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, guardian_link_id: guardianLinkId }),
        },
      )

      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Erro ao revogar guardião')
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['protected-panel', token] })
    },
  })
}
