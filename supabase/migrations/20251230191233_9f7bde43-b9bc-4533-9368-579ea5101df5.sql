-- ===========================================
-- LOT 1: Trigger pour créer mouvement caisse automatique lors du paiement DA
-- ===========================================

-- Fonction pour créer un mouvement de caisse automatiquement lors du paiement d'une DA
CREATE OR REPLACE FUNCTION public.create_caisse_mouvement_on_da_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_caisse_solde_avant numeric;
  v_caisse_solde_apres numeric;
  v_reference text;
BEGIN
  -- Vérifier si le statut passe à 'payee' ET qu'une caisse est sélectionnée
  IF NEW.status = 'payee' AND OLD.status != 'payee' AND NEW.caisse_id IS NOT NULL THEN
    -- Récupérer le solde actuel de la caisse
    SELECT solde_actuel INTO v_caisse_solde_avant 
    FROM caisses 
    WHERE id = NEW.caisse_id;
    
    IF v_caisse_solde_avant IS NULL THEN
      RAISE EXCEPTION 'Caisse introuvable';
    END IF;
    
    -- Calculer le nouveau solde
    v_caisse_solde_apres := v_caisse_solde_avant - COALESCE(NEW.total_amount, 0);
    
    -- Générer la référence du mouvement
    v_reference := 'MVT-DA-' || NEW.reference;
    
    -- Créer le mouvement de sortie
    INSERT INTO caisse_mouvements (
      caisse_id,
      type,
      montant,
      solde_avant,
      solde_apres,
      reference,
      motif,
      da_id,
      created_by,
      observations
    ) VALUES (
      NEW.caisse_id,
      'sortie',
      COALESCE(NEW.total_amount, 0),
      v_caisse_solde_avant,
      v_caisse_solde_apres,
      v_reference,
      'Paiement DA ' || NEW.reference,
      NEW.id,
      NEW.comptabilise_by,
      'Paiement automatique via workflow DA'
    );
    
    -- Mettre à jour le solde de la caisse
    UPDATE caisses 
    SET solde_actuel = v_caisse_solde_apres,
        updated_at = now()
    WHERE id = NEW.caisse_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger sur demandes_achat
DROP TRIGGER IF EXISTS trg_create_caisse_mouvement_on_da_payment ON demandes_achat;
CREATE TRIGGER trg_create_caisse_mouvement_on_da_payment
  AFTER UPDATE ON demandes_achat
  FOR EACH ROW
  EXECUTE FUNCTION public.create_caisse_mouvement_on_da_payment();

-- ===========================================
-- LOT 1 bis: Même trigger pour Notes de frais
-- ===========================================

CREATE OR REPLACE FUNCTION public.create_caisse_mouvement_on_note_frais_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_caisse_id uuid;
  v_caisse_solde_avant numeric;
  v_caisse_solde_apres numeric;
  v_reference text;
BEGIN
  -- Vérifier si le statut passe à 'payee' ET que la catégorie de paiement est 'especes'
  IF NEW.status = 'payee' AND OLD.status != 'payee' THEN
    -- Vérifier si paiement en espèces (via payment_category)
    SELECT pc.code INTO v_reference
    FROM payment_categories pc
    WHERE pc.id = NEW.payment_category_id;
    
    -- Si paiement espèces, chercher la caisse dans payment_details
    IF v_reference = 'especes' AND NEW.payment_details IS NOT NULL THEN
      v_caisse_id := (NEW.payment_details->>'caisse_id')::uuid;
      
      IF v_caisse_id IS NOT NULL THEN
        -- Récupérer le solde actuel de la caisse
        SELECT solde_actuel INTO v_caisse_solde_avant 
        FROM caisses 
        WHERE id = v_caisse_id;
        
        IF v_caisse_solde_avant IS NOT NULL THEN
          -- Calculer le nouveau solde
          v_caisse_solde_apres := v_caisse_solde_avant - COALESCE(NEW.total_amount, 0);
          
          -- Générer la référence du mouvement
          v_reference := 'MVT-NF-' || NEW.reference;
          
          -- Créer le mouvement de sortie
          INSERT INTO caisse_mouvements (
            caisse_id,
            type,
            montant,
            solde_avant,
            solde_apres,
            reference,
            motif,
            note_frais_id,
            created_by,
            observations
          ) VALUES (
            v_caisse_id,
            'sortie',
            COALESCE(NEW.total_amount, 0),
            v_caisse_solde_avant,
            v_caisse_solde_apres,
            v_reference,
            'Paiement Note de frais ' || NEW.reference,
            NEW.id,
            NEW.paid_by,
            'Paiement automatique via workflow note de frais'
          );
          
          -- Mettre à jour le solde de la caisse
          UPDATE caisses 
          SET solde_actuel = v_caisse_solde_apres,
              updated_at = now()
          WHERE id = v_caisse_id;
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger sur notes_frais
DROP TRIGGER IF EXISTS trg_create_caisse_mouvement_on_note_frais_payment ON notes_frais;
CREATE TRIGGER trg_create_caisse_mouvement_on_note_frais_payment
  AFTER UPDATE ON notes_frais
  FOR EACH ROW
  EXECUTE FUNCTION public.create_caisse_mouvement_on_note_frais_payment();

-- ===========================================
-- LOT 2: Fonction pour ajustement de solde initial avec traçabilité
-- ===========================================

CREATE OR REPLACE FUNCTION public.adjust_caisse_solde_initial()
RETURNS TRIGGER AS $$
DECLARE
  v_diff numeric;
  v_old_solde_actuel numeric;
  v_new_solde_actuel numeric;
  v_reference text;
BEGIN
  -- Si le solde_initial a changé
  IF NEW.solde_initial != OLD.solde_initial THEN
    v_diff := NEW.solde_initial - OLD.solde_initial;
    v_old_solde_actuel := OLD.solde_actuel;
    v_new_solde_actuel := OLD.solde_actuel + v_diff;
    
    -- Mettre à jour le solde actuel
    NEW.solde_actuel := v_new_solde_actuel;
    
    -- Générer la référence
    v_reference := 'ADJ-INIT-' || to_char(now(), 'YYYYMMDD-HH24MISS');
    
    -- Créer un mouvement d'ajustement
    INSERT INTO caisse_mouvements (
      caisse_id,
      type,
      montant,
      solde_avant,
      solde_apres,
      reference,
      motif,
      created_by,
      observations
    ) VALUES (
      NEW.id,
      'ajustement',
      ABS(v_diff),
      v_old_solde_actuel,
      v_new_solde_actuel,
      v_reference,
      CASE WHEN v_diff > 0 THEN 'Augmentation solde initial' ELSE 'Diminution solde initial' END,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
      'Modification du solde initial de ' || OLD.solde_initial || ' à ' || NEW.solde_initial
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger sur caisses
DROP TRIGGER IF EXISTS trg_adjust_caisse_solde_initial ON caisses;
CREATE TRIGGER trg_adjust_caisse_solde_initial
  BEFORE UPDATE ON caisses
  FOR EACH ROW
  EXECUTE FUNCTION public.adjust_caisse_solde_initial();

-- ===========================================
-- LOT 7: Ajouter statut 'annulee' aux besoins, DA, BL
-- ===========================================

-- Vérifier si le statut 'annulee' existe déjà dans les enums

-- Pour besoin_status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'annulee' AND enumtypid = 'besoin_status'::regtype) THEN
    ALTER TYPE besoin_status ADD VALUE IF NOT EXISTS 'annulee';
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Pour da_status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'annulee' AND enumtypid = 'da_status'::regtype) THEN
    ALTER TYPE da_status ADD VALUE IF NOT EXISTS 'annulee';
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Pour bl_status  
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'annulee' AND enumtypid = 'bl_status'::regtype) THEN
    ALTER TYPE bl_status ADD VALUE IF NOT EXISTS 'annulee';
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Ajouter colonnes d'annulation aux tables

-- Besoins
ALTER TABLE besoins 
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- Demandes d'achat
ALTER TABLE demandes_achat 
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- Bons de livraison
ALTER TABLE bons_livraison 
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- ===========================================
-- Activer audit sur les nouvelles colonnes (via trigger existant)
-- ===========================================

-- Rien à faire, le trigger audit_trigger_function capture déjà tous les UPDATE