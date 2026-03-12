-- Fix trigger 1: notify_on_da_rejected_dg - uses non-existent 'rejetee_dg'
-- The actual status for DG/DAF rejection is 'refusee_finance'
CREATE OR REPLACE FUNCTION public.notify_on_da_rejected_dg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _target_user RECORD;
BEGIN
  IF NEW.status = 'refusee_finance' AND (OLD.status IS DISTINCT FROM 'refusee_finance') THEN
    FOR _target_user IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('daf', 'aal')
    LOOP
      PERFORM create_notification(
        _target_user.user_id,
        'da_rejected',
        'DA rejetée',
        'La DA ' || NEW.reference || ' a été rejetée. Motif : ' || COALESCE(NEW.dg_comment, NEW.finance_decision_comment, 'Non précisé'),
        '/demandes-achat/' || NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix trigger 2: notify_on_da_validated_dg - uses non-existent 'validee_dg'
-- The actual status for DG validation is 'validee_finance' (DG validates after DAF)
CREATE OR REPLACE FUNCTION public.notify_on_da_validated_dg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _daf_user RECORD;
  _besoin RECORD;
BEGIN
  IF NEW.status = 'validee_finance' AND OLD.status = 'en_attente_dg' THEN
    SELECT b.title, b.user_id INTO _besoin FROM public.besoins b WHERE b.id = NEW.besoin_id;
    
    FOR _daf_user IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role = 'daf'
    LOOP
      PERFORM create_notification(
        _daf_user.user_id,
        'da_validated_finance',
        'DA validée par le DG',
        'La DA ' || NEW.reference || ' a été approuvée par le Directeur Général.',
        '/demandes-achat/' || NEW.id
      );
    END LOOP;
    
    IF _besoin.user_id IS NOT NULL THEN
      PERFORM create_notification(
        _besoin.user_id,
        'da_validated_finance',
        'DA approuvée par le DG',
        'La DA ' || NEW.reference || ' issue de votre besoin "' || COALESCE(_besoin.title, '') || '" a été approuvée par le DG.',
        '/demandes-achat/' || NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Now fix the stuck DAs - set brouillon DAs from besoins to soumise
UPDATE public.demandes_achat 
SET status = 'soumise', 
    submitted_at = COALESCE(submitted_at, now())
WHERE status = 'brouillon' 
  AND besoin_id IS NOT NULL;