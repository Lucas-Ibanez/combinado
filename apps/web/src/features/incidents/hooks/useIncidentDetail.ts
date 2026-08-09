import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useIncidentDetail(incidentId: string | undefined) {
  return useQuery({
    queryKey: ['incident', incidentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select('*, protected_persons(display_name), incident_deliveries(*)')
        .eq('id', incidentId!)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!incidentId,
  })
}
