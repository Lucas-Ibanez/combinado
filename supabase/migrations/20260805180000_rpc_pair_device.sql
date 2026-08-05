-- =============================================================================
-- T2.4 — RPC para transactional outbox: pair_device
--
-- Atomicamente: atualiza baileys_status para 'pairing' + enfileira job.
-- Chamada pela Edge Function via service_role.
-- =============================================================================

create or replace function public.pair_device_tx(
  p_protected_person_id uuid,
  p_guardian_id          uuid,
  p_family_id            uuid,
  p_idempotency_key      text default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
begin
  -- 1. Buscar status atual com lock
  select baileys_status into v_current_status
  from protected_persons
  where id = p_protected_person_id
    and family_id = p_family_id
  for update;

  if v_current_status is null then
    raise exception 'Protected person not found or does not belong to this family'
      using errcode = 'P0002';
  end if;

  -- Idempotência: se já está em pairing, retorna sem erro
  if v_current_status = 'pairing' then
    return 'already_pairing';
  end if;

  -- Só pode parear se unpaired ou disconnected
  if v_current_status not in ('unpaired', 'disconnected') then
    raise exception 'Cannot pair device in status: %', v_current_status
      using errcode = 'P0003';
  end if;

  -- 2. Atualizar status para pairing
  update protected_persons
  set baileys_status = 'pairing'
  where id = p_protected_person_id;

  -- 3. Enfileirar job na command_outbox
  perform pgmq.send(
    'command_outbox',
    jsonb_build_object(
      'type', 'pair_device',
      'protected_person_id', p_protected_person_id,
      'guardian_id', p_guardian_id,
      'family_id', p_family_id,
      'idempotency_key', p_idempotency_key
    )
  );

  -- 4. Audit log
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
    'pair_device',
    'protected_person',
    p_protected_person_id,
    jsonb_build_object('previous_status', v_current_status)
  );

  return 'pairing';
end;
$$;
