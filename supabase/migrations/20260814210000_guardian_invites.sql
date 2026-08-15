-- T10.5: Convites para múltiplos guardiões (rede + redundância)

-- =============================================================================
-- 1. guardian_invites — convites para novos guardiões entrarem na família
-- =============================================================================
CREATE TABLE public.guardian_invites (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id            uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  invited_by           uuid NOT NULL REFERENCES public.guardians(id) ON DELETE CASCADE,
  protected_person_id  uuid NOT NULL REFERENCES public.protected_persons(id) ON DELETE CASCADE,
  invite_code          text NOT NULL UNIQUE,
  status               text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  accepted_by          uuid REFERENCES public.guardians(id) ON DELETE SET NULL,
  expires_at           timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_guardian_invites_family_id ON public.guardian_invites(family_id);
CREATE INDEX idx_guardian_invites_code ON public.guardian_invites(invite_code);

-- RLS
ALTER TABLE public.guardian_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guardian_invites_select" ON public.guardian_invites
  FOR SELECT TO authenticated
  USING (family_id = public.current_user_family_id());

CREATE POLICY "guardian_invites_insert" ON public.guardian_invites
  FOR INSERT TO authenticated
  WITH CHECK (family_id = public.current_user_family_id());

CREATE POLICY "guardian_invites_update" ON public.guardian_invites
  FOR UPDATE TO authenticated
  USING (family_id = public.current_user_family_id())
  WITH CHECK (family_id = public.current_user_family_id());

-- =============================================================================
-- 2. accept_invite_tx — RPC transacional para aceitar convite
--    SECURITY DEFINER: o novo guardião ainda não tem family_id, então RLS
--    bloquearia a leitura do convite. A RPC valida via código + user id.
-- =============================================================================
CREATE OR REPLACE FUNCTION accept_invite_tx(
  p_user_id       uuid,
  p_invite_code   text,
  p_display_name  text,
  p_phone         text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite        record;
  v_existing_fam  uuid;
  v_link_exists   boolean;
BEGIN
  -- 1. Buscar convite pendente e não expirado
  SELECT id, family_id, protected_person_id, invited_by, status, expires_at
    INTO v_invite
    FROM guardian_invites
   WHERE invite_code = p_invite_code
   FOR UPDATE;

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Invite not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'Invite already used or revoked'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE guardian_invites SET status = 'expired' WHERE id = v_invite.id;
    RAISE EXCEPTION 'Invite expired'
      USING ERRCODE = 'P0004';
  END IF;

  -- 2. Impedir que aceite o próprio convite
  IF v_invite.invited_by = p_user_id THEN
    RAISE EXCEPTION 'Cannot accept own invite'
      USING ERRCODE = 'P0005';
  END IF;

  -- 3. Verificar se já está em outra família
  SELECT family_id INTO v_existing_fam
    FROM guardians
   WHERE id = p_user_id;

  IF v_existing_fam IS NOT NULL AND v_existing_fam <> v_invite.family_id THEN
    RAISE EXCEPTION 'User already belongs to another family'
      USING ERRCODE = 'P0003';
  END IF;

  -- 4. Criar/atualizar registro de guardião (não-primário)
  INSERT INTO guardians (id, family_id, display_name, phone, is_primary)
  VALUES (p_user_id, v_invite.family_id, p_display_name, p_phone, false)
  ON CONFLICT (id) DO UPDATE SET
    family_id    = v_invite.family_id,
    display_name = p_display_name,
    phone        = COALESCE(p_phone, guardians.phone);

  -- 5. Criar vínculo guardião ↔ protegido como secondary (se não existe)
  SELECT EXISTS(
    SELECT 1 FROM guardian_links
     WHERE guardian_id = p_user_id
       AND protected_person_id = v_invite.protected_person_id
  ) INTO v_link_exists;

  IF NOT v_link_exists THEN
    INSERT INTO guardian_links (guardian_id, protected_person_id, role)
    VALUES (p_user_id, v_invite.protected_person_id, 'secondary');
  END IF;

  -- 6. Marcar convite como aceito
  UPDATE guardian_invites
     SET status = 'accepted',
         accepted_by = p_user_id
   WHERE id = v_invite.id;

  -- 7. Audit log
  INSERT INTO audit_log (family_id, actor_id, actor_type, action, target_type, target_id, metadata)
  VALUES (
    v_invite.family_id, p_user_id, 'guardian', 'accept_invite', 'guardian_invite', v_invite.id,
    jsonb_build_object(
      'protected_person_id', v_invite.protected_person_id,
      'invited_by', v_invite.invited_by
    )
  );

  RETURN jsonb_build_object(
    'family_id',          v_invite.family_id,
    'guardian_id',        p_user_id,
    'protected_person_id', v_invite.protected_person_id,
    'role',               'secondary'
  );
END;
$$;
