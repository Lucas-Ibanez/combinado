import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AuditEntry {
  id: string
  action: string
  actor_type: string
  target_type: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export function useAuditLog() {
  return useQuery({
    queryKey: ['audit-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, action, actor_type, target_type, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return (data ?? []) as AuditEntry[]
    },
    staleTime: 1000 * 60,
  })
}
