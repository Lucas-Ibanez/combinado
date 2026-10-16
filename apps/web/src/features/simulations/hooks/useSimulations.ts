import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface SimulationRow {
  id: string
  status: string
  sent_at: string | null
  responded_at: string | null
  response_correct: boolean | null
  created_at: string
}

export interface SimulationStats {
  total: number
  sent: number
  responded: number
  correct: number
  incorrect: number
  pending: number
  streak: number
  successRate: number
}

function computeStats(rows: SimulationRow[]): SimulationStats {
  let correct = 0
  let incorrect = 0
  let sent = 0
  let responded = 0
  let pending = 0

  for (const r of rows) {
    if (r.status === 'responded') {
      responded++
      if (r.response_correct) correct++
      else incorrect++
    } else if (r.status === 'sent' || r.status === 'scheduled') {
      pending++
      if (r.status === 'sent') sent++
    } else if (r.status === 'expired') {
      incorrect++
    }
  }

  let streak = 0
  const sorted = [...rows]
    .filter((r) => r.status === 'responded' || r.status === 'expired')
    .sort((a, b) => {
      const da = a.responded_at ?? a.created_at
      const db2 = b.responded_at ?? b.created_at
      return db2.localeCompare(da)
    })

  for (const r of sorted) {
    if (r.status === 'responded' && r.response_correct) streak++
    else break
  }

  const total = rows.length
  const totalFinished = correct + incorrect
  const successRate = totalFinished > 0 ? Math.round((correct / totalFinished) * 100) : 0

  return { total, sent, responded, correct, incorrect, pending, streak, successRate }
}

export function useSimulations(protectedPersonId: string | null) {
  return useQuery({
    queryKey: ['simulations', protectedPersonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('simulations')
        .select('id, status, sent_at, responded_at, response_correct, created_at')
        .eq('protected_person_id', protectedPersonId!)
        .order('created_at', { ascending: false })

      if (error) throw error
      const rows = (data ?? []) as SimulationRow[]
      return { rows, stats: computeStats(rows) }
    },
    enabled: !!protectedPersonId,
    staleTime: 1000 * 15,
    refetchInterval: (query) => {
      const pending = query.state.data?.stats?.pending ?? 0
      return pending > 0 ? 3000 : false
    },
  })
}

export function useStartSimulation(protectedPersonId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!protectedPersonId) throw new Error('Nenhum protegido vinculado')

      const { data, error } = await supabase.functions.invoke('start-simulation', {
        body: { protected_person_id: protectedPersonId },
      })
      if (error) throw new Error(error.message ?? 'Erro ao iniciar simulação')
      if (!data?.ok) throw new Error(data?.error ?? 'Erro desconhecido')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulations', protectedPersonId] })
    },
  })
}
