-- =============================================================================
-- T11.5 — Confirmação fora do canal comprometido
--
-- 1. Adiciona ack_channel ao incidents para auditar que a confirmação veio
--    de um canal independente (app), não do WhatsApp comprometido.
-- 2. Atualiza a RPC acknowledge_incident_tx para aceitar e gravar ack_channel.
-- =============================================================================

-- 1. Nova coluna
alter table public.incidents
  add column if not exists ack_channel text
    check (ack_channel in ('app', 'sms', 'call', 'whatsapp'));

-- 2. Substituir a RPC para aceitar ack_channel
create or replace function public.acknowledge_incident_tx(
  p_incident_id   uuid,
  p_guardian_id    uuid,
  p_family_id     uuid,
  p_ack_channel   text default 'app'
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
begin
  -- 1. Buscar status atual (lock da linha para evitar race condition)
  select status into v_current_status
  from incidents
  where id = p_incident_id
    and family_id = p_family_id
  for update;

  if v_current_status is null then
    raise exception 'Incident not found or does not belong to this family'
      using errcode = 'P0002';
  end if;

  if v_current_status not in ('open', 'notifying', 'escalated') then
    raise exception 'Incident cannot be acknowledged in status: %', v_current_status
      using errcode = 'P0003';
  end if;

  -- 2. Atualizar o incidente com canal de confirmação
  update incidents
  set status = 'acknowledged',
      acknowledged_at = now(),
      acknowledged_by = p_guardian_id,
      ack_channel = p_ack_channel
  where id = p_incident_id;

  -- 3. Registrar no audit_log
  insert into audit_log (
    family_id,
    actor_id,
    actor_type,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    p_family_id,
    p_guardian_id,
    'guardian',
    'acknowledge_incident',
    'incident',
    p_incident_id,
    jsonb_build_object(
      'previous_status', v_current_status,
      'ack_channel', p_ack_channel
    )
  );

  return 'acknowledged';
end;
$$;
