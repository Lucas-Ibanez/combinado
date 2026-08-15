import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface CheckMessageResult {
  risk_level: 'safe' | 'suspicious' | 'dangerous'
  severity: string
  signals: Record<string, boolean>
  triggered_rules: string[]
  classifier_score: number
  advice: string
}

export function useCheckMessage() {
  return useMutation({
    mutationFn: async (text: string): Promise<CheckMessageResult> => {
      const { data, error } = await supabase.functions.invoke('check-message', {
        body: { text },
      })
      if (error) throw new Error(error.message ?? 'Erro ao verificar mensagem')
      if (!data?.ok) throw new Error(data?.error ?? 'Erro desconhecido')
      return data as CheckMessageResult
    },
  })
}
