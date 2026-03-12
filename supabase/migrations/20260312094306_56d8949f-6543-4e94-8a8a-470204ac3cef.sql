
-- =====================================================
-- NOTIFICATIONS MANQUANTES - WORKFLOW COMPLET KPM
-- =====================================================

-- 1. DA soumise_validation → Notifier DAF
CREATE OR REPLACE FUNCTION public.notify_daf_on_da_soumise_validation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _daf_user RECORD;
  _besoin RECORD;
BEGIN
  IF NEW.status = 'soumise_validation' AND (OLD.status IS DISTINCT FROM 'soumise_validation') THEN
    SELECT b.title INTO _besoin FROM public.besoins b WHERE b.id = NEW.besoin_id;
    
    FOR _daf_user IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('daf')
    LOOP
      PERFORM create_notification(
        _daf_user.user_id,
        'da_validation_required',
        'DA à valider (Finance)',
        'La DA ' || NEW.reference || ' (' || COALESCE(_besoin.title, 'N/A') || ') attend votre validation financière.',
        '/demandes-achat/' || NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_daf_on_da_soumise_validation ON public.demandes_achat;
CREATE TRIGGER trg_notify_daf_on_da_soumise_validation
  AFTER UPDATE ON public.demandes_achat
  FOR EACH ROW EXECUTE FUNCTION public.notify_daf_on_da_soumise_validation();

-- 2. DA validée finance → Notifier comptable + créateur
CREATE OR REPLACE FUNCTION public.notify_on_da_validated_finance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _comptable_user RECORD;
  _besoin RECORD;
BEGIN
  IF NEW.status = 'validee_finance' AND (OLD.status IS DISTINCT FROM 'validee_finance') THEN
    SELECT b.title, b.user_id INTO _besoin FROM public.besoins b WHERE b.id = NEW.besoin_id;
    
    -- Notifier les comptables
    FOR _comptable_user IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role = 'comptable'
    LOOP
      PERFORM create_notification(
        _comptable_user.user_id,
        'da_validated_finance',
        'DA validée - À comptabiliser',
        'La DA ' || NEW.reference || ' a été validée par la Finance et attend la comptabilisation.',
        '/demandes-achat/' || NEW.id
      );
    END LOOP;
    
    -- Notifier le créateur du besoin
    IF _besoin.user_id IS NOT NULL THEN
      PERFORM create_notification(
        _besoin.user_id,
        'da_validated_finance',
        'DA validée par la Finance',
        'La DA ' || NEW.reference || ' issue de votre besoin "' || COALESCE(_besoin.title, '') || '" a été validée par la Finance.',
        '/demandes-achat/' || NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_da_validated_finance ON public.demandes_achat;
CREATE TRIGGER trg_notify_on_da_validated_finance
  AFTER UPDATE ON public.demandes_achat
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_da_validated_finance();

-- 3. DA refusée finance (retour AAL) → Notifier AAL + Achats
CREATE OR REPLACE FUNCTION public.notify_on_da_retour_aal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _aal_user RECORD;
  _besoin RECORD;
BEGIN
  IF NEW.status = 'retour_aal' AND (OLD.status IS DISTINCT FROM 'retour_aal') THEN
    SELECT b.title INTO _besoin FROM public.besoins b WHERE b.id = NEW.besoin_id;
    
    -- Notifier AAL
    FOR _aal_user IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role = 'aal'
    LOOP
      PERFORM create_notification(
        _aal_user.user_id,
        'da_refused_finance',
        'DA refusée par la Finance',
        'La DA ' || NEW.reference || ' a été refusée par la Finance. Motif : ' || COALESCE(NEW.finance_decision_comment, 'Non précisé'),
        '/demandes-achat/' || NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_da_retour_aal ON public.demandes_achat;
CREATE TRIGGER trg_notify_on_da_retour_aal
  AFTER UPDATE ON public.demandes_achat
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_da_retour_aal();

-- 4. DA en_attente_dg → Notifier DG
CREATE OR REPLACE FUNCTION public.notify_dg_on_da_en_attente_dg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _dg_user RECORD;
  _besoin RECORD;
BEGIN
  IF NEW.status = 'en_attente_dg' AND (OLD.status IS DISTINCT FROM 'en_attente_dg') THEN
    SELECT b.title INTO _besoin FROM public.besoins b WHERE b.id = NEW.besoin_id;
    
    FOR _dg_user IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role = 'dg'
    LOOP
      PERFORM create_notification(
        _dg_user.user_id,
        'da_validation_required',
        'DA à valider (DG)',
        'La DA ' || NEW.reference || ' (montant: ' || COALESCE(NEW.total_amount::text, 'N/A') || ' XOF) nécessite votre approbation.',
        '/demandes-achat/' || NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_dg_on_da_en_attente_dg ON public.demandes_achat;
CREATE TRIGGER trg_notify_dg_on_da_en_attente_dg
  AFTER UPDATE ON public.demandes_achat
  FOR EACH ROW EXECUTE FUNCTION public.notify_dg_on_da_en_attente_dg();

-- 5. DA validée DG → Notifier DAF + créateur
CREATE OR REPLACE FUNCTION public.notify_on_da_validated_dg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _daf_user RECORD;
  _besoin RECORD;
BEGIN
  IF NEW.status = 'validee_dg' AND (OLD.status IS DISTINCT FROM 'validee_dg') THEN
    SELECT b.title, b.user_id INTO _besoin FROM public.besoins b WHERE b.id = NEW.besoin_id;
    
    -- Notifier DAF
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
    
    -- Notifier le créateur
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
$$;

DROP TRIGGER IF EXISTS trg_notify_on_da_validated_dg ON public.demandes_achat;
CREATE TRIGGER trg_notify_on_da_validated_dg
  AFTER UPDATE ON public.demandes_achat
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_da_validated_dg();

-- 6. DA rejetée DG → Notifier DAF + AAL
CREATE OR REPLACE FUNCTION public.notify_on_da_rejected_dg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _target_user RECORD;
BEGIN
  IF NEW.status = 'rejetee_dg' AND (OLD.status IS DISTINCT FROM 'rejetee_dg') THEN
    -- Notifier DAF + AAL
    FOR _target_user IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('daf', 'aal')
    LOOP
      PERFORM create_notification(
        _target_user.user_id,
        'da_rejected',
        'DA rejetée par le DG',
        'La DA ' || NEW.reference || ' a été rejetée par le DG. Motif : ' || COALESCE(NEW.dg_comment, 'Non précisé'),
        '/demandes-achat/' || NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_da_rejected_dg ON public.demandes_achat;
CREATE TRIGGER trg_notify_on_da_rejected_dg
  AFTER UPDATE ON public.demandes_achat
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_da_rejected_dg();

-- 7. DA en_revision_achats → Notifier Achats/Logistique
CREATE OR REPLACE FUNCTION public.notify_achats_on_da_en_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _target_user RECORD;
  _besoin RECORD;
BEGIN
  IF NEW.status = 'en_revision_achats' AND (OLD.status IS DISTINCT FROM 'en_revision_achats') THEN
    SELECT b.title INTO _besoin FROM public.besoins b WHERE b.id = NEW.besoin_id;
    
    -- Notifier Achats + Logistique
    FOR _target_user IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('responsable_achats', 'agent_achats', 'responsable_logistique', 'agent_logistique')
    LOOP
      PERFORM create_notification(
        _target_user.user_id,
        'da_revision_requested',
        'DA à réviser',
        'La DA ' || NEW.reference || ' (' || COALESCE(_besoin.title, 'N/A') || ') doit être révisée. Commentaire : ' || COALESCE(NEW.revision_comment, NEW.finance_decision_comment, 'Non précisé'),
        '/demandes-achat/' || NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_achats_on_da_en_revision ON public.demandes_achat;
CREATE TRIGGER trg_notify_achats_on_da_en_revision
  AFTER UPDATE ON public.demandes_achat
  FOR EACH ROW EXECUTE FUNCTION public.notify_achats_on_da_en_revision();

-- 8. DA payée → Notifier créateur + logistique
CREATE OR REPLACE FUNCTION public.notify_on_da_payee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _besoin RECORD;
  _logistics_user RECORD;
BEGIN
  IF NEW.status = 'payee' AND (OLD.status IS DISTINCT FROM 'payee') THEN
    SELECT b.title, b.user_id INTO _besoin FROM public.besoins b WHERE b.id = NEW.besoin_id;
    
    -- Notifier le créateur
    IF _besoin.user_id IS NOT NULL THEN
      PERFORM create_notification(
        _besoin.user_id,
        'da_paid',
        'DA payée',
        'La DA ' || NEW.reference || ' issue de votre besoin "' || COALESCE(_besoin.title, '') || '" a été payée.',
        '/demandes-achat/' || NEW.id
      );
    END IF;
    
    -- Notifier la logistique
    FOR _logistics_user IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('responsable_logistique', 'agent_logistique')
    LOOP
      PERFORM create_notification(
        _logistics_user.user_id,
        'da_paid',
        'DA payée',
        'La DA ' || NEW.reference || ' a été payée et comptabilisée.',
        '/demandes-achat/' || NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_da_payee ON public.demandes_achat;
CREATE TRIGGER trg_notify_on_da_payee
  AFTER UPDATE ON public.demandes_achat
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_da_payee();

-- 9. DA rejetée comptabilité → Notifier DAF + AAL
CREATE OR REPLACE FUNCTION public.notify_on_da_rejected_comptabilite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _target_user RECORD;
BEGIN
  IF NEW.status = 'rejetee_comptabilite' AND (OLD.status IS DISTINCT FROM 'rejetee_comptabilite') THEN
    FOR _target_user IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('daf', 'aal')
    LOOP
      PERFORM create_notification(
        _target_user.user_id,
        'da_rejected_comptabilite',
        'DA rejetée par la Comptabilité',
        'La DA ' || NEW.reference || ' a été rejetée par la comptabilité. Motif : ' || COALESCE(NEW.comptabilite_rejection_reason, 'Non précisé'),
        '/demandes-achat/' || NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_da_rejected_comptabilite ON public.demandes_achat;
CREATE TRIGGER trg_notify_on_da_rejected_comptabilite
  AFTER UPDATE ON public.demandes_achat
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_da_rejected_comptabilite();

-- 10. BL validé (DG) → Notifier logistique
CREATE OR REPLACE FUNCTION public.notify_logistics_on_bl_validated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _logistics_user RECORD;
BEGIN
  IF NEW.status = 'valide' AND (OLD.status IS DISTINCT FROM 'valide') THEN
    FOR _logistics_user IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('responsable_logistique', 'agent_logistique')
    LOOP
      PERFORM create_notification(
        _logistics_user.user_id,
        'bl_created',
        'BL validé - Prêt à livrer',
        'Le BL ' || NEW.reference || ' a été validé et est prêt pour livraison.',
        '/bons-livraison/' || NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_logistics_on_bl_validated ON public.bons_livraison;
CREATE TRIGGER trg_notify_logistics_on_bl_validated
  AFTER UPDATE ON public.bons_livraison
  FOR EACH ROW EXECUTE FUNCTION public.notify_logistics_on_bl_validated();

-- 11. BL livré → Notifier créateur du besoin
CREATE OR REPLACE FUNCTION public.notify_creator_on_bl_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _besoin RECORD;
BEGIN
  IF NEW.status IN ('livre', 'livree_partiellement') AND (OLD.status NOT IN ('livre', 'livree_partiellement')) THEN
    SELECT b.title, b.user_id INTO _besoin FROM public.besoins b WHERE b.id = NEW.besoin_id;
    
    IF _besoin.user_id IS NOT NULL THEN
      PERFORM create_notification(
        _besoin.user_id,
        CASE WHEN NEW.status = 'livre' THEN 'BL livré' ELSE 'Livraison partielle' END,
        CASE WHEN NEW.status = 'livre' THEN 'Livraison effectuée' ELSE 'Livraison partielle' END,
        'Le BL ' || NEW.reference || ' pour votre besoin "' || COALESCE(_besoin.title, '') || '" a été ' ||
        CASE WHEN NEW.status = 'livre' THEN 'livré.' ELSE 'partiellement livré.' END,
        '/bons-livraison/' || NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_creator_on_bl_delivered ON public.bons_livraison;
CREATE TRIGGER trg_notify_creator_on_bl_delivered
  AFTER UPDATE ON public.bons_livraison
  FOR EACH ROW EXECUTE FUNCTION public.notify_creator_on_bl_delivered();

-- 12. BL rejeté → Notifier logistique
CREATE OR REPLACE FUNCTION public.notify_logistics_on_bl_rejected()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _logistics_user RECORD;
BEGIN
  IF NEW.status = 'rejete' AND (OLD.status IS DISTINCT FROM 'rejete') THEN
    FOR _logistics_user IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
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
$$;

DROP TRIGGER IF EXISTS trg_notify_logistics_on_bl_rejected ON public.bons_livraison;
CREATE TRIGGER trg_notify_logistics_on_bl_rejected
  AFTER UPDATE ON public.bons_livraison
  FOR EACH ROW EXECUTE FUNCTION public.notify_logistics_on_bl_rejected();

-- 13. BL annulé → Notifier créateur du besoin
CREATE OR REPLACE FUNCTION public.notify_creator_on_bl_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _besoin RECORD;
BEGIN
  IF NEW.status = 'annule' AND (OLD.status IS DISTINCT FROM 'annule') THEN
    SELECT b.title, b.user_id INTO _besoin FROM public.besoins b WHERE b.id = NEW.besoin_id;
    
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
$$;

DROP TRIGGER IF EXISTS trg_notify_creator_on_bl_cancelled ON public.bons_livraison;
CREATE TRIGGER trg_notify_creator_on_bl_cancelled
  AFTER UPDATE ON public.bons_livraison
  FOR EACH ROW EXECUTE FUNCTION public.notify_creator_on_bl_cancelled();
