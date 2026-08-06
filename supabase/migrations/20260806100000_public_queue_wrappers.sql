-- =============================================================================
-- T4.3 — Wrappers públicos para a interface de fila (shared/queue)
--
-- O supabase-js só alcança limpo funções no schema `public`. Estas quatro
-- funções envelopam pgmq.send / pgmq.read / pgmq.delete e um deadletter
-- composto (send-to-dlq + delete-from-main) para o serviço consumir via
-- rpc() sem falar direto com o schema pgmq.
--
-- A interface (definida em apps/service/src/shared/queue) é a abstração real;
-- estes wrappers são só o adaptador. Se um dia trocarmos PGMQ por SQS/NATS,
-- basta trocar a implementação — a interface permanece.
-- =============================================================================

create or replace function public.queue_send(
  queue_name text,
  message jsonb
)
returns bigint
language plpgsql
security definer
set search_path = pgmq, public
as $$
declare
  v_msg_id bigint;
begin
  select pgmq.send(queue_name, message) into v_msg_id;
  return v_msg_id;
end;
$$;

create or replace function public.queue_read(
  queue_name text,
  visibility_seconds integer,
  batch_size integer
)
returns table(
  msg_id bigint,
  read_ct integer,
  enqueued_at timestamptz,
  vt timestamptz,
  message jsonb
)
language plpgsql
security definer
set search_path = pgmq, public
as $$
begin
  return query
  select r.msg_id, r.read_ct, r.enqueued_at, r.vt, r.message
  from pgmq.read(queue_name, visibility_seconds, batch_size) as r;
end;
$$;

create or replace function public.queue_delete(
  queue_name text,
  msg_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = pgmq, public
as $$
begin
  return pgmq.delete(queue_name, msg_id);
end;
$$;

-- Move a mensagem para a DLQ e remove da fila principal.
-- O chamador já tem o corpo em mãos (veio do consume), então passa aqui —
-- evita ida-e-volta pra reler.
create or replace function public.queue_deadletter(
  queue_name text,
  dlq_name text,
  msg_id bigint,
  message jsonb
)
returns void
language plpgsql
security definer
set search_path = pgmq, public
as $$
begin
  perform pgmq.send(dlq_name, message);
  perform pgmq.delete(queue_name, msg_id);
end;
$$;

-- Só o service_role executa estes wrappers. Anon/authenticated nunca —
-- filas são território do serviço, não do app.
revoke all on function public.queue_send(text, jsonb) from public, anon, authenticated;
revoke all on function public.queue_read(text, integer, integer) from public, anon, authenticated;
revoke all on function public.queue_delete(text, bigint) from public, anon, authenticated;
revoke all on function public.queue_deadletter(text, text, bigint, jsonb) from public, anon, authenticated;

grant execute on function public.queue_send(text, jsonb) to service_role;
grant execute on function public.queue_read(text, integer, integer) to service_role;
grant execute on function public.queue_delete(text, bigint) to service_role;
grant execute on function public.queue_deadletter(text, text, bigint, jsonb) to service_role;
