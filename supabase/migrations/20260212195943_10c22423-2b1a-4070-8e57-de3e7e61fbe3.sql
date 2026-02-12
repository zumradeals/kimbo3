
-- ==========================================
-- Phase 3: Notifications & Audit pour AAL
-- ==========================================

-- 1. Notification: DA chiffrée → Alerter les AAL
CREATE OR REPLACE FUNCTION public.notify_aal_on_da_chiffree()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _aal_user RECORD;
  _besoin RECORD;
BEGIN
  -- Only trigger when status changes to 'chiffree'
  IF NEW.status = 'chiffree' AND (OLD.status IS DISTINCT FROM 'chiffree') THEN
    -- Get besoin info
    SELECT b.title INTO _besoin
    FROM public.besoins b WHERE b.id = NEW.besoin_id;
    
    -- Notify all AAL users
    FOR _aal_user IN
      SELECT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role = 'aal'
    LOOP
      PERFORM create_notification(
        _aal_user.user_id,
        'da_chiffree',
        'DA chiffrée à valider',
        'La DA ' || NEW.reference || ' (' || COALESCE(_besoin.title, 'N/A') || ') est chiffrée et attend votre validation.',
        '/demandes-achat/' || NEW.id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_aal_on_da_chiffree
  AFTER UPDATE ON public.demandes_achat
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_aal_on_da_chiffree();

-- 2. Notification: AAL rejette → Alerter les Achats
CREATE OR REPLACE FUNCTION public.notify_achats_on_da_rejected_aal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _achats_user RECORD;
  _besoin RECORD;
BEGIN
  -- Only trigger when status changes to 'rejetee_aal'
  IF NEW.status = 'rejetee_aal' AND (OLD.status IS DISTINCT FROM 'rejetee_aal') THEN
    -- Get besoin info
    SELECT b.title, b.user_id INTO _besoin
    FROM public.besoins b WHERE b.id = NEW.besoin_id;
    
    -- Notify Achats users
    FOR _achats_user IN
      SELECT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role IN ('responsable_achats', 'agent_achats')
    LOOP
      PERFORM create_notification(
        _achats_user.user_id,
        'da_rejetee_aal',
        'DA rejetée par l''AAL',
        'La DA ' || NEW.reference || ' a été rejetée par l''AAL. Motif : ' || COALESCE(NEW.aal_rejection_reason, 'Non précisé'),
        '/demandes-achat/' || NEW.id
      );
    END LOOP;
    
    -- Also notify the besoin creator
    IF _besoin.user_id IS NOT NULL THEN
      PERFORM create_notification(
        _besoin.user_id,
        'da_rejetee_aal',
        'DA rejetée par l''AAL',
        'La DA ' || NEW.reference || ' issue de votre besoin "' || COALESCE(_besoin.title, '') || '" a été rejetée par l''AAL.',
        '/demandes-achat/' || NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_achats_on_da_rejected_aal
  AFTER UPDATE ON public.demandes_achat
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_achats_on_da_rejected_aal();

-- 3. Notification: AAL valide → Alerter AAL (confirmation)
CREATE OR REPLACE FUNCTION public.notify_on_da_validated_aal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _besoin RECORD;
BEGIN
  -- Only trigger when status changes to 'validee_aal'
  IF NEW.status = 'validee_aal' AND (OLD.status IS DISTINCT FROM 'validee_aal') THEN
    SELECT b.title, b.user_id INTO _besoin
    FROM public.besoins b WHERE b.id = NEW.besoin_id;
    
    -- Notify besoin creator
    IF _besoin.user_id IS NOT NULL THEN
      PERFORM create_notification(
        _besoin.user_id,
        'da_validee_aal',
        'DA validée par l''AAL',
        'La DA ' || NEW.reference || ' issue de votre besoin "' || COALESCE(_besoin.title, '') || '" a été validée par l''AAL.',
        '/demandes-achat/' || NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_on_da_validated_aal
  AFTER UPDATE ON public.demandes_achat
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_da_validated_aal();
