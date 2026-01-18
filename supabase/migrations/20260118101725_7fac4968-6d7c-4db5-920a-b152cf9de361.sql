-- ============================================
-- Expression de Besoin - Machine à états stricte (Partie 1)
-- Nettoyage des triggers existants qui référencent l'ancien enum
-- ============================================

-- 1. Supprimer le trigger qui cause le conflit
DROP TRIGGER IF EXISTS on_expression_status_change ON public.expressions_besoin;
DROP FUNCTION IF EXISTS public.notify_user_on_expression_status_change() CASCADE;

-- 2. Supprimer le trigger de notification à la création si existant
DROP TRIGGER IF EXISTS on_expression_created ON public.expressions_besoin;

-- 3. Créer le nouvel enum avec les statuts complets
CREATE TYPE public.expression_besoin_status_v2 AS ENUM (
  'brouillon',            -- DRAFT: créé par le membre, non soumis
  'soumis',               -- SUBMITTED_FOR_VALIDATION: soumis au chef
  'en_examen',            -- UNDER_REVIEW: pris en charge par le chef
  'valide_departement',   -- VALIDATED_BY_DEPARTMENT: validé, en attente d'envoi logistique
  'rejete_departement',   -- REJECTED_BY_DEPARTMENT: rejeté par le chef
  'envoye_logistique'     -- SENT_TO_LOGISTICS: transmis à la logistique
);

-- 4. Ajouter une nouvelle colonne avec le nouveau type
ALTER TABLE public.expressions_besoin 
ADD COLUMN status_v2 public.expression_besoin_status_v2;

-- 5. Migrer les données existantes vers le nouveau statut
UPDATE public.expressions_besoin 
SET status_v2 = CASE 
  WHEN status = 'en_attente' THEN 'soumis'::expression_besoin_status_v2
  WHEN status = 'validee' THEN 
    CASE WHEN besoin_id IS NOT NULL THEN 'envoye_logistique'::expression_besoin_status_v2
    ELSE 'valide_departement'::expression_besoin_status_v2
    END
  WHEN status = 'rejetee' THEN 'rejete_departement'::expression_besoin_status_v2
  ELSE 'soumis'::expression_besoin_status_v2
END;

-- 6. Renommer les colonnes
ALTER TABLE public.expressions_besoin 
RENAME COLUMN status TO status_old;

ALTER TABLE public.expressions_besoin 
RENAME COLUMN status_v2 TO status;

-- 7. Rendre la nouvelle colonne NOT NULL avec défaut
ALTER TABLE public.expressions_besoin 
ALTER COLUMN status SET NOT NULL,
ALTER COLUMN status SET DEFAULT 'brouillon'::expression_besoin_status_v2;

-- 8. Ajouter colonnes de traçabilité manquantes
ALTER TABLE public.expressions_besoin 
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sent_to_logistics_at TIMESTAMPTZ;

-- 9. Mettre à jour les timestamps pour les données existantes
UPDATE public.expressions_besoin 
SET submitted_at = created_at 
WHERE status IN ('soumis', 'en_examen', 'valide_departement', 'rejete_departement', 'envoye_logistique');

UPDATE public.expressions_besoin 
SET reviewed_at = COALESCE(validated_at, rejected_at)
WHERE status IN ('valide_departement', 'rejete_departement', 'envoye_logistique');

UPDATE public.expressions_besoin 
SET sent_to_logistics_at = validated_at
WHERE status = 'envoye_logistique';

-- 10. Créer la nouvelle fonction de notification adaptée au nouvel enum
CREATE OR REPLACE FUNCTION public.notify_user_on_expression_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _title TEXT;
  _message TEXT;
BEGIN
  -- Notification quand le statut change vers validé
  IF NEW.status = 'valide_departement' AND OLD.status IN ('soumis', 'en_examen') THEN
    _title := 'Expression validée';
    _message := CONCAT('Votre expression de besoin "', NEW.nom_article, '" a été validée par votre responsable.');
    
    PERFORM create_notification(
      NEW.user_id,
      'expression_validated',
      _title,
      _message,
      '/expressions-besoin/' || NEW.id
    );
  -- Notification quand le statut change vers rejeté
  ELSIF NEW.status = 'rejete_departement' AND OLD.status IN ('soumis', 'en_examen') THEN
    _title := 'Expression rejetée';
    _message := CONCAT('Votre expression de besoin "', NEW.nom_article, '" a été rejetée. Motif: ', COALESCE(NEW.rejection_reason, 'Non spécifié'));
    
    PERFORM create_notification(
      NEW.user_id,
      'expression_rejected',
      _title,
      _message,
      '/expressions-besoin/' || NEW.id
    );
  -- Notification quand envoyé à la logistique
  ELSIF NEW.status = 'envoye_logistique' AND OLD.status = 'valide_departement' THEN
    _title := 'Expression transmise';
    _message := CONCAT('Votre expression de besoin "', NEW.nom_article, '" a été transmise à la logistique.');
    
    PERFORM create_notification(
      NEW.user_id,
      'expression_sent_logistics',
      _title,
      _message,
      '/expressions-besoin/' || NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 11. Recréer le trigger avec la nouvelle fonction
CREATE TRIGGER on_expression_status_change
  AFTER UPDATE ON public.expressions_besoin
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_user_on_expression_status_change();

-- 12. Mettre à jour la fonction de notification à la création
CREATE OR REPLACE FUNCTION public.notify_manager_on_expression_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _chef_id UUID;
  _user_name TEXT;
BEGIN
  -- Ne notifier que si soumis directement (pas brouillon)
  IF NEW.status = 'soumis' THEN
    SELECT chef_hierarchique_id INTO _chef_id
    FROM public.profiles
    WHERE id = NEW.user_id;
    
    SELECT CONCAT(first_name, ' ', last_name) INTO _user_name
    FROM public.profiles
    WHERE id = NEW.user_id;
    
    IF _chef_id IS NOT NULL THEN
      PERFORM create_notification(
        _chef_id,
        'expression_submitted',
        'Nouvelle expression à valider',
        CONCAT(_user_name, ' a soumis une expression de besoin : ', NEW.nom_article),
        '/expressions-besoin/' || NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recréer le trigger
DROP TRIGGER IF EXISTS on_expression_besoin_created ON public.expressions_besoin;
CREATE TRIGGER on_expression_besoin_created
  AFTER INSERT ON public.expressions_besoin
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_manager_on_expression_created();

-- 13. Fonction RPC pour soumettre une expression (membre -> chef)
CREATE OR REPLACE FUNCTION public.submit_expression_for_validation(_expression_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _expression RECORD;
BEGIN
  SELECT * INTO _expression FROM expressions_besoin WHERE id = _expression_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expression non trouvée';
  END IF;
  
  IF _expression.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez soumettre que vos propres expressions';
  END IF;
  
  IF _expression.status != 'brouillon' THEN
    RAISE EXCEPTION 'Seules les expressions en brouillon peuvent être soumises';
  END IF;
  
  UPDATE expressions_besoin 
  SET status = 'soumis',
      submitted_at = now(),
      updated_at = now()
  WHERE id = _expression_id;
  
  RETURN true;
END;
$$;

-- 14. Fonction RPC pour valider une expression (chef)
CREATE OR REPLACE FUNCTION public.validate_expression_by_manager(
  _expression_id uuid,
  _quantite integer,
  _unite text DEFAULT 'unité',
  _precision_technique text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _expression RECORD;
BEGIN
  IF NOT can_validate_expression(_expression_id) THEN
    RAISE EXCEPTION 'Vous n''êtes pas autorisé à valider cette expression';
  END IF;
  
  SELECT * INTO _expression FROM expressions_besoin WHERE id = _expression_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expression non trouvée';
  END IF;
  
  IF _expression.status NOT IN ('soumis', 'en_examen') THEN
    RAISE EXCEPTION 'Cette expression ne peut pas être validée dans son état actuel';
  END IF;
  
  UPDATE expressions_besoin 
  SET status = 'valide_departement',
      validated_at = now(),
      reviewed_at = now(),
      chef_validateur_id = auth.uid(),
      quantite = _quantite,
      unite = _unite,
      precision_technique = _precision_technique,
      updated_at = now()
  WHERE id = _expression_id;
  
  RETURN true;
END;
$$;

-- 15. Fonction RPC pour rejeter une expression (chef)
CREATE OR REPLACE FUNCTION public.reject_expression_by_manager(
  _expression_id uuid,
  _rejection_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _expression RECORD;
BEGIN
  IF NOT can_validate_expression(_expression_id) THEN
    RAISE EXCEPTION 'Vous n''êtes pas autorisé à rejeter cette expression';
  END IF;
  
  SELECT * INTO _expression FROM expressions_besoin WHERE id = _expression_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expression non trouvée';
  END IF;
  
  IF _expression.status NOT IN ('soumis', 'en_examen') THEN
    RAISE EXCEPTION 'Cette expression ne peut pas être rejetée dans son état actuel';
  END IF;
  
  UPDATE expressions_besoin 
  SET status = 'rejete_departement',
      rejected_at = now(),
      reviewed_at = now(),
      chef_validateur_id = auth.uid(),
      rejection_reason = _rejection_reason,
      updated_at = now()
  WHERE id = _expression_id;
  
  RETURN true;
END;
$$;

-- 16. Mettre à jour la fonction submit_expression_to_logistics
CREATE OR REPLACE FUNCTION public.submit_expression_to_logistics(_expression_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _expression RECORD;
  _new_besoin_id uuid;
BEGIN
  IF NOT can_validate_expression(_expression_id) THEN
    RAISE EXCEPTION 'Vous n''êtes pas autorisé à soumettre cette expression à la logistique';
  END IF;
  
  SELECT * INTO _expression FROM expressions_besoin WHERE id = _expression_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expression non trouvée';
  END IF;
  
  IF _expression.status != 'valide_departement' THEN
    RAISE EXCEPTION 'Seules les expressions validées par le département peuvent être soumises à la logistique';
  END IF;
  
  IF _expression.besoin_id IS NOT NULL THEN
    RETURN _expression.besoin_id;
  END IF;
  
  INSERT INTO besoins (
    title,
    description,
    category,
    urgency,
    user_id,
    department_id,
    objet_besoin,
    estimated_quantity,
    unit,
    status
  ) VALUES (
    _expression.nom_article,
    COALESCE(_expression.commentaire, '') || 
      CASE WHEN _expression.precision_technique IS NOT NULL 
        THEN E'\n\nPrécisions techniques: ' || _expression.precision_technique 
        ELSE '' 
      END,
    'materiel',
    'normale',
    _expression.user_id,
    _expression.department_id,
    _expression.nom_article,
    _expression.quantite,
    _expression.unite,
    'cree'
  ) RETURNING id INTO _new_besoin_id;
  
  INSERT INTO besoin_lignes (
    besoin_id,
    designation,
    category,
    quantity,
    unit,
    urgency
  ) VALUES (
    _new_besoin_id,
    _expression.nom_article,
    'materiel',
    _expression.quantite,
    _expression.unite,
    'normale'
  );
  
  UPDATE expressions_besoin 
  SET status = 'envoye_logistique',
      besoin_id = _new_besoin_id,
      sent_to_logistics_at = now(),
      updated_at = now()
  WHERE id = _expression_id;
  
  RETURN _new_besoin_id;
END;
$$;

-- 17. Accorder les permissions d'exécution
GRANT EXECUTE ON FUNCTION public.submit_expression_for_validation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_expression_by_manager(uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_expression_by_manager(uuid, text) TO authenticated;