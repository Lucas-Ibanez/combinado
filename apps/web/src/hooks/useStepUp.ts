import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type StepUpStatus = 'idle' | 'needed' | 'verifying' | 'verified' | 'error'

export function useStepUp() {
  const [status, setStatus] = useState<StepUpStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const ensureAal2 = useCallback(async (): Promise<boolean> => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (data?.currentLevel === 'aal2') {
      setStatus('verified')
      return true
    }
    setStatus('needed')
    return false
  }, [])

  const verify = useCallback(async (code: string): Promise<boolean> => {
    setError(null)
    setStatus('verifying')

    const { data: factors } = await supabase.auth.mfa.listFactors()
    const totp = factors?.totp?.[0]
    if (!totp) {
      setError('Nenhum autenticador configurado.')
      setStatus('error')
      return false
    }

    const { data: challenge, error: challengeErr } =
      await supabase.auth.mfa.challenge({ factorId: totp.id })
    if (challengeErr || !challenge) {
      setError('Erro ao iniciar verificação.')
      setStatus('error')
      return false
    }

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: totp.id,
      challengeId: challenge.id,
      code,
    })
    if (verifyErr) {
      setError('Codigo incorreto. Tente novamente.')
      setStatus('needed')
      return false
    }

    setStatus('verified')
    return true
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
  }, [])

  return { status, error, ensureAal2, verify, reset }
}
