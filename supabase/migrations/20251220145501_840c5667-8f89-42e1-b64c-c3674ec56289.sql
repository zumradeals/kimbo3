-- Ajouter les colonnes pour le suivi de la validation financière
ALTER TABLE public.demandes_achat 
ADD COLUMN IF NOT EXISTS validated_finance_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS validated_finance_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS finance_decision_comment TEXT,
ADD COLUMN IF NOT EXISTS revision_requested_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS revision_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS revision_comment TEXT;

-- RLS: DAF peut voir les DA soumises à validation
CREATE POLICY "DAF voit les DA soumises validation"
ON public.demandes_achat FOR SELECT
USING (
  has_role(auth.uid(), 'daf') 
  AND status IN ('soumise_validation', 'validee_finance', 'refusee_finance', 'en_revision_achats')
);

-- RLS: DAF/DG peuvent valider les DA
CREATE POLICY "DAF DG peuvent valider DA"
ON public.demandes_achat FOR UPDATE
USING (
  (has_role(auth.uid(), 'daf') OR is_dg(auth.uid()) OR is_admin(auth.uid()))
  AND status = 'soumise_validation'
);

-- RLS: Achats peut modifier les DA en révision
CREATE POLICY "Achats peut modifier DA en revision"
ON public.demandes_achat FOR UPDATE
USING (
  is_achats(auth.uid()) 
  AND status = 'en_revision_achats'
);

-- Fonction de notification pour validation financière
CREATE OR REPLACE FUNCTION public.notify_on_da_validated_finance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _besoin RECORD;
  _logistics_user RECORD;
  _comptable_user RECORD;
BEGIN
  IF OLD.status = 'soumise_validation' AND NEW.status = 'validee_finance' THEN
    SELECT b.title, b.user_id INTO _besoin
    FROM public.besoins b WHERE b.id = NEW.besoin_id;
    
    FOR _logistics_user IN 
      SELECT DISTINCT ur.user_id 
      FROM public.user_roles ur
      WHERE ur.role IN ('responsable_logistique', 'agent_logistique')
    LOOP
      PERFORM create_notification(
        _logistics_user.user_id,
        'da_validated_finance',
        'DA validée financièrement',
        CONCAT('La demande ', NEW.reference, ' (', COALESCE(NEW.total_amount::TEXT, '0'), ' ', COALESCE(NEW.currency, 'XAF'), ') a été validée.'),
        '/demandes-achat/' || NEW.id
      );
    END LOOP;
    
    FOR _comptable_user IN 
      SELECT DISTINCT ur.user_id 
      FROM public.user_roles ur
      WHERE ur.role = 'comptable'
    LOOP
      PERFORM create_notification(
        _comptable_user.user_id,
        'da_ready_accounting',
        'Nouvelle DA à comptabiliser',
        CONCAT('La demande ', NEW.reference, ' (', COALESCE(NEW.total_amount::TEXT, '0'), ' ', COALESCE(NEW.currency, 'XAF'), ') est prête pour traitement.'),
        '/demandes-achat/' || NEW.id
      );
    END LOOP;
    
    PERFORM create_notification(
      _besoin.user_id,
      'da_validated_finance',
      'Demande validée',
      CONCAT('Votre demande ', NEW.reference, ' a été validée financièrement.'),
      '/demandes-achat/' || NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fonction de notification pour refus financier
CREATE OR REPLACE FUNCTION public.notify_on_da_refused_finance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _besoin RECORD;
  _logistics_user RECORD;
  _achats_user RECORD;
BEGIN
  IF OLD.status = 'soumise_validation' AND NEW.status = 'refusee_finance' THEN
    SELECT b.title, b.user_id INTO _besoin
    FROM public.besoins b WHERE b.id = NEW.besoin_id;
    
    PERFORM create_notification(
      _besoin.user_id,
      'da_refused_finance',
      'Demande refusée',
      CONCAT('Votre demande ', NEW.reference, ' a été refusée. Motif: ', COALESCE(NEW.finance_decision_comment, 'Non spécifié')),
      '/demandes-achat/' || NEW.id
    );
    
    FOR _logistics_user IN 
      SELECT DISTINCT ur.user_id 
      FROM public.user_roles ur
      WHERE ur.role IN ('responsable_logistique', 'agent_logistique')
    LOOP
      PERFORM create_notification(
        _logistics_user.user_id,
        'da_refused_finance',
        'DA refusée par DAF/DG',
        CONCAT('La demande ', NEW.reference, ' a été refusée financièrement.'),
        '/demandes-achat/' || NEW.id
      );
    END LOOP;
    
    FOR _achats_user IN 
      SELECT DISTINCT ur.user_id 
      FROM public.user_roles ur
      WHERE ur.role IN ('responsable_achats', 'agent_achats')
    LOOP
      PERFORM create_notification(
        _achats_user.user_id,
        'da_refused_finance',
        'DA refusée',
        CONCAT('La demande ', NEW.reference, ' a été refusée par la Direction.'),
        '/demandes-achat/' || NEW.id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fonction de notification pour demande de révision
CREATE OR REPLACE FUNCTION public.notify_on_da_revision_requested()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _achats_user RECORD;
BEGIN
  IF OLD.status = 'soumise_validation' AND NEW.status = 'en_revision_achats' THEN
    FOR _achats_user IN 
      SELECT DISTINCT ur.user_id 
      FROM public.user_roles ur
      WHERE ur.role IN ('responsable_achats', 'agent_achats')
    LOOP
      PERFORM create_notification(
        _achats_user.user_id,
        'da_revision_requested',
        'Révision demandée',
        CONCAT('La demande ', NEW.reference, ' nécessite une révision. Commentaire: ', COALESCE(NEW.revision_comment, 'Non spécifié')),
        '/demandes-achat/' || NEW.id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer les triggers
DROP TRIGGER IF EXISTS trigger_da_validated_finance ON public.demandes_achat;
CREATE TRIGGER trigger_da_validated_finance
  AFTER UPDATE ON public.demandes_achat
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_da_validated_finance();

DROP TRIGGER IF EXISTS trigger_da_refused_finance ON public.demandes_achat;
CREATE TRIGGER trigger_da_refused_finance
  AFTER UPDATE ON public.demandes_achat
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_da_refused_finance();

DROP TRIGGER IF EXISTS trigger_da_revision_requested ON public.demandes_achat;
CREATE TRIGGER trigger_da_revision_requested
  AFTER UPDATE ON public.demandes_achat
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_da_revision_requested();