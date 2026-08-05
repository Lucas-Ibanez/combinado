-- =============================================================================
-- T1.5 — Habilitar PGMQ e criar as filas do MVP
--
-- Três filas principais + três dead-letter queues:
--   risk_queue       — eventos capturados → Risk Worker
--   command_outbox   — jobs publicados pela Command API → serviço
--   delivery_queue   — passos da escada de entrega
-- =============================================================================

-- 1. Habilitar a extensão PGMQ
create extension if not exists pgmq;

-- 2. Criar as filas principais
select pgmq.create('risk_queue');
select pgmq.create('command_outbox');
select pgmq.create('delivery_queue');

-- 3. Criar as dead-letter queues (mensagens que falharam N vezes)
select pgmq.create('risk_queue_dlq');
select pgmq.create('command_outbox_dlq');
select pgmq.create('delivery_queue_dlq');
