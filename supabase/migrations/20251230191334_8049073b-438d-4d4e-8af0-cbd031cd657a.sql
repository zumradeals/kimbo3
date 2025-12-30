-- Correction des warnings de sécurité : ajout de search_path aux fonctions

-- Fonction 1: create_caisse_mouvement_on_da_payment
CREATE OR REPLACE FUNCTION public.create_caisse_mouvement_on_da_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_caisse_solde_avant numeric;
  v_caisse_solde_apres numeric;
  v_reference text;
BEGIN
  IF NEW.status = 'payee' AND OLD.status != 'payee' AND NEW.caisse_id IS NOT NULL THEN
    SELECT solde_actuel INTO v_caisse_solde_avant 
    FROM public.caisses 
    WHERE id = NEW.caisse_id;
    
    IF v_caisse_solde_avant IS NULL THEN
      RAISE EXCEPTION 'Caisse introuvable';
    END IF;
    
    v_caisse_solde_apres := v_caisse_solde_avant - COALESCE(NEW.total_amount, 0);
    v_reference := 'MVT-DA-' || NEW.reference;
    
    INSERT INTO public.caisse_mouvements (
      caisse_id, type, montant, solde_avant, solde_apres, reference, motif, da_id, created_by, observations
    ) VALUES (
      NEW.caisse_id, 'sortie', COALESCE(NEW.total_amount, 0), v_caisse_solde_avant, v_caisse_solde_apres,
      v_reference, 'Paiement DA ' || NEW.reference, NEW.id, NEW.comptabilise_by, 'Paiement automatique via workflow DA'
    );
    
    UPDATE public.caisses SET solde_actuel = v_caisse_solde_apres, updated_at = now() WHERE id = NEW.caisse_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fonction 2: create_caisse_mouvement_on_note_frais_payment
CREATE OR REPLACE FUNCTION public.create_caisse_mouvement_on_note_frais_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_caisse_id uuid;
  v_caisse_solde_avant numeric;
  v_caisse_solde_apres numeric;
  v_reference text;
  v_cat_code text;
BEGIN
  IF NEW.status = 'payee' AND OLD.status != 'payee' THEN
    SELECT pc.code INTO v_cat_code FROM public.payment_categories pc WHERE pc.id = NEW.payment_category_id;
    
    IF v_cat_code = 'especes' AND NEW.payment_details IS NOT NULL THEN
      v_caisse_id := (NEW.payment_details->>'caisse_id')::uuid;
      
      IF v_caisse_id IS NOT NULL THEN
        SELECT solde_actuel INTO v_caisse_solde_avant FROM public.caisses WHERE id = v_caisse_id;
        
        IF v_caisse_solde_avant IS NOT NULL THEN
          v_caisse_solde_apres := v_caisse_solde_avant - COALESCE(NEW.total_amount, 0);
          v_reference := 'MVT-NF-' || NEW.reference;
          
          INSERT INTO public.caisse_mouvements (
            caisse_id, type, montant, solde_avant, solde_apres, reference, motif, note_frais_id, created_by, observations
          ) VALUES (
            v_caisse_id, 'sortie', COALESCE(NEW.total_amount, 0), v_caisse_solde_avant, v_caisse_solde_apres,
            v_reference, 'Paiement Note de frais ' || NEW.reference, NEW.id, NEW.paid_by, 'Paiement automatique via workflow note de frais'
          );
          
          UPDATE public.caisses SET solde_actuel = v_caisse_solde_apres, updated_at = now() WHERE id = v_caisse_id;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fonction 3: adjust_caisse_solde_initial
CREATE OR REPLACE FUNCTION public.adjust_caisse_solde_initial()
RETURNS TRIGGER AS $$
DECLARE
  v_diff numeric;
  v_old_solde_actuel numeric;
  v_new_solde_actuel numeric;
  v_reference text;
BEGIN
  IF NEW.solde_initial != OLD.solde_initial THEN
    v_diff := NEW.solde_initial - OLD.solde_initial;
    v_old_solde_actuel := OLD.solde_actuel;
    v_new_solde_actuel := OLD.solde_actuel + v_diff;
    NEW.solde_actuel := v_new_solde_actuel;
    v_reference := 'ADJ-INIT-' || to_char(now(), 'YYYYMMDD-HH24MISS');
    
    INSERT INTO public.caisse_mouvements (
      caisse_id, type, montant, solde_avant, solde_apres, reference, motif, created_by, observations
    ) VALUES (
      NEW.id, 'ajustement', ABS(v_diff), v_old_solde_actuel, v_new_solde_actuel, v_reference,
      CASE WHEN v_diff > 0 THEN 'Augmentation solde initial' ELSE 'Diminution solde initial' END,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
      'Modification du solde initial de ' || OLD.solde_initial || ' à ' || NEW.solde_initial
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;