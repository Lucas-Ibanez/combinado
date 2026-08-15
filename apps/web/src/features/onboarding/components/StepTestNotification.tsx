import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

interface Props {
  onComplete: () => void
  onSkip: () => void
}

export default function StepTestNotification({ onComplete, onSkip }: Props) {
  const [subscribed, setSubscribed] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const queryClient = useQueryClient()

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Este navegador não suporta notificações push. Tente com o Chrome.')
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setPermissionDenied(true)
        throw new Error('Permissão de notificação negada. Ative nas configurações do navegador.')
      }

      const registration = await navigator.serviceWorker.ready

      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
      if (!vapidKey) {
        throw new Error('Chave VAPID não configurada. Configure VITE_VAPID_PUBLIC_KEY.')
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      })

      const subJson = subscription.toJSON()

      const { data: session } = await supabase.auth.getSession()
      if (!session.session) throw new Error('Sessão expirada')

      const { error } = await supabase
        .from('guardians')
        // PushSubscriptionJSON → Json: cast via unknown (types are structurally compatible at runtime)
        .update({ push_subscription: JSON.parse(JSON.stringify(subJson)) })
        .eq('id', session.session.user.id)

      if (error) throw new Error('Erro ao salvar subscription: ' + error.message)

      return subJson
    },
    onSuccess: () => {
      setSubscribed(true)
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] })
    },
  })

  if (subscribed) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-success-surface flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🔔</span>
          </div>
          <h2 className="text-xl font-bold text-text">Notificações Ativadas!</h2>
          <p className="text-sm text-text-muted mt-1">
            Você receberá alertas quando algo suspeito for detectado.
          </p>
        </div>
        <Button className="w-full" onClick={onComplete}>
          Continuar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <div className="w-14 h-14 rounded-full bg-brand-surface flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">🔔</span>
        </div>
        <h2 className="text-xl font-bold text-text">Testar Notificação</h2>
        <p className="text-sm text-text-muted mt-1">
          Ative as notificações para receber alertas em tempo real
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notificações Push</CardTitle>
          <CardDescription>
            O primeiro alerta chega por notificação push no seu celular ou computador
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-text-muted">
            Quando o Combinado detectar uma mensagem suspeita, você será notificado imediatamente.
            As notificações push são o canal mais rápido — o SMS e a ligação são backup.
          </p>

          {permissionDenied && (
            <div className="bg-attention-surface rounded-lg p-3">
              <p className="text-sm text-attention-dark">
                Permissão negada. Vá nas configurações do navegador para ativar notificações deste site.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {subscribeMutation.error && !permissionDenied && (
        <p className="text-sm text-attention-dark text-center">
          {subscribeMutation.error.message}
        </p>
      )}

      <Button
        className="w-full"
        onClick={() => subscribeMutation.mutate()}
        disabled={subscribeMutation.isPending}
      >
        {subscribeMutation.isPending ? 'Ativando...' : 'Ativar Notificações'}
      </Button>

      <Button variant="ghost" className="w-full" onClick={onSkip}>
        Pular por agora
      </Button>
    </div>
  )
}
