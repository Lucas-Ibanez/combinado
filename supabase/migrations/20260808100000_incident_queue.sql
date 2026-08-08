-- =============================================================================
-- T6.6 — Fila de incidentes para o Orchestrator
--
-- O Risk Worker publica decisões review/block aqui; o Incident Orchestrator
-- (F7) consome e cria/atualiza incidentes.
-- =============================================================================
select pgmq.create('incident_queue');
select pgmq.create('incident_queue_dlq');
