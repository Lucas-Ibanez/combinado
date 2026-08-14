-- T10.1: RPC transacional para criar o círculo familiar completo.
-- Chamado pelo edge function setup-family durante o onboarding.

CREATE OR REPLACE FUNCTION setup_family_tx(
  p_guardian_id     uuid,
  p_family_name     text,
  p_guardian_name   text,
  p_guardian_phone  text,
  p_protected_name  text,
  p_protected_phone text,
  p_code_word       text,
  p_code_hint       text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id      uuid;
  v_protected_id   uuid;
  v_existing       uuid;
BEGIN
  -- Guard: impedir setup duplicado
  SELECT family_id INTO v_existing
    FROM guardians
   WHERE id = p_guardian_id;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Guardian already has a family'
      USING ERRCODE = 'P0003';
  END IF;

  -- 1. Criar família
  INSERT INTO families (name)
  VALUES (p_family_name)
  RETURNING id INTO v_family_id;

  -- 2. Criar/atualizar registro de guardião
  INSERT INTO guardians (id, family_id, display_name, phone, is_primary)
  VALUES (p_guardian_id, v_family_id, p_guardian_name, p_guardian_phone, true)
  ON CONFLICT (id) DO UPDATE SET
    family_id    = v_family_id,
    display_name = p_guardian_name,
    phone        = p_guardian_phone,
    is_primary   = true;

  -- 3. Criar protegido
  INSERT INTO protected_persons (family_id, display_name, phone)
  VALUES (v_family_id, p_protected_name, p_protected_phone)
  RETURNING id INTO v_protected_id;

  -- 4. Vínculo guardião ↔ protegido
  INSERT INTO guardian_links (guardian_id, protected_person_id, role)
  VALUES (p_guardian_id, v_protected_id, 'primary');

  -- 5. Senha combinada
  INSERT INTO secrets_family (family_id, encrypted_secret, hint, changed_by)
  VALUES (v_family_id, p_code_word, p_code_hint, p_guardian_id);

  -- 6. Audit log
  INSERT INTO audit_log (family_id, actor_id, actor_type, action, target_type, target_id, metadata)
  VALUES (
    v_family_id, p_guardian_id, 'guardian', 'setup_family', 'family', v_family_id,
    jsonb_build_object('protected_person_id', v_protected_id)
  );

  RETURN jsonb_build_object(
    'family_id',          v_family_id,
    'guardian_id',        p_guardian_id,
    'protected_person_id', v_protected_id
  );
END;
$$;
