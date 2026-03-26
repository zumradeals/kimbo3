-- Soumission BL -> AAL via fonction sécurisée pour fiabiliser la transition de workflow
CREATE OR REPLACE FUNCTION public.submit_bl_to_aal(_bl_id uuid)
RETURNS public.bons_livraison
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _bl public.bons_livraison%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  IF NOT (public.is_logistics(auth.uid()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Seuls la logistique ou un administrateur peuvent soumettre un BL à l''AAL';
  END IF;

  SELECT * INTO _bl
  FROM public.bons_livraison
  WHERE id = _bl_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BL introuvable';
  END IF;

  IF _bl.status NOT IN ('brouillon'::public.bl_status, 'prepare'::public.bl_status) THEN
    RAISE EXCEPTION 'Le BL ne peut être soumis à l''AAL que depuis les statuts Brouillon ou Préparé';
  END IF;

  UPDATE public.bons_livraison
  SET status = 'soumis_aal'::public.bl_status,
      updated_at = now()
  WHERE id = _bl_id
  RETURNING * INTO _bl;

  RETURN _bl;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.submit_bl_to_aal(uuid) TO authenticated;