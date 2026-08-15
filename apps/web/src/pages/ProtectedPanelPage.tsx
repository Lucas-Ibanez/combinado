import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  useProtectedPanel,
  useRevokeGuardian,
  type PanelGuardian,
  type PanelIncident,
} from '@/features/protected-panel'

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: 'bg-danger-surface text-danger-dark',
    high: 'bg-danger-surface text-danger-dark',
    medium: 'bg-warning-surface text-warning-dark',
    low: 'bg-brand-surface text-brand',
  }
  const labels: Record<string, string> = {
    critical: 'Crítico',
    high: 'Alto',
    medium: 'Médio',
    low: 'Baixo',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[severity] ?? 'bg-neutral-100 text-text-muted'}`}>
      {labels[severity] ?? severity}
    </span>
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
  return <span className="text-xs text-text-muted">{labels[status] ?? status}</span>
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
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text">{guardian.display_name}</p>
            <p className="text-xs text-text-muted">{guardian.phone}</p>
            <div className="flex gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand-surface text-brand">
                {guardian.role === 'primary' ? 'Principal' : 'Secundário'}
              </span>
              <span className="text-xs text-text-muted">
                Desde {formatDate(guardian.linked_at)}
              </span>
            </div>
          </div>
        </div>

        {!confirmOpen ? (
          <Button
            variant="destructive"
            size="sm"
            className="w-full mt-3"
            onClick={() => setConfirmOpen(true)}
          >
            Revogar acesso
          </Button>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="bg-danger-surface rounded-lg p-3">
              <p className="text-sm text-danger-dark">
                Tem certeza? <strong>{guardian.display_name}</strong> perderá acesso
                à sua proteção e não poderá mais monitorar mensagens nem receber alertas.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={() => onRevoke(guardian.link_id)}
                disabled={revoking}
              >
                {revoking ? 'Revogando...' : 'Sim, revogar'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setConfirmOpen(false)}
                disabled={revoking}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
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

  const { data, isLoading, error } = useProtectedPanel(token)
  const revokeMutation = useRevokeGuardian(token)

  if (!token) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <Card className="max-w-sm w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-danger">
              Link inválido. Use o link enviado pelo Combinado no seu WhatsApp.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-sm text-text-muted">Carregando seu painel...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <Card className="max-w-sm w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <p className="text-sm text-danger">
              {(error as Error)?.message ?? 'Não foi possível carregar o painel.'}
            </p>
            <p className="text-xs text-text-muted">
              Se o problema persistir, peça ao seu familiar para enviar um novo link.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-lg mx-auto p-6 space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-brand-surface flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">&#x1F6E1;</span>
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
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-text-muted">
                  Nenhum guardião vinculado no momento.
                </p>
              </CardContent>
            </Card>
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
            <p className="text-sm text-success text-center mt-3">
              Guardião revogado com sucesso.
            </p>
          )}
          {revokeMutation.error && (
            <p className="text-sm text-danger text-center mt-3">
              {revokeMutation.error.message}
            </p>
          )}
        </div>

        <div>
          <h2 className="text-base font-semibold text-text mb-3">
            Intervenções Recentes
          </h2>
          {data.incidents.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-text-muted">
                  Nenhuma intervenção registrada. Isso é bom!
                </p>
              </CardContent>
            </Card>
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
    </div>
  )
}
