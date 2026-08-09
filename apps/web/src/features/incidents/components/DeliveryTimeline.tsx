import type { IncidentDelivery, DeliveryChannel } from '@combinado/shared'

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
  color: string
} {
  if (delivery.acknowledged_at) {
    return { label: 'Confirmado', color: 'bg-success' }
  }
  if (delivery.failure_reason) {
    return { label: 'Falhou', color: 'bg-danger' }
  }
  if (delivery.delivered_at) {
    return { label: 'Entregue', color: 'bg-brand' }
  }
  if (delivery.sent_at) {
    return { label: 'Enviado', color: 'bg-attention' }
  }
  return { label: 'Pendente', color: 'bg-text-muted' }
}

export default function DeliveryTimeline({
  deliveries,
}: {
  deliveries: IncidentDelivery[]
}) {
  const sorted = [...deliveries].sort((a, b) => a.step_order - b.step_order)

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-text-muted py-4 text-center">
        Nenhuma entrega registrada.
      </p>
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-border" />
      <ul className="space-y-4">
        {sorted.map((d) => {
          const { label, color } = stepStatus(d)
          const channel = d.channel as DeliveryChannel

          return (
            <li key={d.id} className="relative pl-8">
              <div
                className={`absolute left-1.5 top-1.5 w-3 h-3 rounded-full ring-2 ring-surface ${color}`}
              />
              <div className="bg-surface-muted rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-text">
                    {d.step_order + 1}. {CHANNEL_LABELS[channel] ?? channel}
                  </span>
                  <span className="text-xs text-text-muted">{label}</span>
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
                    <span className="text-danger">{d.failure_reason}</span>
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
