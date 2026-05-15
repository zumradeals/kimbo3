CREATE OR REPLACE FUNCTION public.split_besoin_qty(
  _besoin_id uuid,
  _moves jsonb
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
  v_move jsonb;
  v_ligne_id uuid;
  v_qty_move numeric;
  v_ligne public.besoin_lignes%ROWTYPE;
  v_total_moved numeric := 0;
  v_remaining_in_parent numeric := 0;
  v_total_lines int;
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

  IF _moves IS NULL OR jsonb_array_length(_moves) = 0 THEN
    RAISE EXCEPTION 'Aucune ligne à déplacer';
  END IF;

  -- Pre-validate every entry and accumulate totals
  FOR v_move IN SELECT * FROM jsonb_array_elements(_moves)
  LOOP
    v_ligne_id := (v_move->>'ligne_id')::uuid;
    v_qty_move := COALESCE((v_move->>'quantity')::numeric, 0);

    IF v_qty_move <= 0 THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_ligne FROM public.besoin_lignes
      WHERE id = v_ligne_id AND besoin_id = _besoin_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ligne % introuvable dans ce besoin', v_ligne_id;
    END IF;

    IF v_qty_move > v_ligne.quantity THEN
      RAISE EXCEPTION 'Quantité à déplacer (%) > quantité disponible (%) sur la ligne %',
        v_qty_move, v_ligne.quantity, v_ligne.designation;
    END IF;

    v_total_moved := v_total_moved + v_qty_move;
  END LOOP;

  IF v_total_moved <= 0 THEN
    RAISE EXCEPTION 'Aucune quantité positive à déplacer';
  END IF;

  -- Compute what would remain in parent (sum of qty - moved per line, plus untouched lines)
  SELECT COALESCE(SUM(quantity), 0) INTO v_remaining_in_parent
    FROM public.besoin_lignes WHERE besoin_id = _besoin_id;
  v_remaining_in_parent := v_remaining_in_parent - v_total_moved;

  IF v_remaining_in_parent <= 0 THEN
    RAISE EXCEPTION 'Impossible de scinder : au moins une quantité doit rester dans le besoin d''origine';
  END IF;

  -- Create the child besoin
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
    'Scission du besoin parent — lignes (ou quantités) à acheter, non disponibles en stock.' ||
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

  -- Apply each move
  FOR v_move IN SELECT * FROM jsonb_array_elements(_moves)
  LOOP
    v_ligne_id := (v_move->>'ligne_id')::uuid;
    v_qty_move := COALESCE((v_move->>'quantity')::numeric, 0);

    IF v_qty_move <= 0 THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_ligne FROM public.besoin_lignes WHERE id = v_ligne_id;

    IF v_qty_move = v_ligne.quantity THEN
      -- Move the whole line
      UPDATE public.besoin_lignes SET besoin_id = v_new_id WHERE id = v_ligne.id;
    ELSE
      -- Partial: clone into child with v_qty_move, reduce parent line
      INSERT INTO public.besoin_lignes (
        besoin_id, designation, quantity, unit, justification,
        urgency, category, article_stock_id, destination
      )
      VALUES (
        v_new_id, v_ligne.designation, v_qty_move, v_ligne.unit, v_ligne.justification,
        v_ligne.urgency, v_ligne.category, v_ligne.article_stock_id, v_ligne.destination
      );
      UPDATE public.besoin_lignes
        SET quantity = v_ligne.quantity - v_qty_move
        WHERE id = v_ligne.id;
    END IF;
  END LOOP;

  -- Final safety check: parent must still have at least one line
  SELECT COUNT(*) INTO v_total_lines FROM public.besoin_lignes WHERE besoin_id = _besoin_id;
  IF v_total_lines = 0 THEN
    RAISE EXCEPTION 'Erreur de scission : le besoin parent est vide';
  END IF;

  -- Audit
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values)
  VALUES (
    v_user, 'split_besoin_qty', 'besoins', _besoin_id,
    jsonb_build_object(
      'parent_besoin_id', _besoin_id,
      'child_besoin_id', v_new_id,
      'moves', _moves
    )
  );

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.split_besoin_qty(uuid, jsonb) TO authenticated;