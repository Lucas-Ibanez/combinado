-- =============================================================================
-- T10.4 — Painel do protegido (contra abuso do guardião)
--
-- 1. Adiciona panel_token ao protected_persons para acesso por URL sem login
-- 2. RPC revoke_guardian_tx: o protegido revoga um guardião atomicamente
-- 3. RPC get_protected_panel: retorna dados do painel via panel_token
-- =============================================================================

-- 1. Token de acesso ao painel do protegido
alter table public.protected_persons
  add column panel_token uuid not null default gen_random_uuid();

create unique index idx_protected_persons_panel_token
  on public.protected_persons(panel_token);

-- 2. Revogar guardião — SECURITY DEFINER para bypass de RLS
create or replace function public.revoke_guardian_tx(
  p_panel_token     uuid,
  p_guardian_link_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pp_id uuid;
  v_pp_family_id uuid;
  v_link_guardian_id uuid;
  v_link_pp_id uuid;
  v_link_role text;
begin
  -- Validar token e obter protegido
  select id, family_id into v_pp_id, v_pp_family_id
  from protected_persons
  where panel_token = p_panel_token;

  if v_pp_id is null then
    raise exception 'Token inválido' using errcode = 'P0001';
  end if;

  -- Validar que o link pertence a este protegido
  select guardian_id, protected_person_id, role
  into v_link_guardian_id, v_link_pp_id, v_link_role
  from guardian_links
  where id = p_guardian_link_id;

  if v_link_pp_id is null then
    raise exception 'Vínculo não encontrado' using errcode = 'P0002';
  end if;

  if v_link_pp_id != v_pp_id then
    raise exception 'Vínculo não pertence a este protegido' using errcode = 'P0003';
  end if;

  -- Deletar o vínculo
  delete from guardian_links where id = p_guardian_link_id;

  -- Audit log
  insert into audit_log (
    family_id, actor_id, actor_type, action,
    target_type, target_id, metadata
  ) values (
    v_pp_family_id,
    v_pp_id,
    'system',
    'revoke_guardian',
    'guardian_link',
    p_guardian_link_id,
    jsonb_build_object(
      'revoked_guardian_id', v_link_guardian_id,
      'role', v_link_role,
      'initiated_by', 'protected_person'
    )
  );
end;
$$;

-- 3. Obter dados do painel — SECURITY DEFINER para acesso via token
create or replace function public.get_protected_panel(
  p_panel_token uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pp record;
  v_guardians jsonb;
  v_incidents jsonb;
  v_family_name text;
begin
  -- Buscar protegido pelo token
  select id, family_id, display_name
  into v_pp
  from protected_persons
  where panel_token = p_panel_token;

  if v_pp.id is null then
    raise exception 'Token inválido' using errcode = 'P0001';
  end if;

  -- Nome da família
  select name into v_family_name
  from families
  where id = v_pp.family_id;

  -- Guardiões vinculados
  select coalesce(jsonb_agg(jsonb_build_object(
    'link_id', gl.id,
    'guardian_id', g.id,
    'display_name', g.display_name,
    'phone', left(g.phone, 5) || '****',
    'role', gl.role,
    'is_primary', g.is_primary,
    'linked_at', gl.created_at
  ) order by gl.created_at), '[]'::jsonb)
  into v_guardians
  from guardian_links gl
  join guardians g on g.id = gl.guardian_id
  where gl.protected_person_id = v_pp.id;

  -- Últimas 20 intervenções (incidentes)
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'status', i.status,
    'severity', i.severity,
    'opened_at', i.opened_at,
    'acknowledged_at', i.acknowledged_at,
    'acknowledged_by_name', ack_g.display_name,
    'closed_at', i.closed_at
  ) order by i.opened_at desc), '[]'::jsonb)
  into v_incidents
  from (
    select * from incidents
    where protected_person_id = v_pp.id
    order by opened_at desc
    limit 20
  ) i
  left join guardians ack_g on ack_g.id = i.acknowledged_by;

  return jsonb_build_object(
    'protected_person_id', v_pp.id,
    'display_name', v_pp.display_name,
    'family_name', v_family_name,
    'guardians', v_guardians,
    'incidents', v_incidents
  );
end;
$$;
