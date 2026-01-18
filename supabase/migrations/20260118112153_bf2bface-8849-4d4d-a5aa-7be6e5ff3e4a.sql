-- ============================================
-- EB - Correctifs hiérarchie + identités publiques + validation strictement routée
-- ============================================

-- 1) DROP + CREATE get_public_profiles avec fonction + photo_url (identité complète)
DROP FUNCTION IF EXISTS public.get_public_profiles(uuid[]);

CREATE FUNCTION public.get_public_profiles(_user_ids uuid[])
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  department_name text,
  fonction text,
  photo_url text,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    d.name AS department_name,
    p.fonction,
    p.photo_url,
    p.email
  FROM public.profiles p
  LEFT JOIN public.departments d ON d.id = p.department_id
  WHERE p.id = ANY(_user_ids);
$$;

-- 2) Restreindre la validation: uniquement Admin OU chef hiérarchique direct
CREATE OR REPLACE FUNCTION public.can_validate_expression(_expression_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.expressions_besoin e
      WHERE e.id = _expression_id
        AND public.is_manager_of(auth.uid(), e.user_id)
    );
$$;

-- 3) Bloquer toute soumission si le demandeur n'a pas de chef hiérarchique
CREATE OR REPLACE FUNCTION public.submit_expression_for_validation(_expression_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _expression RECORD;
  _chef_id uuid;
BEGIN
  SELECT * INTO _expression FROM public.expressions_besoin WHERE id = _expression_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expression non trouvée';
  END IF;

  IF _expression.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez soumettre que vos propres expressions';
  END IF;

  IF _expression.status != 'brouillon' THEN
    RAISE EXCEPTION 'Seules les expressions en brouillon peuvent être soumises';
  END IF;

  SELECT p.chef_hierarchique_id
  INTO _chef_id
  FROM public.profiles p
  WHERE p.id = _expression.user_id;

  IF _chef_id IS NULL THEN
    RAISE EXCEPTION 'Aucun responsable hiérarchique n''est défini pour votre compte. Veuillez contacter l''administration pour compléter votre profil.';
  END IF;

  UPDATE public.expressions_besoin
  SET status = 'soumis',
      submitted_at = now(),
      updated_at = now()
  WHERE id = _expression_id;

  RETURN true;
END;
$$;

-- 4) Garde-fou DB: empêcher un INSERT/UPDATE en statut 'soumis' sans chef (hors admin)
CREATE OR REPLACE FUNCTION public.enforce_expression_manager_on_submit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _chef_id uuid;
BEGIN
  IF NEW.status = 'soumis' THEN
    SELECT p.chef_hierarchique_id
    INTO _chef_id
    FROM public.profiles p
    WHERE p.id = NEW.user_id;

    IF _chef_id IS NULL AND NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Impossible de soumettre: aucun responsable hiérarchique n''est défini pour ce demandeur.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_expression_manager_on_submit ON public.expressions_besoin;
CREATE TRIGGER trg_enforce_expression_manager_on_submit
BEFORE INSERT OR UPDATE OF status ON public.expressions_besoin
FOR EACH ROW
EXECUTE FUNCTION public.enforce_expression_manager_on_submit();

-- 5) Permissions
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_validate_expression(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_expression_for_validation(uuid) TO authenticated;