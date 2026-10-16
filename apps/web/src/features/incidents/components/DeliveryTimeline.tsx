import type { IncidentDelivery, DeliveryChannel } from '@combinado/shared'
import { CheckCircle2, CircleAlert, Clock3, Inbox, Send, ShieldCheck } from 'lucide-react'
import {
  SystemStateNotice,
  SystemStatusBadge,
  type SystemStatusTone,
} from '@/components/common/SystemStatus'

const CHANNEL_LABELS: Record<DeliveryChannel, string> = {
  push: 'Push',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  call: 'Ligação',
}

function formatTime(dateStr: string | null): string | null {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function stepStatus(delivery: IncidentDelivery): {
  label: string
  tone: SystemStatusTone
  icon: typeof Clock3
} {
  if (delivery.acknowledged_at) {
    return { label: 'Confirmado', tone: 'normal', icon: CheckCircle2 }
  }
  if (delivery.failure_reason) {
    return { label: 'Falhou', tone: 'attention', icon: CircleAlert }
  }
  if (delivery.delivered_at) {
    return { label: 'Entregue', tone: 'normal', icon: ShieldCheck }
  }
  if (delivery.sent_at) {
    return { label: 'Enviado', tone: 'attention', icon: Send }
  }
  return { label: 'Pendente', tone: 'neutral', icon: Clock3 }
}

export default function DeliveryTimeline({
  deliveries,
}: {
  deliveries: IncidentDelivery[]
}) {
  const sorted = [...deliveries].sort((a, b) => a.step_order - b.step_order)

  if (sorted.length === 0) {
    return (
      <SystemStateNotice
        icon={Inbox}
        title="Nenhuma entrega registrada"
        description="A escada de alertas ainda não acionou nenhum canal."
        tone="neutral"
      />
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-border" />
      <ul className="space-y-4">
        {sorted.map((d) => {
          const { label, tone, icon: StatusIcon } = stepStatus(d)
          const channel = d.channel as DeliveryChannel

          return (
            <li key={d.id} className="relative pl-8">
              <span className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-md border border-border bg-surface">
                <StatusIcon className="h-3.5 w-3.5 text-text" aria-hidden="true" />
              </span>
              <div className="bg-surface-muted rounded-lg p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-text">
                    {d.step_order + 1}. {CHANNEL_LABELS[channel] ?? channel}
                  </span>
                  <SystemStatusBadge icon={StatusIcon} label={label} tone={tone} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-text-muted">
                  {d.sent_at && <span>Enviado: {formatTime(d.sent_at)}</span>}
                  {d.delivered_at && (
                    <span>Entregue: {formatTime(d.delivered_at)}</span>
                  )}
                  {d.acknowledged_at && (
                    <span>Confirmado: {formatTime(d.acknowledged_at)}</span>
                  )}
                  {d.failure_reason && (
                    <span className="inline-flex items-center gap-1 font-medium text-attention-dark">
                      <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                      Falha: {d.failure_reason}
                    </span>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
