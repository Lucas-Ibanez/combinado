-- =============================================================================
-- T2.3 — RPC para acknowledge-incident
--
-- Atomicamente: atualiza o incidente + registra no audit_log.
-- Chamada pela Edge Function via service_role.
-- =============================================================================

create or replace function public.acknowledge_incident_tx(
  p_incident_id   uuid,
  p_guardian_id    uuid,
  p_family_id     uuid
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

  -- Só pode confirmar incidentes em estados ativos
  if v_current_status not in ('open', 'notifying', 'escalated') then
    raise exception 'Incident cannot be acknowledged in status: %', v_current_status
      using errcode = 'P0003';
  end if;

  -- 2. Atualizar o incidente
  update incidents
  set status = 'acknowledged',
      acknowledged_at = now(),
      acknowledged_by = p_guardian_id
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
    jsonb_build_object('previous_status', v_current_status)
  );

  return 'acknowledged';
end;
$$;
