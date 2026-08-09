import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface AckParams {
  incidentId: string
}

export function useAcknowledgeIncident() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ incidentId }: AckParams) => {
      const { data, error } = await supabase.functions.invoke(
        'acknowledge-incident',
        { body: { incident_id: incidentId } },
      )

      if (error) throw error
      if (!data?.ok) throw new Error(data?.error ?? 'Falha ao confirmar incidente')

      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      queryClient.invalidateQueries({ queryKey: ['incident', variables.incidentId] })
    },
  })
}
