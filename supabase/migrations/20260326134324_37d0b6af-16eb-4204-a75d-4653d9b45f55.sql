CREATE OR REPLACE FUNCTION public.notify_logistics_on_bl_rejected()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _logistics_user RECORD;
BEGIN
  IF NEW.status IN ('refusee'::public.bl_status, 'refuse_daf'::public.bl_status)
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    FOR _logistics_user IN
      SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role IN ('responsable_logistique', 'agent_logistique')
    LOOP
      PERFORM create_notification(
        _logistics_user.user_id,
        'bl_created',
        'BL rejeté',
        'Le BL ' || NEW.reference || ' a été rejeté. Motif : ' || COALESCE(NEW.rejection_reason, 'Non précisé'),
        '/bons-livraison/' || NEW.id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;