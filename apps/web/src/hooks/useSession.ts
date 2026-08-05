import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      return data.session
    },
    staleTime: 1000 * 60 * 5,
  })
}
