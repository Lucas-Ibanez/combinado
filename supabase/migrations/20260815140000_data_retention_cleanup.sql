-- =============================================================================
-- Política de retenção de dados — TTL por tipo
-- =============================================================================
-- risk_events:      90 dias (sinais, sem conteúdo bruto)
-- key_access_log:   30 dias (log de auditoria do vault)
-- guardian_invites:  30 dias após expiração
-- incidents/deliveries:  365 dias após fechamento
--
-- Chamada periodicamente pelo serviço via db.rpc('cleanup_expired_data').
-- Em produção com pg_cron disponível, pode ser agendada diretamente:
--   select cron.schedule('retention-cleanup', '0 4 * * *', $$select public.cleanup_expired_data()$$);
-- =============================================================================

create or replace function public.cleanup_expired_data()
returns jsonb
language plpgsql
security definer
set search_path = public, vault_baileys
as $$
declare
  deleted_risk_events int;
  deleted_access_logs int;
  deleted_invites int;
  deleted_incidents int;
begin
  -- Risk events: 90 dias
  delete from public.risk_events
  where processed_at < now() - interval '90 days';
  get diagnostics deleted_risk_events = row_count;

  -- Vault access logs: 30 dias
  delete from vault_baileys.key_access_log
  where accessed_at < now() - interval '30 days';
  get diagnostics deleted_access_logs = row_count;

  -- Convites expirados: 30 dias após expiração
  delete from public.guardian_invites
  where status = 'expired'
    and expires_at < now() - interval '30 days';
  get diagnostics deleted_invites = row_count;

  -- Incidentes fechados: 365 dias
  delete from public.incidents
  where status = 'closed'
    and closed_at < now() - interval '365 days';
  get diagnostics deleted_incidents = row_count;

  return jsonb_build_object(
    'risk_events', deleted_risk_events,
    'access_logs', deleted_access_logs,
    'invites', deleted_invites,
    'incidents', deleted_incidents
  );
end;
$$;

comment on function public.cleanup_expired_data() is
  'Política de retenção: remove dados além do TTL. Chamada pelo serviço a cada 6h.';
