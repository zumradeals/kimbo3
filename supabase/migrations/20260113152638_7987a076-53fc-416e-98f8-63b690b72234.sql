
-- CORRECTION CRITIQUE : Double déduction de caisse (v2)

-- ========================================
-- ÉTAPE 1: Nettoyage ROBUSTE des doublons avec ROW_NUMBER
-- ========================================

-- Supprimer tous les doublons DA sauf le premier (par created_at)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY da_id ORDER BY created_at ASC) as rn
  FROM public.caisse_mouvements
  WHERE da_id IS NOT NULL AND type = 'sortie'
)
DELETE FROM public.caisse_mouvements 
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Supprimer tous les doublons Note de Frais sauf le premier
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY note_frais_id ORDER BY created_at ASC) as rn
  FROM public.caisse_mouvements
  WHERE note_frais_id IS NOT NULL AND type = 'sortie'
)
DELETE FROM public.caisse_mouvements 
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ========================================
-- ÉTAPE 2: Supprimer trigger dupliqué
-- ========================================

DROP TRIGGER IF EXISTS trigger_create_caisse_movement_on_da_paid ON demandes_achat;
DROP FUNCTION IF EXISTS create_caisse_movement_on_da_paid();

-- ========================================
-- ÉTAPE 3: Corriger trigger DA - SANS update direct du solde
-- ========================================

CREATE OR REPLACE FUNCTION create_caisse_mouvement_on_da_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caisse_solde_avant numeric;
  v_caisse_solde_apres numeric;
  v_reference text;
  v_existing_movement_id uuid;
BEGIN
  IF NEW.status = 'payee' AND OLD.status != 'payee' AND NEW.caisse_id IS NOT NULL THEN
    
    -- PROTECTION ANTI-DOUBLON
    SELECT id INTO v_existing_movement_id 
    FROM public.caisse_mouvements 
    WHERE da_id = NEW.id LIMIT 1;
    
    IF v_existing_movement_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    
    SELECT solde_actuel INTO v_caisse_solde_avant 
    FROM public.caisses WHERE id = NEW.caisse_id FOR UPDATE;
    
    IF v_caisse_solde_avant IS NULL THEN
      RAISE EXCEPTION 'Caisse introuvable';
    END IF;
    
    v_caisse_solde_apres := v_caisse_solde_avant - COALESCE(NEW.total_amount, 0);
    v_reference := 'MVT-DA-' || NEW.reference;
    
    -- Créer mouvement (trigger update_caisse_solde gère le solde)
    INSERT INTO public.caisse_mouvements (
      caisse_id, type, montant, solde_avant, solde_apres, 
      reference, motif, da_id, created_by, observations, payment_class
    ) VALUES (
      NEW.caisse_id, 'sortie', COALESCE(NEW.total_amount, 0), 
      v_caisse_solde_avant, v_caisse_solde_apres,
      v_reference, 'Paiement DA ' || NEW.reference, 
      NEW.id, NEW.comptabilise_by, 'Paiement automatique', NEW.payment_class
    );
    
    -- PAS d'UPDATE caisses ici!
  END IF;
  
  RETURN NEW;
END;
$$;

-- ========================================
-- ÉTAPE 4: Corriger trigger Note de Frais
-- ========================================

CREATE OR REPLACE FUNCTION create_caisse_mouvement_on_note_frais_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caisse_id uuid;
  v_caisse_solde_avant numeric;
  v_caisse_solde_apres numeric;
  v_reference text;
  v_cat_code text;
  v_existing_movement_id uuid;
BEGIN
  IF NEW.status = 'payee' AND OLD.status != 'payee' THEN
    v_caisse_id := NEW.caisse_id;
    
    IF v_caisse_id IS NULL AND NEW.payment_details IS NOT NULL THEN
      SELECT pc.code INTO v_cat_code FROM public.payment_categories pc WHERE pc.id = NEW.payment_category_id;
      IF v_cat_code = 'especes' THEN
        v_caisse_id := (NEW.payment_details->>'caisse_id')::uuid;
      END IF;
    END IF;
    
    IF v_caisse_id IS NOT NULL THEN
      SELECT id INTO v_existing_movement_id 
      FROM public.caisse_mouvements WHERE note_frais_id = NEW.id LIMIT 1;
      
      IF v_existing_movement_id IS NOT NULL THEN
        RETURN NEW;
      END IF;
      
      SELECT solde_actuel INTO v_caisse_solde_avant 
      FROM public.caisses WHERE id = v_caisse_id FOR UPDATE;
      
      IF v_caisse_solde_avant IS NOT NULL THEN
        v_caisse_solde_apres := v_caisse_solde_avant - COALESCE(NEW.total_amount, 0);
        v_reference := 'MVT-NF-' || NEW.reference;
        
        INSERT INTO public.caisse_mouvements (
          caisse_id, type, montant, solde_avant, solde_apres, 
          reference, motif, note_frais_id, created_by, observations, payment_class
        ) VALUES (
          v_caisse_id, 'sortie', COALESCE(NEW.total_amount, 0), 
          v_caisse_solde_avant, v_caisse_solde_apres,
          v_reference, 'Paiement NDF ' || NEW.reference, 
          NEW.id, NEW.paid_by, 'Paiement automatique', NEW.payment_class
        );
        
        -- PAS d'UPDATE caisses ici!
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ========================================
-- ÉTAPE 5: Index uniques anti-doublon
-- ========================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_caisse_mouvement_da 
ON public.caisse_mouvements (da_id) 
WHERE da_id IS NOT NULL AND type = 'sortie';

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_caisse_mouvement_ndf 
ON public.caisse_mouvements (note_frais_id) 
WHERE note_frais_id IS NOT NULL AND type = 'sortie';

-- ========================================
-- ÉTAPE 6: Fonction recalcul + exécution
-- ========================================

CREATE OR REPLACE FUNCTION recalculate_caisse_solde(p_caisse_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solde_initial numeric;
  v_total_entrees numeric;
  v_total_sorties numeric;
  v_nouveau_solde numeric;
BEGIN
  SELECT solde_initial INTO v_solde_initial FROM public.caisses WHERE id = p_caisse_id;
  SELECT COALESCE(SUM(montant), 0) INTO v_total_entrees FROM public.caisse_mouvements WHERE caisse_id = p_caisse_id AND type = 'entree';
  SELECT COALESCE(SUM(montant), 0) INTO v_total_sorties FROM public.caisse_mouvements WHERE caisse_id = p_caisse_id AND type = 'sortie';
  v_nouveau_solde := COALESCE(v_solde_initial, 0) + v_total_entrees - v_total_sorties;
  UPDATE public.caisses SET solde_actuel = v_nouveau_solde, updated_at = now() WHERE id = p_caisse_id;
  RETURN v_nouveau_solde;
END;
$$;

-- Recalculer tous les soldes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.caisses LOOP
    PERFORM recalculate_caisse_solde(r.id);
  END LOOP;
END;
$$;
