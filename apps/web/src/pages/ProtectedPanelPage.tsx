import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import EmotionalModeFrame from '@/components/common/EmotionalModeFrame'
import CriticalActionDrawer from '@/components/common/CriticalActionDrawer'
import {
  BellRing,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Info,
  Link2Off,
  Loader2,
  ShieldCheck,
  Star,
  UserRound,
  UserX,
} from 'lucide-react'
import { SystemStateNotice, SystemStatusBadge } from '@/components/common/SystemStatus'
import {
  useProtectedPanel,
  useRevokeGuardian,
  type PanelGuardian,
  type PanelIncident,
} from '@/features/protected-panel'

function SeverityBadge({ severity }: { severity: string }) {
  const labels: Record<string, string> = {
    critical: 'Crítico',
    high: 'Alto',
    medium: 'Médio',
    low: 'Baixo',
  }
  return (
    <SystemStatusBadge
      icon={severity === 'low' ? Info : CircleAlert}
      label={`Risco ${(labels[severity] ?? severity).toLowerCase()}`}
      tone={severity === 'low' ? 'normal' : 'attention'}
    />
  )
}

function StatusLabel({ status }: { status: string }) {
  const labels: Record<string, string> = {
    open: 'Aberto',
    notifying: 'Notificando',
    acknowledged: 'Confirmado',
    escalated: 'Escalado',
    expired: 'Expirado',
    closed: 'Encerrado',
  }
  const completed = status === 'acknowledged' || status === 'closed'
  const pending = status === 'expired'

  return (
    <SystemStatusBadge
      icon={completed ? CheckCircle2 : pending ? Clock3 : BellRing}
      label={labels[status] ?? status}
      tone={completed ? 'normal' : pending ? 'neutral' : 'attention'}
    />
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function GuardianCard({
  guardian,
  onRevoke,
  revoking,
}: {
  guardian: PanelGuardian
  onRevoke: (linkId: string) => void
  revoking: boolean
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text">{guardian.display_name}</p>
            <p className="text-xs text-text-muted">{guardian.phone}</p>
            <div className="flex gap-2 mt-1">
              <SystemStatusBadge
                icon={guardian.role === 'primary' ? Star : UserRound}
                label={guardian.role === 'primary' ? 'Guardiao principal' : 'Guardiao secundario'}
                tone={guardian.role === 'primary' ? 'normal' : 'neutral'}
              />
              <span className="text-xs text-text-muted">
                Desde {formatDate(guardian.linked_at)}
              </span>
            </div>
          </div>
        </div>

        <Button
          variant="destructive"
          size="sm"
          className="w-full mt-3"
          onClick={() => setDrawerOpen(true)}
        >
          Revogar acesso
        </Button>

        <CriticalActionDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          title={`Revogar acesso de ${guardian.display_name}?`}
          description="Essa pessoa perdera acesso a sua protecao e nao podera mais monitorar mensagens nem receber alertas."
          confirmLabel="Deslize para revogar"
          onConfirm={() => onRevoke(guardian.link_id)}
          disabled={revoking}
          tone="danger"
        />
      </CardContent>
    </Card>
  )
}

function IncidentRow({ incident }: { incident: PanelIncident }) {
  return (
    <div className="py-3 flex items-center justify-between">
      <div>
        <p className="text-sm text-text">
          {formatDate(incident.opened_at)}
        </p>
        {incident.acknowledged_by_name && (
          <p className="text-xs text-text-muted">
            Confirmado por {incident.acknowledged_by_name}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <SeverityBadge severity={incident.severity} />
        <StatusLabel status={incident.status} />
      </div>
    </div>
  )
}

export default function ProtectedPanelPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const { data, isLoading, error, refetch } = useProtectedPanel(token)
  const revokeMutation = useRevokeGuardian(token)

  if (!token) {
    return (
      <EmotionalModeFrame mode="normal" className="min-h-screen flex items-center justify-center p-6">
        <SystemStateNotice
          icon={Link2Off}
          title="Link inválido"
          description="Peça ao seu familiar um novo link do Combinado pelo WhatsApp."
          tone="attention"
          live="assertive"
          className="max-w-sm"
        />
      </EmotionalModeFrame>
    )
  }

  if (isLoading) {
    return (
      <EmotionalModeFrame mode="normal" className="min-h-screen flex items-center justify-center">
        <p className="flex items-center gap-2 text-sm text-text-muted" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Carregando seu painel...
        </p>
      </EmotionalModeFrame>
    )
  }

  if (error || !data) {
    return (
      <EmotionalModeFrame mode="normal" className="min-h-screen flex items-center justify-center p-6">
        <SystemStateNotice
          icon={CircleAlert}
          title="Não foi possível carregar o painel"
          description={(error as Error)?.message ?? 'Verifique sua conexão ou peça ao seu familiar um novo link.'}
          tone="attention"
          actionLabel="Tentar novamente"
          onAction={() => void refetch()}
          live="assertive"
          className="max-w-sm"
        />
      </EmotionalModeFrame>
    )
  }

  return (
    <EmotionalModeFrame mode="normal" className="min-h-screen">
      <div className="max-w-lg mx-auto p-6 space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-brand-surface flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="h-7 w-7 text-brand" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-text">
            Olá, {data.display_name}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Família {data.family_name} — Painel de Proteção
          </p>
        </div>

        <Card className="bg-brand-surface border-none">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-text text-center">
              Este painel é <strong>seu</strong>. Aqui você vê quem te protege,
              pode revogar o acesso de qualquer guardião e consultar as intervenções realizadas.
            </p>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-base font-semibold text-text mb-3">
            Seus Guardiões ({data.guardians.length})
          </h2>
          {data.guardians.length === 0 ? (
            <SystemStateNotice
              icon={UserX}
              title="Nenhum guardião vinculado"
              description="Peça a uma pessoa de confiança para configurar sua proteção."
              tone="neutral"
            />
          ) : (
            <div className="space-y-3">
              {data.guardians.map((g) => (
                <GuardianCard
                  key={g.link_id}
                  guardian={g}
                  onRevoke={(linkId) => revokeMutation.mutate(linkId)}
                  revoking={revokeMutation.isPending}
                />
              ))}
            </div>
          )}
          {revokeMutation.isSuccess && (
            <SystemStateNotice
              icon={CheckCircle2}
              title="Acesso revogado"
              description="Esse guardião não pode mais acompanhar sua proteção."
              tone="normal"
              className="mt-3"
            />
          )}
          {revokeMutation.error && (
            <SystemStateNotice
              icon={CircleAlert}
              title="Não foi possível revogar o acesso"
              description={revokeMutation.error.message}
              tone="attention"
              live="assertive"
              className="mt-3"
            />
          )}
        </div>

        <div>
          <h2 className="text-base font-semibold text-text mb-3">
            Intervenções Recentes
          </h2>
          {data.incidents.length === 0 ? (
            <SystemStateNotice
              icon={ShieldCheck}
              title="Nenhuma intervenção registrada"
              description="Não houve alertas que exigissem ação da família."
              tone="normal"
            />
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  Alertas detectados pelo Combinado e ações dos guardiões
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {data.incidents.map((inc) => (
                    <IncidentRow key={inc.id} incident={inc} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Precisa de ajuda?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-text-muted">
              Se você não reconhece algum guardião ou se sente desconfortável com
              a monitoração, você tem o direito de revogar o acesso a qualquer momento.
            </p>
            <p className="text-sm text-text-muted">
              Para denunciar abuso ou pedir suporte independente, entre em contato:
            </p>
            <div className="bg-surface rounded-lg p-3 space-y-1">
              <p className="text-sm text-text">
                Disque 100 — Direitos Humanos
              </p>
              <p className="text-sm text-text">
                Disque 180 — Central de Atendimento à Mulher
              </p>
              <p className="text-xs text-text-muted mt-2">
                O Combinado nunca pede senha, Pix ou código por mensagem.
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-text-muted text-center">
          Este link é pessoal. Não compartilhe com terceiros.
        </p>
      </div>
    </EmotionalModeFrame>
  )
}
