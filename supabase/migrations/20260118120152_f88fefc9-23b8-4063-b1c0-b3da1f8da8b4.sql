-- ============================================
-- Module Caisse: Approvisionnement, Transfert, Correction
-- ============================================

-- 1) Ajouter transfer_id pour lier les mouvements de transfert
ALTER TABLE public.caisse_mouvements 
ADD COLUMN IF NOT EXISTS transfer_id UUID REFERENCES public.caisse_mouvements(id),
ADD COLUMN IF NOT EXISTS correction_of_id UUID REFERENCES public.caisse_mouvements(id),
ADD COLUMN IF NOT EXISTS correction_reason TEXT;

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_caisse_mouvements_transfer_id ON public.caisse_mouvements(transfer_id) WHERE transfer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_caisse_mouvements_correction_of_id ON public.caisse_mouvements(correction_of_id) WHERE correction_of_id IS NOT NULL;

-- 2) Fonction d'approvisionnement de caisse
CREATE OR REPLACE FUNCTION public.approvisionner_caisse(
  p_caisse_id UUID,
  p_montant NUMERIC,
  p_motif TEXT,
  p_observations TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caisse RECORD;
  v_solde_avant NUMERIC;
  v_solde_apres NUMERIC;
  v_reference TEXT;
  v_mouvement_id UUID;
BEGIN
  -- Vérifier que le montant est positif
  IF p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant doit être supérieur à 0';
  END IF;

  IF p_motif IS NULL OR TRIM(p_motif) = '' THEN
    RAISE EXCEPTION 'Le motif est obligatoire';
  END IF;

  -- Récupérer la caisse et verrouiller la ligne
  SELECT * INTO v_caisse FROM public.caisses WHERE id = p_caisse_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caisse introuvable';
  END IF;

  v_solde_avant := v_caisse.solde_actuel;
  v_solde_apres := v_solde_avant + p_montant;
  v_reference := 'APPRO-' || to_char(now(), 'YYYYMMDD-HH24MISS');

  -- Créer le mouvement d'entrée
  INSERT INTO public.caisse_mouvements (
    caisse_id, type, montant, solde_avant, solde_apres, 
    reference, motif, observations, created_by
  ) VALUES (
    p_caisse_id, 'entree', p_montant, v_solde_avant, v_solde_apres,
    v_reference, p_motif, p_observations, auth.uid()
  ) RETURNING id INTO v_mouvement_id;

  -- Mettre à jour le solde
  UPDATE public.caisses SET solde_actuel = v_solde_apres, updated_at = now() WHERE id = p_caisse_id;

  RETURN v_mouvement_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approvisionner_caisse(UUID, NUMERIC, TEXT, TEXT) TO authenticated;

-- 3) Fonction de transfert entre caisses
CREATE OR REPLACE FUNCTION public.transferer_entre_caisses(
  p_caisse_source_id UUID,
  p_caisse_dest_id UUID,
  p_montant NUMERIC,
  p_motif TEXT,
  p_observations TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source RECORD;
  v_dest RECORD;
  v_source_solde_avant NUMERIC;
  v_source_solde_apres NUMERIC;
  v_dest_solde_avant NUMERIC;
  v_dest_solde_apres NUMERIC;
  v_reference TEXT;
  v_sortie_id UUID;
  v_entree_id UUID;
BEGIN
  -- Validations
  IF p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant doit être supérieur à 0';
  END IF;

  IF p_motif IS NULL OR TRIM(p_motif) = '' THEN
    RAISE EXCEPTION 'Le motif est obligatoire';
  END IF;

  IF p_caisse_source_id = p_caisse_dest_id THEN
    RAISE EXCEPTION 'La caisse source et destination doivent être différentes';
  END IF;

  -- Verrouiller les deux caisses dans un ordre déterministe pour éviter deadlocks
  IF p_caisse_source_id < p_caisse_dest_id THEN
    SELECT * INTO v_source FROM public.caisses WHERE id = p_caisse_source_id FOR UPDATE;
    SELECT * INTO v_dest FROM public.caisses WHERE id = p_caisse_dest_id FOR UPDATE;
  ELSE
    SELECT * INTO v_dest FROM public.caisses WHERE id = p_caisse_dest_id FOR UPDATE;
    SELECT * INTO v_source FROM public.caisses WHERE id = p_caisse_source_id FOR UPDATE;
  END IF;

  IF v_source IS NULL THEN
    RAISE EXCEPTION 'Caisse source introuvable';
  END IF;
  IF v_dest IS NULL THEN
    RAISE EXCEPTION 'Caisse destination introuvable';
  END IF;

  -- Vérifier le solde suffisant
  IF v_source.solde_actuel < p_montant THEN
    RAISE EXCEPTION 'Solde insuffisant sur la caisse source (disponible: %)', v_source.solde_actuel;
  END IF;

  v_reference := 'TRANSF-' || to_char(now(), 'YYYYMMDD-HH24MISS');
  
  v_source_solde_avant := v_source.solde_actuel;
  v_source_solde_apres := v_source_solde_avant - p_montant;
  v_dest_solde_avant := v_dest.solde_actuel;
  v_dest_solde_apres := v_dest_solde_avant + p_montant;

  -- Créer le mouvement de sortie (source)
  INSERT INTO public.caisse_mouvements (
    caisse_id, type, montant, solde_avant, solde_apres,
    reference, motif, observations, created_by
  ) VALUES (
    p_caisse_source_id, 'sortie', p_montant, v_source_solde_avant, v_source_solde_apres,
    v_reference, 'Transfert vers ' || v_dest.name || ': ' || p_motif, p_observations, auth.uid()
  ) RETURNING id INTO v_sortie_id;

  -- Créer le mouvement d'entrée (destination) avec lien au mouvement source
  INSERT INTO public.caisse_mouvements (
    caisse_id, type, montant, solde_avant, solde_apres,
    reference, motif, observations, created_by, transfer_id
  ) VALUES (
    p_caisse_dest_id, 'entree', p_montant, v_dest_solde_avant, v_dest_solde_apres,
    v_reference, 'Transfert depuis ' || v_source.name || ': ' || p_motif, p_observations, auth.uid(), v_sortie_id
  ) RETURNING id INTO v_entree_id;

  -- Lier le mouvement source au mouvement destination
  UPDATE public.caisse_mouvements SET transfer_id = v_entree_id WHERE id = v_sortie_id;

  -- Mettre à jour les soldes
  UPDATE public.caisses SET solde_actuel = v_source_solde_apres, updated_at = now() WHERE id = p_caisse_source_id;
  UPDATE public.caisses SET solde_actuel = v_dest_solde_apres, updated_at = now() WHERE id = p_caisse_dest_id;

  RETURN v_sortie_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transferer_entre_caisses(UUID, UUID, NUMERIC, TEXT, TEXT) TO authenticated;

-- 4) Fonction de correction d'erreur de caisse sur un paiement
-- Mode B: Contre-écriture sur mauvaise caisse + écriture sur bonne caisse
CREATE OR REPLACE FUNCTION public.corriger_caisse_paiement(
  p_da_id UUID,
  p_nouvelle_caisse_id UUID,
  p_raison TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_da RECORD;
  v_old_caisse RECORD;
  v_new_caisse RECORD;
  v_old_mouvement RECORD;
  v_montant NUMERIC;
  v_reference TEXT;
  v_contre_ecriture_id UUID;
  v_nouvelle_ecriture_id UUID;
BEGIN
  -- Validation de la raison
  IF p_raison IS NULL OR LENGTH(TRIM(p_raison)) < 10 THEN
    RAISE EXCEPTION 'La raison de correction doit contenir au moins 10 caractères';
  END IF;

  -- Récupérer la DA
  SELECT * INTO v_da FROM public.demandes_achat WHERE id = p_da_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande d''achat introuvable';
  END IF;

  -- Vérifier que la DA est payée
  IF v_da.status != 'payee' THEN
    RAISE EXCEPTION 'Seules les DA payées peuvent être corrigées';
  END IF;

  -- Vérifier qu'il y a une caisse actuellement affectée
  IF v_da.caisse_id IS NULL THEN
    RAISE EXCEPTION 'Aucune caisse n''est associée à ce paiement';
  END IF;

  -- Vérifier que la nouvelle caisse est différente
  IF v_da.caisse_id = p_nouvelle_caisse_id THEN
    RAISE EXCEPTION 'La nouvelle caisse doit être différente de l''actuelle';
  END IF;

  -- Récupérer le mouvement original lié à cette DA
  SELECT * INTO v_old_mouvement 
  FROM public.caisse_mouvements 
  WHERE da_id = p_da_id AND type = 'sortie' AND correction_of_id IS NULL
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mouvement de caisse original introuvable pour cette DA';
  END IF;

  v_montant := v_old_mouvement.montant;

  -- Verrouiller les caisses
  IF v_da.caisse_id < p_nouvelle_caisse_id THEN
    SELECT * INTO v_old_caisse FROM public.caisses WHERE id = v_da.caisse_id FOR UPDATE;
    SELECT * INTO v_new_caisse FROM public.caisses WHERE id = p_nouvelle_caisse_id FOR UPDATE;
  ELSE
    SELECT * INTO v_new_caisse FROM public.caisses WHERE id = p_nouvelle_caisse_id FOR UPDATE;
    SELECT * INTO v_old_caisse FROM public.caisses WHERE id = v_da.caisse_id FOR UPDATE;
  END IF;

  IF v_new_caisse IS NULL THEN
    RAISE EXCEPTION 'Nouvelle caisse introuvable';
  END IF;

  -- Vérifier le solde suffisant sur la nouvelle caisse
  IF v_new_caisse.solde_actuel < v_montant THEN
    RAISE EXCEPTION 'Solde insuffisant sur la nouvelle caisse (disponible: %)', v_new_caisse.solde_actuel;
  END IF;

  v_reference := 'CORR-' || to_char(now(), 'YYYYMMDD-HH24MISS');

  -- 1. Contre-écriture sur l'ancienne caisse (entrée = annulation de la sortie)
  INSERT INTO public.caisse_mouvements (
    caisse_id, type, montant, solde_avant, solde_apres,
    reference, motif, observations, created_by, da_id, correction_of_id, correction_reason, payment_class
  ) VALUES (
    v_da.caisse_id, 'entree', v_montant, v_old_caisse.solde_actuel, v_old_caisse.solde_actuel + v_montant,
    v_reference, 'Correction erreur caisse: annulation ' || v_da.reference, 
    'Réaffectation vers ' || v_new_caisse.name || ' - Raison: ' || p_raison,
    auth.uid(), p_da_id, v_old_mouvement.id, p_raison, v_old_mouvement.payment_class
  ) RETURNING id INTO v_contre_ecriture_id;

  -- Mettre à jour le solde de l'ancienne caisse
  UPDATE public.caisses 
  SET solde_actuel = solde_actuel + v_montant, updated_at = now() 
  WHERE id = v_da.caisse_id;

  -- 2. Nouvelle écriture sur la nouvelle caisse
  INSERT INTO public.caisse_mouvements (
    caisse_id, type, montant, solde_avant, solde_apres,
    reference, motif, observations, created_by, da_id, correction_of_id, correction_reason, payment_class
  ) VALUES (
    p_nouvelle_caisse_id, 'sortie', v_montant, v_new_caisse.solde_actuel, v_new_caisse.solde_actuel - v_montant,
    v_reference, 'Correction erreur caisse: ' || v_da.reference,
    'Réaffectation depuis ' || v_old_caisse.name || ' - Raison: ' || p_raison,
    auth.uid(), p_da_id, v_old_mouvement.id, p_raison, v_old_mouvement.payment_class
  ) RETURNING id INTO v_nouvelle_ecriture_id;

  -- Mettre à jour le solde de la nouvelle caisse
  UPDATE public.caisses 
  SET solde_actuel = solde_actuel - v_montant, updated_at = now() 
  WHERE id = p_nouvelle_caisse_id;

  -- 3. Mettre à jour la DA avec la nouvelle caisse
  UPDATE public.demandes_achat
  SET caisse_id = p_nouvelle_caisse_id, updated_at = now()
  WHERE id = p_da_id;

  -- 4. Créer une entrée d'audit
  INSERT INTO public.audit_logs (
    user_id, action, table_name, record_id, 
    old_values, new_values
  ) VALUES (
    auth.uid(), 
    'CORRECTION_CAISSE', 
    'demandes_achat', 
    p_da_id,
    jsonb_build_object('caisse_id', v_da.caisse_id, 'caisse_name', v_old_caisse.name),
    jsonb_build_object('caisse_id', p_nouvelle_caisse_id, 'caisse_name', v_new_caisse.name, 'raison', p_raison)
  );

  RETURN v_contre_ecriture_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.corriger_caisse_paiement(UUID, UUID, TEXT) TO authenticated;

-- 5) Fonction similaire pour les notes de frais
CREATE OR REPLACE FUNCTION public.corriger_caisse_note_frais(
  p_note_frais_id UUID,
  p_nouvelle_caisse_id UUID,
  p_raison TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ndf RECORD;
  v_old_caisse RECORD;
  v_new_caisse RECORD;
  v_old_mouvement RECORD;
  v_montant NUMERIC;
  v_reference TEXT;
  v_contre_ecriture_id UUID;
  v_nouvelle_ecriture_id UUID;
BEGIN
  -- Validation de la raison
  IF p_raison IS NULL OR LENGTH(TRIM(p_raison)) < 10 THEN
    RAISE EXCEPTION 'La raison de correction doit contenir au moins 10 caractères';
  END IF;

  -- Récupérer la note de frais
  SELECT * INTO v_ndf FROM public.notes_frais WHERE id = p_note_frais_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Note de frais introuvable';
  END IF;

  -- Vérifier que la NDF est payée
  IF v_ndf.status != 'payee' THEN
    RAISE EXCEPTION 'Seules les notes de frais payées peuvent être corrigées';
  END IF;

  -- Vérifier qu'il y a une caisse actuellement affectée
  IF v_ndf.caisse_id IS NULL THEN
    RAISE EXCEPTION 'Aucune caisse n''est associée à ce paiement';
  END IF;

  -- Vérifier que la nouvelle caisse est différente
  IF v_ndf.caisse_id = p_nouvelle_caisse_id THEN
    RAISE EXCEPTION 'La nouvelle caisse doit être différente de l''actuelle';
  END IF;

  -- Récupérer le mouvement original
  SELECT * INTO v_old_mouvement 
  FROM public.caisse_mouvements 
  WHERE note_frais_id = p_note_frais_id AND type = 'sortie' AND correction_of_id IS NULL
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mouvement de caisse original introuvable';
  END IF;

  v_montant := v_old_mouvement.montant;

  -- Verrouiller les caisses
  IF v_ndf.caisse_id < p_nouvelle_caisse_id THEN
    SELECT * INTO v_old_caisse FROM public.caisses WHERE id = v_ndf.caisse_id FOR UPDATE;
    SELECT * INTO v_new_caisse FROM public.caisses WHERE id = p_nouvelle_caisse_id FOR UPDATE;
  ELSE
    SELECT * INTO v_new_caisse FROM public.caisses WHERE id = p_nouvelle_caisse_id FOR UPDATE;
    SELECT * INTO v_old_caisse FROM public.caisses WHERE id = v_ndf.caisse_id FOR UPDATE;
  END IF;

  IF v_new_caisse IS NULL THEN
    RAISE EXCEPTION 'Nouvelle caisse introuvable';
  END IF;

  IF v_new_caisse.solde_actuel < v_montant THEN
    RAISE EXCEPTION 'Solde insuffisant sur la nouvelle caisse (disponible: %)', v_new_caisse.solde_actuel;
  END IF;

  v_reference := 'CORR-NDF-' || to_char(now(), 'YYYYMMDD-HH24MISS');

  -- 1. Contre-écriture
  INSERT INTO public.caisse_mouvements (
    caisse_id, type, montant, solde_avant, solde_apres,
    reference, motif, observations, created_by, note_frais_id, correction_of_id, correction_reason, payment_class
  ) VALUES (
    v_ndf.caisse_id, 'entree', v_montant, v_old_caisse.solde_actuel, v_old_caisse.solde_actuel + v_montant,
    v_reference, 'Correction erreur caisse: annulation ' || v_ndf.reference, 
    'Réaffectation vers ' || v_new_caisse.name || ' - Raison: ' || p_raison,
    auth.uid(), p_note_frais_id, v_old_mouvement.id, p_raison, v_old_mouvement.payment_class
  ) RETURNING id INTO v_contre_ecriture_id;

  UPDATE public.caisses 
  SET solde_actuel = solde_actuel + v_montant, updated_at = now() 
  WHERE id = v_ndf.caisse_id;

  -- 2. Nouvelle écriture
  INSERT INTO public.caisse_mouvements (
    caisse_id, type, montant, solde_avant, solde_apres,
    reference, motif, observations, created_by, note_frais_id, correction_of_id, correction_reason, payment_class
  ) VALUES (
    p_nouvelle_caisse_id, 'sortie', v_montant, v_new_caisse.solde_actuel, v_new_caisse.solde_actuel - v_montant,
    v_reference, 'Correction erreur caisse: ' || v_ndf.reference,
    'Réaffectation depuis ' || v_old_caisse.name || ' - Raison: ' || p_raison,
    auth.uid(), p_note_frais_id, v_old_mouvement.id, p_raison, v_old_mouvement.payment_class
  ) RETURNING id INTO v_nouvelle_ecriture_id;

  UPDATE public.caisses 
  SET solde_actuel = solde_actuel - v_montant, updated_at = now() 
  WHERE id = p_nouvelle_caisse_id;

  -- 3. Mettre à jour la note de frais
  UPDATE public.notes_frais
  SET caisse_id = p_nouvelle_caisse_id, updated_at = now()
  WHERE id = p_note_frais_id;

  -- 4. Audit
  INSERT INTO public.audit_logs (
    user_id, action, table_name, record_id, 
    old_values, new_values
  ) VALUES (
    auth.uid(), 
    'CORRECTION_CAISSE', 
    'notes_frais', 
    p_note_frais_id,
    jsonb_build_object('caisse_id', v_ndf.caisse_id, 'caisse_name', v_old_caisse.name),
    jsonb_build_object('caisse_id', p_nouvelle_caisse_id, 'caisse_name', v_new_caisse.name, 'raison', p_raison)
  );

  RETURN v_contre_ecriture_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.corriger_caisse_note_frais(UUID, UUID, TEXT) TO authenticated;