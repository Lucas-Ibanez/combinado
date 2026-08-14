import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface OnboardingStatus {
  hasFamily: boolean
  protectedPersonId: string | null
  baileysStatus: string | null
}

export function useOnboardingStatus(userId: string | undefined) {
  return useQuery({
    queryKey: ['onboarding-status', userId],
    queryFn: async (): Promise<OnboardingStatus> => {
      if (!userId) return { hasFamily: false, protectedPersonId: null, baileysStatus: null }

      const { data: guardian } = await supabase
        .from('guardians')
        .select('family_id')
        .eq('id', userId)
        .maybeSingle()

      if (!guardian?.family_id) {
        return { hasFamily: false, protectedPersonId: null, baileysStatus: null }
      }

      const { data: links } = await supabase
        .from('guardian_links')
        .select('protected_person_id')
        .eq('guardian_id', userId)
        .eq('role', 'primary')
        .maybeSingle()

      let baileysStatus: string | null = null
      if (links?.protected_person_id) {
        const { data: person } = await supabase
          .from('protected_persons')
          .select('baileys_status')
          .eq('id', links.protected_person_id)
          .maybeSingle()
        baileysStatus = person?.baileys_status ?? null
      }

      return {
        hasFamily: true,
        protectedPersonId: links?.protected_person_id ?? null,
        baileysStatus,
      }
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  })
}
