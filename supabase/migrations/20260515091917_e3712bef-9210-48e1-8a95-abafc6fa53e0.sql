-- 1. Add parent reference column
ALTER TABLE public.besoins
  ADD COLUMN IF NOT EXISTS parent_besoin_id uuid REFERENCES public.besoins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_besoins_parent_besoin_id ON public.besoins(parent_besoin_id);

-- 2. RPC to split a besoin
CREATE OR REPLACE FUNCTION public.split_besoin(
  _besoin_id uuid,
  _ligne_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_parent public.besoins%ROWTYPE;
  v_new_id uuid;
  v_count_total int;
  v_count_remaining int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF NOT (public.is_logistics(v_user) OR public.is_admin(v_user)) THEN
    RAISE EXCEPTION 'Seules la Logistique ou l''Administration peuvent scinder un besoin';
  END IF;

  SELECT * INTO v_parent FROM public.besoins WHERE id = _besoin_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Besoin introuvable';
  END IF;

  IF v_parent.status <> 'accepte' OR v_parent.is_locked THEN
    RAISE EXCEPTION 'Seul un besoin accepté et non verrouillé peut être scindé';
  END IF;

  IF _ligne_ids IS NULL OR array_length(_ligne_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Aucune ligne sélectionnée pour la scission';
  END IF;

  -- Verify all lines belong to this besoin
  SELECT COUNT(*) INTO v_count_total
  FROM public.besoin_lignes
  WHERE id = ANY(_ligne_ids) AND besoin_id = _besoin_id;

  IF v_count_total <> array_length(_ligne_ids, 1) THEN
    RAISE EXCEPTION 'Certaines lignes sélectionnées n''appartiennent pas à ce besoin';
  END IF;

  -- Ensure we leave at least one line in the parent
  SELECT COUNT(*) INTO v_count_remaining
  FROM public.besoin_lignes
  WHERE besoin_id = _besoin_id AND id <> ALL(_ligne_ids);

  IF v_count_remaining = 0 THEN
    RAISE EXCEPTION 'Impossible de scinder : au moins une ligne doit rester dans le besoin d''origine';
  END IF;

  -- Create the child besoin (clone metadata)
  INSERT INTO public.besoins (
    user_id, department_id, title, description, category, urgency,
    desired_date, projet_id, status, parent_besoin_id,
    intended_usage, site_projet, lieu_livraison,
    taken_by, taken_at, decided_by, decided_at
  )
  VALUES (
    v_parent.user_id,
    v_parent.department_id,
    v_parent.title || ' (complément achat)',
    'Scission du besoin parent — lignes à acheter (non disponibles en stock).' ||
      CASE WHEN v_parent.description IS NOT NULL AND v_parent.description <> ''
           THEN E'\n\n— Description d''origine —\n' || v_parent.description
           ELSE '' END,
    v_parent.category,
    v_parent.urgency,
    v_parent.desired_date,
    v_parent.projet_id,
    'accepte'::besoin_status,
    v_parent.id,
    v_parent.intended_usage,
    v_parent.site_projet,
    v_parent.lieu_livraison,
    v_user, now(),
    v_user, now()
  )
  RETURNING id INTO v_new_id;

  -- Move the selected lines to the new besoin
  UPDATE public.besoin_lignes
  SET besoin_id = v_new_id
  WHERE id = ANY(_ligne_ids) AND besoin_id = _besoin_id;

  -- Audit log
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values)
  VALUES (
    v_user,
    'split_besoin',
    'besoins',
    _besoin_id,
    jsonb_build_object(
      'parent_besoin_id', _besoin_id,
      'child_besoin_id', v_new_id,
      'moved_ligne_ids', to_jsonb(_ligne_ids)
    )
  );

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.split_besoin(uuid, uuid[]) TO authenticated;