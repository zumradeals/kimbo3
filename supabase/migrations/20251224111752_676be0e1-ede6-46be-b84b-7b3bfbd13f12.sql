-- ==================== 1. MODULE PROJETS/CHANTIERS ====================

-- Table des projets/chantiers
CREATE TABLE public.projets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  client TEXT,
  location TEXT,
  start_date DATE,
  end_date DATE,
  budget NUMERIC,
  status TEXT NOT NULL DEFAULT 'actif' CHECK (status IN ('actif', 'en_pause', 'termine', 'annule')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.projets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tous peuvent voir les projets actifs" ON public.projets FOR SELECT USING (is_active = true OR is_admin(auth.uid()) OR is_dg(auth.uid()));
CREATE POLICY "Logistique Admin peuvent créer projets" ON public.projets FOR INSERT WITH CHECK (is_logistics(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Logistique Admin peuvent modifier projets" ON public.projets FOR UPDATE USING (is_logistics(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Admin peut supprimer projets" ON public.projets FOR DELETE USING (is_admin(auth.uid()));

-- Ajouter projet_id aux tables existantes
ALTER TABLE public.besoins ADD COLUMN IF NOT EXISTS projet_id UUID REFERENCES public.projets(id);
ALTER TABLE public.demandes_achat ADD COLUMN IF NOT EXISTS projet_id UUID REFERENCES public.projets(id);
ALTER TABLE public.bons_livraison ADD COLUMN IF NOT EXISTS projet_id UUID REFERENCES public.projets(id);
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS projet_id UUID REFERENCES public.projets(id);

-- Index pour les requêtes par projet
CREATE INDEX IF NOT EXISTS idx_besoins_projet_id ON public.besoins(projet_id);
CREATE INDEX IF NOT EXISTS idx_demandes_achat_projet_id ON public.demandes_achat(projet_id);
CREATE INDEX IF NOT EXISTS idx_bons_livraison_projet_id ON public.bons_livraison(projet_id);

-- ==================== 2. MODULE NOTES DE FRAIS ====================

-- Enum pour statut notes de frais
DO $$ BEGIN
  CREATE TYPE note_frais_status AS ENUM ('brouillon', 'soumise', 'validee_daf', 'payee', 'rejetee');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Table principale notes de frais
CREATE TABLE public.notes_frais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  department_id UUID NOT NULL REFERENCES public.departments(id),
  projet_id UUID REFERENCES public.projets(id),
  title TEXT NOT NULL,
  description TEXT,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XAF',
  status note_frais_status NOT NULL DEFAULT 'brouillon',
  submitted_at TIMESTAMP WITH TIME ZONE,
  validated_daf_by UUID REFERENCES public.profiles(id),
  validated_daf_at TIMESTAMP WITH TIME ZONE,
  paid_by UUID REFERENCES public.profiles(id),
  paid_at TIMESTAMP WITH TIME ZONE,
  mode_paiement TEXT,
  reference_paiement TEXT,
  rejection_reason TEXT,
  rejected_by UUID REFERENCES public.profiles(id),
  rejected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des lignes de notes de frais
CREATE TABLE public.note_frais_lignes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_frais_id UUID NOT NULL REFERENCES public.notes_frais(id) ON DELETE CASCADE,
  date_depense DATE NOT NULL,
  motif TEXT NOT NULL,
  projet_id UUID REFERENCES public.projets(id),
  montant NUMERIC NOT NULL,
  justificatif_url TEXT,
  justificatif_name TEXT,
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notes_frais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_frais_lignes ENABLE ROW LEVEL SECURITY;

-- Policies notes de frais
CREATE POLICY "Créateur voit ses notes" ON public.notes_frais FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "DAF voit les notes soumises" ON public.notes_frais FOR SELECT USING (has_role(auth.uid(), 'daf'::app_role) AND status != 'brouillon');
CREATE POLICY "Comptable voit notes validées" ON public.notes_frais FOR SELECT USING (is_comptable(auth.uid()) AND status IN ('validee_daf', 'payee'));
CREATE POLICY "Admin voit toutes les notes" ON public.notes_frais FOR SELECT USING (is_admin(auth.uid()) OR is_dg(auth.uid()));
CREATE POLICY "Utilisateurs peuvent créer leurs notes" ON public.notes_frais FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Créateur peut modifier brouillon" ON public.notes_frais FOR UPDATE USING (user_id = auth.uid() AND status = 'brouillon');
CREATE POLICY "DAF peut valider notes" ON public.notes_frais FOR UPDATE USING (has_role(auth.uid(), 'daf'::app_role) AND status = 'soumise');
CREATE POLICY "Comptable peut payer notes" ON public.notes_frais FOR UPDATE USING (is_comptable(auth.uid()) AND status = 'validee_daf');
CREATE POLICY "Admin peut supprimer notes" ON public.notes_frais FOR DELETE USING (is_admin(auth.uid()));

-- Policies lignes
CREATE POLICY "Accès lignes via note" ON public.note_frais_lignes FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.notes_frais nf WHERE nf.id = note_frais_lignes.note_frais_id AND (nf.user_id = auth.uid() OR is_admin(auth.uid()) OR is_dg(auth.uid()) OR has_role(auth.uid(), 'daf'::app_role) OR is_comptable(auth.uid()))));
CREATE POLICY "Créateur peut gérer lignes brouillon" ON public.note_frais_lignes FOR ALL
  USING (EXISTS (SELECT 1 FROM public.notes_frais nf WHERE nf.id = note_frais_lignes.note_frais_id AND nf.user_id = auth.uid() AND nf.status = 'brouillon'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.notes_frais nf WHERE nf.id = note_frais_lignes.note_frais_id AND nf.user_id = auth.uid() AND nf.status = 'brouillon'));

-- Fonction génération référence note de frais
CREATE OR REPLACE FUNCTION public.generate_ndf_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year TEXT;
  _month TEXT;
  _count INT;
  _ref TEXT;
BEGIN
  _year := to_char(now(), 'YYYY');
  _month := to_char(now(), 'MM');
  SELECT COUNT(*) + 1 INTO _count 
  FROM public.notes_frais 
  WHERE reference LIKE 'NDF-' || _year || _month || '-%';
  _ref := 'NDF-' || _year || _month || '-' || lpad(_count::TEXT, 4, '0');
  RETURN _ref;
END;
$$;

-- ==================== 3. MODES DE PAIEMENT (CRUD Admin) ====================

CREATE TABLE public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tous voient les modes de paiement actifs" ON public.payment_methods FOR SELECT USING (is_active = true OR is_admin(auth.uid()));
CREATE POLICY "Admin peut gérer modes paiement" ON public.payment_methods FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Données initiales modes de paiement
INSERT INTO public.payment_methods (code, label, sort_order) VALUES
  ('wave', 'Wave', 1),
  ('orange', 'Orange Money', 2),
  ('mtn', 'MTN Money', 3),
  ('moov', 'Moov Money', 4),
  ('banque', 'Virement Bancaire', 5),
  ('cheque', 'Chèque', 6),
  ('especes', 'Espèces', 7)
ON CONFLICT (code) DO NOTHING;

-- ==================== 4. COMPTES COMPTABLES SYSCOHADA ====================

CREATE TABLE public.comptes_comptables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  libelle TEXT NOT NULL,
  classe INT NOT NULL CHECK (classe BETWEEN 1 AND 9),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.comptes_comptables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tous voient les comptes actifs" ON public.comptes_comptables FOR SELECT USING (is_active = true OR is_admin(auth.uid()));
CREATE POLICY "Admin peut gérer comptes" ON public.comptes_comptables FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Données initiales comptes SYSCOHADA (exemples)
INSERT INTO public.comptes_comptables (code, libelle, classe) VALUES
  ('601', 'Achats de marchandises', 6),
  ('602', 'Achats de matières premières', 6),
  ('604', 'Achats stockés de matières et fournitures consommables', 6),
  ('605', 'Autres achats', 6),
  ('606', 'Achats non stockés de matières et fournitures', 6),
  ('611', 'Transport sur achats', 6),
  ('612', 'Transport sur ventes', 6),
  ('613', 'Transport pour le compte de tiers', 6),
  ('614', 'Transport du personnel', 6),
  ('615', 'Autres frais de transport', 6),
  ('616', 'Assurances', 6),
  ('621', 'Sous-traitance générale', 6),
  ('622', 'Locations et charges locatives', 6),
  ('623', 'Redevances de crédit-bail et contrats assimilés', 6),
  ('624', 'Entretien, réparations et maintenance', 6),
  ('625', 'Primes d''assurance', 6),
  ('626', 'Études, recherches et prestations diverses', 6),
  ('627', 'Publicité, publications, relations publiques', 6),
  ('628', 'Frais de télécommunication', 6),
  ('631', 'Frais bancaires', 6),
  ('632', 'Rémunérations d''intermédiaires et honoraires', 6),
  ('633', 'Frais de formation du personnel', 6),
  ('634', 'Redevances pour brevets, licences, logiciels', 6),
  ('638', 'Autres charges externes', 6),
  ('641', 'Impôts et taxes', 6),
  ('661', 'Rémunération du personnel national', 6),
  ('662', 'Rémunération du personnel expatrié', 6),
  ('663', 'Indemnités forfaitaires versées au personnel', 6),
  ('664', 'Charges sociales', 6),
  ('668', 'Autres charges sociales', 6)
ON CONFLICT (code) DO NOTHING;

-- ==================== 5. BESOIN: ÉDITION LOGISTIQUE AVANT CONVERSION ====================

-- Ajouter colonne pour verrouiller le besoin après conversion
ALTER TABLE public.besoins ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.besoins ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.besoins ADD COLUMN IF NOT EXISTS locked_reason TEXT;

-- Modifier la RLS pour permettre à la logistique de modifier les besoins acceptés non verrouillés
DROP POLICY IF EXISTS "Logistique peut gérer les besoins" ON public.besoins;
CREATE POLICY "Logistique peut gérer les besoins" ON public.besoins FOR UPDATE
  USING (is_logistics(auth.uid()) OR is_admin(auth.uid()))
  WITH CHECK (is_logistics(auth.uid()) OR is_admin(auth.uid()));

-- Créer une policy spécifique pour l'édition des besoins acceptés non verrouillés
CREATE POLICY "Logistique peut éditer besoin accepté non verrouillé" ON public.besoin_lignes FOR ALL
  USING ((is_logistics(auth.uid()) OR is_admin(auth.uid())) AND EXISTS (
    SELECT 1 FROM public.besoins b WHERE b.id = besoin_lignes.besoin_id AND b.status = 'accepte' AND b.is_locked = false
  ))
  WITH CHECK ((is_logistics(auth.uid()) OR is_admin(auth.uid())) AND EXISTS (
    SELECT 1 FROM public.besoins b WHERE b.id = besoin_lignes.besoin_id AND b.status = 'accepte' AND b.is_locked = false
  ));

-- Fonction pour verrouiller le besoin lors de la conversion
CREATE OR REPLACE FUNCTION public.lock_besoin_on_conversion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.besoins 
  SET is_locked = true, 
      locked_at = now(),
      locked_reason = CASE 
        WHEN TG_TABLE_NAME = 'demandes_achat' THEN 'Converti en DA: ' || NEW.reference
        WHEN TG_TABLE_NAME = 'bons_livraison' THEN 'Converti en BL: ' || NEW.reference
        ELSE 'Conversion'
      END
  WHERE id = NEW.besoin_id;
  RETURN NEW;
END;
$$;

-- Trigger pour verrouiller le besoin lors création DA
DROP TRIGGER IF EXISTS lock_besoin_on_da_creation ON public.demandes_achat;
CREATE TRIGGER lock_besoin_on_da_creation
  AFTER INSERT ON public.demandes_achat
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_besoin_on_conversion();

-- Trigger pour verrouiller le besoin lors création BL
DROP TRIGGER IF EXISTS lock_besoin_on_bl_creation ON public.bons_livraison;
CREATE TRIGGER lock_besoin_on_bl_creation
  AFTER INSERT ON public.bons_livraison
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_besoin_on_conversion();

-- ==================== 6. STOCK: AJUSTEMENT OBLIGATOIRE AVEC MOTIF ====================

-- Rendre le motif obligatoire pour les ajustements (via trigger)
CREATE OR REPLACE FUNCTION public.validate_stock_adjustment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.movement_type = 'ajustement' AND (NEW.observations IS NULL OR trim(NEW.observations) = '') THEN
    RAISE EXCEPTION 'Le motif est obligatoire pour les ajustements de stock';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_stock_adjustment_trigger ON public.stock_movements;
CREATE TRIGGER validate_stock_adjustment_trigger
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_stock_adjustment();

-- ==================== 7. PERMISSIONS DAF/COMPTABLE LECTURE STOCK ====================

-- Ajouter les rôles comptable et daf à la lecture du stock (déjà fait via is_dg et has_role daf)
-- Vérifier que la policy existe déjà, sinon elle sera étendue

-- ==================== 8. DASHBOARD SUMMARY FUNCTION ====================

CREATE OR REPLACE FUNCTION public.dashboard_summary_by_role(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result JSONB;
  _is_admin BOOLEAN;
  _is_dg BOOLEAN;
  _is_daf BOOLEAN;
  _is_logistics BOOLEAN;
  _is_achats BOOLEAN;
  _is_comptable BOOLEAN;
  _dept_id UUID;
BEGIN
  -- Check roles
  _is_admin := is_admin(_user_id);
  _is_dg := is_dg(_user_id);
  _is_daf := has_role(_user_id, 'daf'::app_role);
  _is_logistics := is_logistics(_user_id);
  _is_achats := is_achats(_user_id);
  _is_comptable := is_comptable(_user_id);
  
  SELECT department_id INTO _dept_id FROM public.profiles WHERE id = _user_id;
  
  -- Build result based on role
  SELECT jsonb_build_object(
    'besoins', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM public.besoins WHERE (_is_admin OR _is_dg OR _is_daf OR _is_logistics OR user_id = _user_id OR department_id = _dept_id)),
      'cree', (SELECT COUNT(*) FROM public.besoins WHERE status = 'cree' AND (_is_admin OR _is_dg OR _is_daf OR _is_logistics OR user_id = _user_id)),
      'pris_en_charge', (SELECT COUNT(*) FROM public.besoins WHERE status = 'pris_en_charge' AND (_is_admin OR _is_dg OR _is_daf OR _is_logistics)),
      'accepte', (SELECT COUNT(*) FROM public.besoins WHERE status = 'accepte' AND (_is_admin OR _is_dg OR _is_daf OR _is_logistics)),
      'refuse', (SELECT COUNT(*) FROM public.besoins WHERE status = 'refuse' AND (_is_admin OR _is_dg OR _is_daf OR _is_logistics))
    ),
    'demandes_achat', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM public.demandes_achat WHERE (_is_admin OR _is_dg OR _is_daf OR _is_logistics OR _is_achats OR department_id = _dept_id)),
      'brouillon', (SELECT COUNT(*) FROM public.demandes_achat WHERE status = 'brouillon' AND (_is_admin OR _is_logistics)),
      'soumise', (SELECT COUNT(*) FROM public.demandes_achat WHERE status = 'soumise' AND (_is_admin OR _is_achats)),
      'en_analyse', (SELECT COUNT(*) FROM public.demandes_achat WHERE status = 'en_analyse' AND (_is_admin OR _is_achats)),
      'chiffree', (SELECT COUNT(*) FROM public.demandes_achat WHERE status = 'chiffree' AND (_is_admin OR _is_achats)),
      'soumise_validation', (SELECT COUNT(*) FROM public.demandes_achat WHERE status = 'soumise_validation' AND (_is_admin OR _is_dg OR _is_daf)),
      'validee_finance', (SELECT COUNT(*) FROM public.demandes_achat WHERE status = 'validee_finance' AND (_is_admin OR _is_comptable)),
      'payee', (SELECT COUNT(*) FROM public.demandes_achat WHERE status = 'payee' AND (_is_admin OR _is_dg OR _is_daf OR _is_comptable))
    ),
    'bons_livraison', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM public.bons_livraison WHERE (_is_admin OR _is_dg OR _is_logistics OR department_id = _dept_id)),
      'prepare', (SELECT COUNT(*) FROM public.bons_livraison WHERE status = 'prepare' AND (_is_admin OR _is_logistics)),
      'en_attente_validation', (SELECT COUNT(*) FROM public.bons_livraison WHERE status = 'en_attente_validation' AND (_is_admin OR _is_dg)),
      'valide', (SELECT COUNT(*) FROM public.bons_livraison WHERE status = 'valide' AND (_is_admin OR _is_logistics)),
      'livre', (SELECT COUNT(*) FROM public.bons_livraison WHERE status = 'livre' AND (_is_admin OR _is_dg OR _is_logistics))
    ),
    'stock', jsonb_build_object(
      'total_articles', (SELECT COUNT(*) FROM public.articles_stock WHERE (_is_admin OR _is_logistics OR _is_dg OR _is_daf)),
      'disponible', (SELECT COUNT(*) FROM public.articles_stock WHERE status = 'disponible'),
      'epuise', (SELECT COUNT(*) FROM public.articles_stock WHERE status = 'epuise'),
      'low_stock', (SELECT COUNT(*) FROM public.articles_stock WHERE quantity_min IS NOT NULL AND quantity_available <= quantity_min)
    ),
    'notes_frais', CASE WHEN _is_admin OR _is_dg OR _is_daf OR _is_comptable THEN jsonb_build_object(
      'brouillon', (SELECT COUNT(*) FROM public.notes_frais WHERE status = 'brouillon' AND user_id = _user_id),
      'soumise', (SELECT COUNT(*) FROM public.notes_frais WHERE status = 'soumise' AND (_is_daf OR _is_admin)),
      'validee_daf', (SELECT COUNT(*) FROM public.notes_frais WHERE status = 'validee_daf' AND (_is_comptable OR _is_admin)),
      'payee', (SELECT COUNT(*) FROM public.notes_frais WHERE status = 'payee')
    ) ELSE NULL END
  ) INTO _result;
  
  RETURN _result;
END;
$$;

-- Index pour optimisation dashboard
CREATE INDEX IF NOT EXISTS idx_besoins_status ON public.besoins(status);
CREATE INDEX IF NOT EXISTS idx_besoins_created_at ON public.besoins(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_besoins_department_id ON public.besoins(department_id);
CREATE INDEX IF NOT EXISTS idx_demandes_achat_status ON public.demandes_achat(status);
CREATE INDEX IF NOT EXISTS idx_demandes_achat_created_at ON public.demandes_achat(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bons_livraison_status ON public.bons_livraison(status);
CREATE INDEX IF NOT EXISTS idx_notes_frais_status ON public.notes_frais(status);
CREATE INDEX IF NOT EXISTS idx_notes_frais_user_id ON public.notes_frais(user_id);

-- Trigger updated_at pour nouvelles tables
CREATE TRIGGER update_projets_updated_at BEFORE UPDATE ON public.projets FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_notes_frais_updated_at BEFORE UPDATE ON public.notes_frais FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();