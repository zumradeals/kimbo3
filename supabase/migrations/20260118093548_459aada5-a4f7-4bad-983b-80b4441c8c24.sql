-- Create RPC to submit a validated expression to Logistics by creating a Besoin + Besoin ligne
-- This is SECURITY DEFINER to avoid relying on client-side RLS for cross-user creation.

CREATE OR REPLACE FUNCTION public.submit_expression_to_logistics(_expression_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.expressions_besoin%ROWTYPE;
  new_besoin_id uuid;
  besoin_description text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only admins / hierarchical managers / department heads can submit
  IF NOT public.can_validate_expression(_expression_id) THEN
    RAISE EXCEPTION 'Action non autorisée';
  END IF;

  SELECT *
  INTO e
  FROM public.expressions_besoin
  WHERE id = _expression_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expression introuvable';
  END IF;

  -- Idempotent: if already linked, just return the existing Besoin id
  IF e.besoin_id IS NOT NULL THEN
    RETURN e.besoin_id;
  END IF;

  IF e.status <> 'validee' THEN
    RAISE EXCEPTION 'Expression non validée';
  END IF;

  IF e.quantite IS NULL OR e.quantite <= 0 THEN
    RAISE EXCEPTION 'Quantité manquante';
  END IF;

  besoin_description := concat_ws(E'\n\n',
    nullif(coalesce(e.commentaire, ''), ''),
    CASE
      WHEN e.precision_technique IS NOT NULL AND btrim(e.precision_technique) <> ''
        THEN 'Précisions techniques: ' || e.precision_technique
      ELSE NULL
    END,
    'Source: Expression de besoin'
  );

  -- Create Besoin for the requester (employee)
  INSERT INTO public.besoins (
    title,
    description,
    category,
    urgency,
    user_id,
    department_id,
    objet_besoin,
    estimated_quantity,
    unit
  )
  VALUES (
    left(coalesce(e.nom_article, 'Besoin interne'), 200),
    coalesce(besoin_description, 'Source: Expression de besoin'),
    'materiel',
    'normale',
    e.user_id,
    e.department_id,
    e.nom_article,
    e.quantite,
    coalesce(e.unite, 'unité')
  )
  RETURNING id INTO new_besoin_id;

  -- Create a single Besoin line
  INSERT INTO public.besoin_lignes (
    besoin_id,
    designation,
    category,
    quantity,
    unit,
    urgency
  )
  VALUES (
    new_besoin_id,
    e.nom_article,
    'materiel',
    e.quantite,
    coalesce(e.unite, 'unité'),
    'normale'
  );

  -- Link expression -> besoin
  UPDATE public.expressions_besoin
  SET besoin_id = new_besoin_id
  WHERE id = _expression_id;

  RETURN new_besoin_id;
END;
$$;

-- Explicit grants (safe default). SECURITY DEFINER still enforces authorization via can_validate_expression.
GRANT EXECUTE ON FUNCTION public.submit_expression_to_logistics(uuid) TO authenticated;