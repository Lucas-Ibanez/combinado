-- =============================================================================
-- T5.2 — QR de pareamento persistido em protected_persons
--
-- Durante o pareamento (baileys_status='pairing'), o gateway grava aqui o QR
-- (data URL / string curta) para que o app do guardião possa exibir. É um
-- campo transitório: fica null quando o pareamento termina (paired ou falhou).
-- =============================================================================

alter table public.protected_persons
add column if not exists baileys_pairing_qr text;
