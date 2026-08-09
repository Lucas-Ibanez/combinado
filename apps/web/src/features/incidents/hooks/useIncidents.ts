import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useIncidents() {
  return useQuery({
    queryKey: ['incidents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select('*, protected_persons(display_name)')
        .order('opened_at', { ascending: false })

      if (error) throw error
      return data
    },
  })
}
