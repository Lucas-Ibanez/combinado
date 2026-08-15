import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuditLog, type AuditEntry } from '@/hooks/useAuditLog'
import { Shield, LogOut, ScrollText, Clock } from 'lucide-react'

const ACTION_LABELS: Record<string, string> = {
  setup_family: 'Familia configurada',
  pair_device: 'Dispositivo pareado',
  acknowledge_incident: 'Alerta confirmado',
  start_simulation: 'Simulacao iniciada',
  create_invite: 'Convite criado',
  accept_invite: 'Convite aceito',
  revoke_guardian: 'Guardiao revogado',
}

function formatAction(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ')
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <Clock className="w-3.5 h-3.5 text-text-muted mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text">{formatAction(entry.action)}</p>
        <p className="text-xs text-text-muted">{formatDate(entry.created_at)}</p>
      </div>
      <span className="text-xs text-text-muted bg-surface-elevated rounded px-1.5 py-0.5 shrink-0">
        {entry.actor_type}
      </span>
    </div>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: auditEntries, isLoading: auditLoading } = useAuditLog()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOutAll() {
    setSigningOut(true)
    try {
      await supabase.auth.signOut({ scope: 'global' })
      queryClient.removeQueries()
      navigate('/login', { replace: true })
    } finally {
      setSigningOut(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    queryClient.removeQueries()
    navigate('/login', { replace: true })
  }

  return (
    <div className="p-4 pb-6 space-y-6">
      <h1 className="text-xl font-bold text-text">Configuracoes</h1>

      <section>
        <h2 className="text-sm font-semibold text-text mb-3 flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-brand" />
          Seguranca da conta
        </h2>

        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text">Verificacao em duas etapas</p>
              <p className="text-xs text-text-muted">TOTP ativo — protege sua conta contra acesso nao autorizado</p>
            </div>
            <span className="text-xs font-medium text-success bg-success/10 rounded-full px-2 py-0.5">
              Ativo
            </span>
          </div>

          <div className="border-t border-border pt-3">
            <p className="text-xs text-text-muted mb-2">
              Acoes sensiveis (parear dispositivo, convidar guardiao) exigem re-verificacao do autenticador.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-text mb-3 flex items-center gap-1.5">
          <LogOut className="w-4 h-4 text-text-muted" />
          Sessoes
        </h2>

        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text hover:bg-surface-elevated transition-colors"
          >
            Sair desta sessao
          </button>

          <button
            type="button"
            onClick={handleSignOutAll}
            disabled={signingOut}
            className="w-full rounded-lg border border-danger text-danger px-4 py-2.5 text-sm font-medium hover:bg-danger/5 transition-colors disabled:opacity-50"
          >
            {signingOut ? 'Encerrando...' : 'Encerrar todas as sessoes'}
          </button>

          <p className="text-xs text-text-muted">
            "Encerrar todas" desconecta todos os dispositivos onde sua conta esta logada.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-text mb-3 flex items-center gap-1.5">
          <ScrollText className="w-4 h-4 text-text-muted" />
          Historico de atividades
        </h2>

        <div className="rounded-xl border border-border bg-surface">
          {auditLoading ? (
            <p className="text-sm text-text-muted text-center py-6">
              Carregando...
            </p>
          ) : !auditEntries || auditEntries.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">
              Nenhuma atividade registrada.
            </p>
          ) : (
            <div className="px-4 divide-y divide-border">
              {auditEntries.map((entry) => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <p className="text-xs text-text-muted text-center">
          Recuperacao de conta: se perder o acesso ao autenticador, entre em contato com o suporte informando o e-mail cadastrado e um documento com foto.
        </p>
      </section>
    </div>
  )
}
