-- Supprimer le trigger d'abord, puis la fonction
DROP TRIGGER IF EXISTS trg_enforce_expression_manager_on_submit ON public.expressions_besoin;
DROP TRIGGER IF EXISTS trigger_enforce_expression_manager ON public.expressions_besoin;
DROP FUNCTION IF EXISTS public.enforce_expression_manager_on_submit() CASCADE;

-- Mettre à jour la fonction submit_expression_for_validation pour ne plus bloquer
CREATE OR REPLACE FUNCTION public.submit_expression_for_validation(_expression_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _expression RECORD;
BEGIN
  -- Récupérer l'expression
  SELECT * INTO _expression
  FROM public.expressions_besoin
  WHERE id = _expression_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expression non trouvée';
  END IF;

  -- Vérifier que l'utilisateur est le créateur
  IF _expression.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul le créateur peut soumettre cette expression';
  END IF;

  -- Vérifier le statut actuel
  IF _expression.status NOT IN ('brouillon') THEN
    RAISE EXCEPTION 'L''expression ne peut être soumise que depuis le statut brouillon';
  END IF;

  -- Mettre à jour le statut
  UPDATE public.expressions_besoin
  SET 
    status = 'soumis',
    submitted_at = now(),
    updated_at = now()
  WHERE id = _expression_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_expression_for_validation(uuid) TO authenticated;