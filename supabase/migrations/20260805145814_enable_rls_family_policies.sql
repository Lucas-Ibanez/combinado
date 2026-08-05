-- =============================================================================
-- T1.4 — RLS por família em todas as tabelas de aplicação
--
-- Princípio: um guardião só acessa dados da própria família.
-- service_role bypassa RLS (padrão do Supabase) — usado pelo serviço Node.
-- anon não acessa nenhuma tabela de aplicação.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Helper: retorna o family_id do usuário autenticado
--    SECURITY DEFINER evita dependência circular (RLS em guardians)
-- -----------------------------------------------------------------------------
create or replace function public.current_user_family_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from public.guardians where id = auth.uid()
$$;

-- -----------------------------------------------------------------------------
-- 1. Habilitar RLS em TODAS as tabelas de aplicação
-- -----------------------------------------------------------------------------
alter table public.families            enable row level security;
alter table public.guardians           enable row level security;
alter table public.protected_persons   enable row level security;
alter table public.guardian_links      enable row level security;
alter table public.secrets_family      enable row level security;
alter table public.incidents           enable row level security;
alter table public.incident_deliveries enable row level security;
alter table public.risk_events         enable row level security;
alter table public.simulations         enable row level security;
alter table public.audit_log           enable row level security;

-- -----------------------------------------------------------------------------
-- 2. Policies para tabelas COM family_id direto
-- -----------------------------------------------------------------------------

-- families: guardião vê só a própria família
create policy "guardian_family_select" on public.families
  for select to authenticated
  using (id = public.current_user_family_id());

create policy "guardian_family_update" on public.families
  for update to authenticated
  using (id = public.current_user_family_id())
  with check (id = public.current_user_family_id());

-- guardians: vê guardiões da própria família
create policy "guardian_guardians_select" on public.guardians
  for select to authenticated
  using (family_id = public.current_user_family_id());

create policy "guardian_guardians_insert" on public.guardians
  for insert to authenticated
  with check (family_id = public.current_user_family_id());

create policy "guardian_guardians_update" on public.guardians
  for update to authenticated
  using (family_id = public.current_user_family_id())
  with check (family_id = public.current_user_family_id());

-- protected_persons
create policy "guardian_protected_select" on public.protected_persons
  for select to authenticated
  using (family_id = public.current_user_family_id());

create policy "guardian_protected_insert" on public.protected_persons
  for insert to authenticated
  with check (family_id = public.current_user_family_id());

create policy "guardian_protected_update" on public.protected_persons
  for update to authenticated
  using (family_id = public.current_user_family_id())
  with check (family_id = public.current_user_family_id());

-- secrets_family
create policy "guardian_secrets_select" on public.secrets_family
  for select to authenticated
  using (family_id = public.current_user_family_id());

create policy "guardian_secrets_insert" on public.secrets_family
  for insert to authenticated
  with check (family_id = public.current_user_family_id());

create policy "guardian_secrets_update" on public.secrets_family
  for update to authenticated
  using (family_id = public.current_user_family_id())
  with check (family_id = public.current_user_family_id());

-- incidents
create policy "guardian_incidents_select" on public.incidents
  for select to authenticated
  using (family_id = public.current_user_family_id());

create policy "guardian_incidents_update" on public.incidents
  for update to authenticated
  using (family_id = public.current_user_family_id())
  with check (family_id = public.current_user_family_id());

-- risk_events (somente leitura para o guardião)
create policy "guardian_risk_events_select" on public.risk_events
  for select to authenticated
  using (family_id = public.current_user_family_id());

-- simulations
create policy "guardian_simulations_select" on public.simulations
  for select to authenticated
  using (family_id = public.current_user_family_id());

-- audit_log (somente leitura para o guardião)
create policy "guardian_audit_log_select" on public.audit_log
  for select to authenticated
  using (family_id = public.current_user_family_id());

-- -----------------------------------------------------------------------------
-- 3. Policies para tabelas SEM family_id direto (join necessário)
-- -----------------------------------------------------------------------------

-- guardian_links: via guardian_id → guardians.family_id
create policy "guardian_links_select" on public.guardian_links
  for select to authenticated
  using (
    guardian_id in (
      select id from public.guardians
      where family_id = public.current_user_family_id()
    )
  );

create policy "guardian_links_insert" on public.guardian_links
  for insert to authenticated
  with check (
    guardian_id in (
      select id from public.guardians
      where family_id = public.current_user_family_id()
    )
  );

create policy "guardian_links_update" on public.guardian_links
  for update to authenticated
  using (
    guardian_id in (
      select id from public.guardians
      where family_id = public.current_user_family_id()
    )
  )
  with check (
    guardian_id in (
      select id from public.guardians
      where family_id = public.current_user_family_id()
    )
  );

-- incident_deliveries: via incident_id → incidents.family_id
create policy "guardian_deliveries_select" on public.incident_deliveries
  for select to authenticated
  using (
    incident_id in (
      select id from public.incidents
      where family_id = public.current_user_family_id()
    )
  );
