
-- Fix notify_on_bl_delivered: wrong argument order for create_notification
CREATE OR REPLACE FUNCTION public.notify_on_bl_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _dg_users UUID[];
  _daf_users UUID[];
  _user_id UUID;
BEGIN
  IF NEW.status = 'livre' AND (OLD.status IS NULL OR OLD.status != 'livre') THEN
    SELECT ARRAY_AGG(user_id) INTO _dg_users
    FROM public.user_roles WHERE role = 'dg';

    SELECT ARRAY_AGG(user_id) INTO _daf_users
    FROM public.user_roles WHERE role = 'daf';

    IF _dg_users IS NOT NULL THEN
      FOREACH _user_id IN ARRAY _dg_users LOOP
        PERFORM public.create_notification(
          _user_id,
          'bl_delivered',
          'BL livré',
          'Le bon de livraison ' || NEW.reference || ' a été livré.',
          '/bons-livraison/' || NEW.id
        );
      END LOOP;
    END IF;

    IF _daf_users IS NOT NULL THEN
      FOREACH _user_id IN ARRAY _daf_users LOOP
        PERFORM public.create_notification(
          _user_id,
          'bl_delivered',
          'BL livré',
          'Le bon de livraison ' || NEW.reference || ' a été livré.',
          '/bons-livraison/' || NEW.id
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Also fix notify_on_bl_partial which likely has the same issue
CREATE OR REPLACE FUNCTION public.notify_on_bl_partial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _logistics_users UUID[];
  _user_id UUID;
BEGIN
  IF NEW.status = 'livree_partiellement' AND (OLD.status IS NULL OR OLD.status != 'livree_partiellement') THEN
    SELECT ARRAY_AGG(ur.user_id) INTO _logistics_users
    FROM public.user_roles ur
    WHERE ur.role IN ('responsable_logistique', 'agent_logistique');

    IF _logistics_users IS NOT NULL THEN
      FOREACH _user_id IN ARRAY _logistics_users LOOP
        PERFORM public.create_notification(
          _user_id,
          'bl_partial',
          'BL partiellement livré',
          'Le BL ' || NEW.reference || ' a été partiellement livré.',
          '/bons-livraison/' || NEW.id
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
