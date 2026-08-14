import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface SetupFamilyInput {
  family_name: string
  guardian_name: string
  guardian_phone: string
  protected_name: string
  protected_phone: string
  code_word: string
  code_hint?: string
}

interface SetupFamilyResult {
  family_id: string
  guardian_id: string
  protected_person_id: string
}

export function useSetupFamily() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SetupFamilyInput): Promise<SetupFamilyResult> => {
      const { data, error } = await supabase.functions.invoke('setup-family', {
        body: input,
      })

      if (error) throw new Error(error.message ?? 'Erro ao criar círculo')
      if (!data?.ok) throw new Error(data?.error ?? 'Erro desconhecido')

      return {
        family_id: data.family_id,
        guardian_id: data.guardian_id,
        protected_person_id: data.protected_person_id,
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-state'] })
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] })
    },
  })
}
