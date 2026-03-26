CREATE OR REPLACE FUNCTION public.notify_creator_on_bl_cancelled()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _besoin RECORD;
BEGIN
  IF NEW.status = 'annulee' AND (OLD.status IS DISTINCT FROM 'annulee') THEN
    SELECT b.title, b.user_id INTO _besoin
    FROM public.besoins b
    WHERE b.id = NEW.besoin_id;

    IF _besoin.user_id IS NOT NULL THEN
      PERFORM create_notification(
        _besoin.user_id,
        'bl_created',
        'BL annulé',
        'Le BL ' || NEW.reference || ' pour votre besoin "' || COALESCE(_besoin.title, '') || '" a été annulé. Motif : ' || COALESCE(NEW.cancellation_reason, 'Non précisé'),
        '/bons-livraison/' || NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;