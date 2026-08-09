import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface ProtectedPersonStatus {
  id: string
  display_name: string
  phone: string | null
  baileys_status: string
  opted_in: boolean
  updated_at: string
}

export interface GuardianInfo {
  id: string
  display_name: string
  phone: string | null
  is_primary: boolean
  push_subscription: unknown
}

export function useProtectedPersons() {
  return useQuery({
    queryKey: ['protected-persons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protected_persons')
        .select('id, display_name, phone, baileys_status, opted_in, updated_at')
        .order('display_name')

      if (error) throw error
      return data as ProtectedPersonStatus[]
    },
  })
}

export function useGuardians() {
  return useQuery({
    queryKey: ['guardians'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guardians')
        .select('id, display_name, phone, is_primary, push_subscription')
        .order('is_primary', { ascending: false })

      if (error) throw error
      return data as GuardianInfo[]
    },
  })
}
