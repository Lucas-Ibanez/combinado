-- =============================================================================
-- T1.3 — Schema isolado para as chaves do Baileys
--
-- Material criptográfico da sessão WhatsApp, fora do schema public.
-- Só o Session Gateway (via service_role) toca aqui.
-- anon e authenticated NÃO têm acesso.
-- Envelope encryption das chaves vem na F11/T11.1.
-- =============================================================================

-- 1. Criar o schema isolado
create schema if not exists vault_baileys;

-- 2. Revogar qualquer acesso de anon e authenticated
revoke all on schema vault_baileys from anon, authenticated;
revoke all on all tables in schema vault_baileys from anon, authenticated;
alter default privileges in schema vault_baileys
  revoke all on tables from anon, authenticated;

-- 3. Garantir acesso apenas para service_role e postgres
grant usage on schema vault_baileys to service_role;
grant all on all tables in schema vault_baileys to service_role;
alter default privileges in schema vault_baileys
  grant all on tables to service_role;

-- 4. Tabela de sessões do Baileys
create table vault_baileys.baileys_sessions (
  id                   uuid primary key default gen_random_uuid(),
  protected_person_id  uuid not null references public.protected_persons(id) on delete cascade,
  session_data         jsonb not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  unique (protected_person_id)
);

create trigger baileys_sessions_updated_at
  before update on vault_baileys.baileys_sessions
  for each row execute function public.set_updated_at();
