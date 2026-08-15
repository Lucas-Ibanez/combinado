-- T11.1: Envelope encryption das chaves do Baileys
-- Schema isolado — acessível apenas via service_role (Gateway).
-- Nenhuma RLS aqui: o acesso é controlado pelo fato de que só o serviço Node
-- com service_role pode tocar neste schema. O app (anon key) não enxerga.

CREATE SCHEMA IF NOT EXISTS vault_baileys;

-- =============================================================================
-- 1. data_keys — uma DEK (Data Encryption Key) por entidade
--    Cada protegido tem sua própria DEK, cifrada com a KEK (master key do env).
--    A sessão oficial do Combinado usa entity_id = '_official'.
-- =============================================================================
CREATE TABLE vault_baileys.data_keys (
  entity_id       text PRIMARY KEY,
  encrypted_dek   bytea NOT NULL,
  dek_iv          bytea NOT NULL,
  dek_auth_tag    bytea NOT NULL,
  kek_version     int NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  rotated_at      timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 2. auth_state — blobs de estado do Baileys cifrados com a DEK da entidade
--    Armazena creds (key_type='creds', key_id='') e todas as signal keys
--    (pre-keys, sessions, sender-keys, app-state-sync-keys, etc.)
-- =============================================================================
CREATE TABLE vault_baileys.auth_state (
  entity_id       text NOT NULL REFERENCES vault_baileys.data_keys(entity_id) ON DELETE CASCADE,
  key_type        text NOT NULL,
  key_id          text NOT NULL DEFAULT '',
  encrypted_data  bytea NOT NULL,
  data_iv         bytea NOT NULL,
  data_auth_tag   bytea NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_id, key_type, key_id)
);

-- =============================================================================
-- 3. key_access_log — trilha de auditoria de acesso às chaves
--    Registra QUEM acessou QUAL chave e QUANDO, sem logar o conteúdo.
-- =============================================================================
CREATE TABLE vault_baileys.key_access_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_id   text NOT NULL,
  operation   text NOT NULL CHECK (operation IN ('create_dek', 'load_dek', 'rotate_dek', 'save_creds', 'load_creds', 'save_keys', 'load_keys', 'delete')),
  key_count   int DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_key_access_log_entity ON vault_baileys.key_access_log(entity_id);
CREATE INDEX idx_key_access_log_created ON vault_baileys.key_access_log(created_at);

-- =============================================================================
-- 4. Função para rotação de KEK
--    Chamada manualmente quando a master key muda. A re-cifração das DEKs
--    acontece no código do serviço — esta função só atualiza o kek_version.
-- =============================================================================
CREATE OR REPLACE FUNCTION vault_baileys.bump_kek_version(p_entity_id text, p_new_encrypted_dek bytea, p_new_iv bytea, p_new_auth_tag bytea, p_new_version int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault_baileys
AS $$
BEGIN
  UPDATE data_keys
     SET encrypted_dek = p_new_encrypted_dek,
         dek_iv        = p_new_iv,
         dek_auth_tag  = p_new_auth_tag,
         kek_version   = p_new_version,
         rotated_at    = now()
   WHERE entity_id = p_entity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entity not found: %', p_entity_id;
  END IF;

  INSERT INTO key_access_log (entity_id, operation)
  VALUES (p_entity_id, 'rotate_dek');
END;
$$;
