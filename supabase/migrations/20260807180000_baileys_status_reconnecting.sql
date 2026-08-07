-- Adiciona 'reconnecting' ao CHECK de baileys_status.
-- Necessário para T5.6: o health check distingue "caiu e está tentando voltar"
-- de "caiu de vez" — a tela de Proteção exibe isso de forma diferente.
alter table protected_persons
  drop constraint if exists protected_persons_baileys_status_check;

alter table protected_persons
  add constraint protected_persons_baileys_status_check
  check (baileys_status in ('unpaired', 'pairing', 'paired', 'disconnected', 'reconnecting'));
