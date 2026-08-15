import { useState } from 'react'
import type { IncidentDelivery, Severity } from '@combinado/shared'
import { CircleAlert, Phone, ShieldAlert, UserPlus, MessageCircleWarning, PhoneCall } from 'lucide-react'
import EmotionalModeFrame from '@/components/common/EmotionalModeFrame'
import { SystemStateNotice } from '@/components/common/SystemStatus'
import CriticalActionDrawer from '@/components/common/CriticalActionDrawer'

interface CrisisViewProps {
  personName: string
  personPhone: string | null
  severity: Severity
  summary: string | null
  openedAt: string
  incidentId: string
  deliveries: IncidentDelivery[]
  onAcknowledge?: (action: string) => void
  isPending?: boolean
  ackError?: string | null
}

const SEVERITY_HEADLINE: Record<Severity, string> = {
  critical: 'Pedido urgente de Pix detectado',
  high: 'Mensagem com sinais de personificação',
  medium: 'Pedido precisa de confirmação imediata',
  low: 'Contato precisa de confirmação',
}

function formatTimeShort(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function parseSignals(summary: string | null): string[] {
  if (!summary) return []
  const afterColon = summary.split(': ')[1]
  if (!afterColon) return []
  return afterColon.split(', ').map(formatSignalLabel)
}

function formatSignalLabel(signal: string): string {
  const map: Record<string, string> = {
    pix_mention: 'Menção a Pix',
    urgency_language: 'Linguagem de urgência',
    unknown_sender: 'Remetente desconhecido',
    voice_note: 'Áudio de voz',
    link_suspicious: 'Link suspeito',
    impersonation_pattern: 'Padrão de personificação',
    forwarded: 'Mensagem encaminhada',
    secrecy_demand: 'Pedido de sigilo',
    device_excuse: 'Desculpa de aparelho',
  }
  return map[signal] ?? signal
}

export default function CrisisView({
  personName,
  personPhone,
  severity,
  summary,
  openedAt,
  deliveries,
  onAcknowledge,
  isPending = false,
  ackError = null,
}: CrisisViewProps) {
  const signals = parseSignals(summary)
  const currentStep = deliveries.filter((d) => !d.failure_reason && !d.acknowledged_at).length
  const totalSteps = deliveries.length
  const [drawerAction, setDrawerAction] = useState<string | null>(null)

  return (
    <EmotionalModeFrame
      mode="incident"
      className="min-h-[calc(100vh-56px)] flex flex-col"
    >
      <div className="incident-signal-stripe px-4 py-5 text-danger-foreground">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="w-6 h-6" />
          <span className="text-xs font-medium uppercase tracking-wide opacity-90">
            Incidente ativo · Aja agora
          </span>
        </div>
        <h1 className="text-xl font-bold leading-tight">
          {SEVERITY_HEADLINE[severity]}
        </h1>
        <p className="text-sm mt-1 opacity-90">
          {personName} · {formatTimeShort(openedAt)}
        </p>
      </div>

      <div className="flex-1 px-4 py-5 space-y-5">
        {signals.length > 0 && (
          <div className="rounded-xl bg-surface border border-danger/20 p-4">
            <h2 className="text-sm font-semibold text-text mb-2">
              O que foi detectado
            </h2>
            <ul className="space-y-1.5">
              {signals.map((s) => (
                <li key={s} className="flex items-center gap-2 text-sm text-text">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-danger/30 bg-danger-surface">
                    <CircleAlert className="h-4 w-4 text-danger-dark" aria-hidden="true" />
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-xl bg-surface border-2 border-danger p-4 shadow-sm">
          <h2 className="text-lg font-bold text-danger-dark mb-2 flex items-center gap-2">
            <PhoneCall className="w-5 h-5" />
            Pare. Não faça Pix agora.
          </h2>
          <p className="text-sm text-text mb-4">
            Ligue diretamente para {personName}. Não confirme pelo WhatsApp.
            Use a senha combinada durante a ligação.
          </p>

          <a
            href={personPhone ? `tel:${personPhone}` : undefined}
            onClick={(e) => {
              if (!personPhone) e.preventDefault()
            }}
            className={`flex items-center justify-center gap-3 w-full rounded-xl py-4 px-6 text-base font-bold shadow-lg transition-colors ${
              personPhone
                ? 'bg-danger text-danger-foreground active:bg-danger-dark'
                : 'bg-danger/50 text-danger-foreground/70 cursor-not-allowed'
            }`}
          >
            <Phone className="w-5 h-5" />
            Ligar para {personName}
          </a>
        </div>

        {totalSteps > 0 && (
          <p className="text-xs text-text-muted text-center">
            Escada de alerta em andamento ({currentStep} de {totalSteps} canais ativos)
          </p>
        )}

        <div className="space-y-3">
          <p className="text-xs font-medium text-text">
            Apos falar com {personName}, confirme o resultado:
          </p>

          {ackError && (
            <SystemStateNotice
              icon={CircleAlert}
              title="Nao foi possivel registrar sua confirmacao"
              description={ackError}
              tone="incident"
              live="assertive"
            />
          )}

          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => setDrawerAction('safe_confirmed')}
              className="flex items-center gap-3 w-full rounded-xl border-2 border-brand bg-surface py-3.5 px-4 text-sm font-semibold text-brand transition-colors active:bg-brand-surface disabled:opacity-50"
            >
              <MessageCircleWarning className="w-5 h-5 shrink-0" />
              {isPending && drawerAction === 'safe_confirmed' ? 'Confirmando...' : 'Liguei e confirmei — esta tudo bem'}
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={() => setDrawerAction('threat_confirmed')}
              className="flex items-center gap-3 w-full rounded-xl border-2 border-danger bg-surface py-3.5 px-4 text-sm font-semibold text-danger transition-colors active:bg-danger-surface disabled:opacity-50"
            >
              <ShieldAlert className="w-5 h-5 shrink-0" />
              {isPending && drawerAction === 'threat_confirmed' ? 'Confirmando...' : 'Nao reconheco este pedido'}
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={() => onAcknowledge?.('escalate')}
              className="flex items-center gap-3 w-full rounded-xl border-2 border-attention bg-surface py-3.5 px-4 text-sm font-semibold text-attention transition-colors active:bg-attention-surface disabled:opacity-50"
            >
              <UserPlus className="w-5 h-5 shrink-0" />
              {isPending ? 'Confirmando...' : 'Chamar outro guardiao'}
            </button>
          </div>

          <p className="text-xs text-text-muted text-center">
            Ao confirmar, {personName} recebera uma notificacao por SMS ou ligacao (canal independente do WhatsApp).
          </p>
        </div>

        <CriticalActionDrawer
          open={drawerAction === 'safe_confirmed'}
          onOpenChange={(open) => { if (!open) setDrawerAction(null) }}
          title="Confirmar que esta tudo bem"
          description={`Voce ligou para ${personName}, usou a senha combinada e confirmou que o pedido e legitimo.`}
          confirmLabel="Deslize para confirmar"
          onConfirm={() => onAcknowledge?.('safe_confirmed')}
          disabled={isPending}
          tone="brand"
        />

        <CriticalActionDrawer
          open={drawerAction === 'threat_confirmed'}
          onOpenChange={(open) => { if (!open) setDrawerAction(null) }}
          title="Reportar ameaca"
          description={`${personName} recebera um alerta por SMS/ligacao para NAO fazer nenhuma transferencia. Esta acao nao pode ser desfeita.`}
          confirmLabel="Deslize para reportar ameaca"
          onConfirm={() => onAcknowledge?.('threat_confirmed')}
          disabled={isPending}
          tone="danger"
        />
      </div>
    </EmotionalModeFrame>
  )
}
