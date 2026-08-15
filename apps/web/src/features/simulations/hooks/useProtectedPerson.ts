import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useProtectedPerson() {
  return useQuery({
    queryKey: ['primary-protected-person'],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user?.id
      if (!userId) return null

      const { data: link } = await supabase
        .from('guardian_links')
        .select('protected_person_id, protected_persons(id, display_name)')
        .eq('guardian_id', userId)
        .eq('role', 'primary')
        .maybeSingle()

      if (!link) return null

      const pp = link.protected_persons as { id: string; display_name: string } | null
      return {
        id: link.protected_person_id,
        name: pp?.display_name ?? 'Protegido',
      }
    },
    staleTime: 1000 * 60 * 5,
  })
}
