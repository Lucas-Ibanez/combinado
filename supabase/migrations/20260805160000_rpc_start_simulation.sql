-- =============================================================================
-- T2.2 — RPC para transactional outbox: start_simulation
--
-- Atomicamente: insere simulation + enfileira job na command_outbox.
-- Chamada pela Edge Function via service_role.
-- =============================================================================

create or replace function public.start_simulation_tx(
  p_family_id        uuid,
  p_protected_person_id uuid,
  p_guardian_id       uuid,
  p_idempotency_key  text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_simulation_id uuid;
begin
  -- Idempotência: se já existe simulação com essa chave, retorna o id existente
  if p_idempotency_key is not null then
    select id into v_simulation_id
    from simulations
    where family_id = p_family_id
      and protected_person_id = p_protected_person_id
      and requested_by = p_guardian_id
      and status = 'scheduled'
      and created_at > now() - interval '1 hour';

    if v_simulation_id is not null then
      return v_simulation_id;
    end if;
  end if;

  -- 1. Inserir a simulação
  insert into simulations (
    family_id,
    protected_person_id,
    requested_by,
    status,
    scheduled_at
  ) values (
    p_family_id,
    p_protected_person_id,
    p_guardian_id,
    'scheduled',
    now()
  )
  returning id into v_simulation_id;

  -- 2. Enfileirar job na command_outbox (mesma transação)
  perform pgmq.send(
    'command_outbox',
    jsonb_build_object(
      'type', 'start_simulation',
      'simulation_id', v_simulation_id,
      'family_id', p_family_id,
      'protected_person_id', p_protected_person_id,
      'guardian_id', p_guardian_id,
      'idempotency_key', p_idempotency_key
    )
  );

  return v_simulation_id;
end;
$$;
