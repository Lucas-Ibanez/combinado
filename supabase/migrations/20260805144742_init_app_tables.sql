-- =============================================================================
-- T1.2 — Migration inicial: tabelas de aplicação do Combinado MVP
-- =============================================================================

-- Função utilitária: atualiza updated_at automaticamente
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =============================================================================
-- 1. families — unidade organizadora (base da RLS)
-- =============================================================================
create table public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger families_updated_at
  before update on public.families
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 2. guardians — usuários guardiões (id = auth.users.id)
-- =============================================================================
create table public.guardians (
  id                 uuid primary key references auth.users(id) on delete cascade,
  family_id          uuid not null references public.families(id) on delete cascade,
  display_name       text not null,
  phone              text,
  push_subscription  jsonb,
  is_primary         boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_guardians_family_id on public.guardians(family_id);

create trigger guardians_updated_at
  before update on public.guardians
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 3. protected_persons — os protegidos (idosos)
-- =============================================================================
create table public.protected_persons (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families(id) on delete cascade,
  display_name    text not null,
  phone           text,
  baileys_status  text not null default 'unpaired'
                  check (baileys_status in ('unpaired', 'pairing', 'paired', 'disconnected')),
  opted_in        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_protected_persons_family_id on public.protected_persons(family_id);

create trigger protected_persons_updated_at
  before update on public.protected_persons
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 4. guardian_links — N:N guardião ↔ protegido (com papel e permissões)
-- =============================================================================
create table public.guardian_links (
  id                   uuid primary key default gen_random_uuid(),
  guardian_id          uuid not null references public.guardians(id) on delete cascade,
  protected_person_id  uuid not null references public.protected_persons(id) on delete cascade,
  role                 text not null default 'primary'
                       check (role in ('primary', 'secondary')),
  permissions          jsonb not null default '{}',
  created_at           timestamptz not null default now(),

  unique (guardian_id, protected_person_id)
);

create index idx_guardian_links_guardian_id on public.guardian_links(guardian_id);
create index idx_guardian_links_protected_person_id on public.guardian_links(protected_person_id);

-- =============================================================================
-- 5. secrets_family — palavra-código da família (1:1 com family)
-- =============================================================================
create table public.secrets_family (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null unique references public.families(id) on delete cascade,
  encrypted_secret  text not null,
  hint              text,
  changed_by        uuid references public.guardians(id) on delete set null,
  changed_at        timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger secrets_family_updated_at
  before update on public.secrets_family
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 6. incidents — núcleo: estado, severidade, timestamps
-- =============================================================================
create table public.incidents (
  id                   uuid primary key default gen_random_uuid(),
  family_id            uuid not null references public.families(id) on delete cascade,
  protected_person_id  uuid not null references public.protected_persons(id) on delete cascade,
  status               text not null default 'open'
                       check (status in ('open', 'notifying', 'acknowledged', 'escalated', 'expired', 'closed')),
  severity             text not null default 'medium'
                       check (severity in ('low', 'medium', 'high', 'critical')),
  source_contact       text,
  summary              text,
  opened_at            timestamptz not null default now(),
  acknowledged_at      timestamptz,
  acknowledged_by      uuid references public.guardians(id) on delete set null,
  closed_at            timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_incidents_family_id on public.incidents(family_id);
create index idx_incidents_protected_person_id on public.incidents(protected_person_id);
create index idx_incidents_status on public.incidents(status);

create trigger incidents_updated_at
  before update on public.incidents
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 7. incident_deliveries — cada degrau da escada de entrega
-- =============================================================================
create table public.incident_deliveries (
  id                    uuid primary key default gen_random_uuid(),
  incident_id           uuid not null references public.incidents(id) on delete cascade,
  channel               text not null
                        check (channel in ('push', 'whatsapp', 'sms', 'call')),
  target_guardian_id    uuid references public.guardians(id) on delete set null,
  target_phone          text,
  step_order            int not null,
  sent_at               timestamptz,
  delivered_at          timestamptz,
  acknowledged_at       timestamptz,
  acknowledged_by       uuid references public.guardians(id) on delete set null,
  failure_reason        text,
  escalation_deadline   timestamptz,
  created_at            timestamptz not null default now()
);

create index idx_incident_deliveries_incident_id on public.incident_deliveries(incident_id);

-- =============================================================================
-- 8. risk_events — decisões do motor de risco (sinal, NUNCA conteúdo bruto)
-- =============================================================================
create table public.risk_events (
  id                   uuid primary key default gen_random_uuid(),
  family_id            uuid not null references public.families(id) on delete cascade,
  protected_person_id  uuid not null references public.protected_persons(id) on delete cascade,
  incident_id          uuid references public.incidents(id) on delete set null,
  signals              jsonb not null default '{}',
  severity             text not null
                       check (severity in ('low', 'medium', 'high', 'critical')),
  decision             text not null,
  pipeline_version     text,
  processed_at         timestamptz not null default now(),
  created_at           timestamptz not null default now()
);

create index idx_risk_events_family_id on public.risk_events(family_id);
create index idx_risk_events_incident_id on public.risk_events(incident_id);

-- =============================================================================
-- 9. simulations — ensaios do hábito
-- =============================================================================
create table public.simulations (
  id                   uuid primary key default gen_random_uuid(),
  family_id            uuid not null references public.families(id) on delete cascade,
  protected_person_id  uuid not null references public.protected_persons(id) on delete cascade,
  requested_by         uuid not null references public.guardians(id) on delete cascade,
  status               text not null default 'scheduled'
                       check (status in ('scheduled', 'sent', 'responded', 'expired')),
  scheduled_at         timestamptz,
  sent_at              timestamptz,
  responded_at         timestamptz,
  response_correct     boolean,
  created_at           timestamptz not null default now()
);

create index idx_simulations_family_id on public.simulations(family_id);

-- =============================================================================
-- 10. audit_log — toda intervenção e acesso sensível
-- =============================================================================
create table public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families(id) on delete cascade,
  actor_id     uuid,
  actor_type   text not null check (actor_type in ('guardian', 'system', 'service')),
  action       text not null,
  target_type  text,
  target_id    uuid,
  metadata     jsonb not null default '{}',
  ip_address   text,
  created_at   timestamptz not null default now()
);

create index idx_audit_log_family_id on public.audit_log(family_id);
create index idx_audit_log_action on public.audit_log(action);
