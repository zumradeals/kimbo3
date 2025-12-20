-- =====================================================
-- MODULE TRANSFORMATION LOGISTIQUE (v2)
-- Besoin → DA (Demande d'Achat) OU BL (Bon de Livraison)
-- =====================================================

-- Enum pour les statuts DA
CREATE TYPE public.da_status AS ENUM (
  'brouillon',
  'soumise',
  'rejetee'
);

-- Enum pour les statuts BL
CREATE TYPE public.bl_status AS ENUM (
  'prepare',
  'en_attente_validation',
  'valide',
  'livre'
);

-- Enum pour les catégories d'achat
CREATE TYPE public.da_category AS ENUM (
  'fournitures',
  'equipement',
  'service',
  'maintenance',
  'informatique',
  'autre'
);

-- Enum pour les priorités
CREATE TYPE public.da_priority AS ENUM (
  'basse',
  'normale',
  'haute',
  'urgente'
);

-- =====================================================
-- TABLE: Demandes d'Achat (DA)
-- =====================================================
CREATE TABLE public.demandes_achat (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  besoin_id UUID NOT NULL REFERENCES public.besoins(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES public.departments(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  
  -- Contenu normalisé
  description TEXT NOT NULL,
  category da_category NOT NULL,
  priority da_priority NOT NULL DEFAULT 'normale',
  desired_date DATE,
  observations TEXT,
  
  -- Statut
  status da_status NOT NULL DEFAULT 'brouillon',
  rejection_reason TEXT,
  rejected_by UUID REFERENCES public.profiles(id),
  rejected_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- TABLE: Articles DA (lignes de la demande)
-- =====================================================
CREATE TABLE public.da_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  da_id UUID NOT NULL REFERENCES public.demandes_achat(id) ON DELETE CASCADE,
  designation TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'unité',
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- TABLE: Bons de Livraison (BL)
-- =====================================================
CREATE TABLE public.bons_livraison (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  besoin_id UUID NOT NULL REFERENCES public.besoins(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES public.departments(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  
  -- Livraison
  delivery_date DATE,
  warehouse TEXT,
  observations TEXT,
  
  -- Statut
  status bl_status NOT NULL DEFAULT 'prepare',
  validated_by UUID REFERENCES public.profiles(id),
  validated_at TIMESTAMPTZ,
  delivered_by UUID REFERENCES public.profiles(id),
  delivered_at TIMESTAMPTZ,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- TABLE: Articles BL (lignes du bon)
-- =====================================================
CREATE TABLE public.bl_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bl_id UUID NOT NULL REFERENCES public.bons_livraison(id) ON DELETE CASCADE,
  designation TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'unité',
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- TRIGGERS updated_at
-- =====================================================
CREATE TRIGGER update_demandes_achat_updated_at
  BEFORE UPDATE ON public.demandes_achat
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_bons_livraison_updated_at
  BEFORE UPDATE ON public.bons_livraison
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- FONCTION: Génération référence DA (DA-YYYY-XXXX)
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_da_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year TEXT;
  _count INT;
  _ref TEXT;
BEGIN
  _year := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO _count 
  FROM public.demandes_achat 
  WHERE reference LIKE 'DA-' || _year || '-%';
  _ref := 'DA-' || _year || '-' || lpad(_count::TEXT, 4, '0');
  RETURN _ref;
END;
$$;

-- =====================================================
-- FONCTION: Génération référence BL (BL-YYYY-XXXX)
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_bl_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year TEXT;
  _count INT;
  _ref TEXT;
BEGIN
  _year := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO _count 
  FROM public.bons_livraison 
  WHERE reference LIKE 'BL-' || _year || '-%';
  _ref := 'BL-' || _year || '-' || lpad(_count::TEXT, 4, '0');
  RETURN _ref;
END;
$$;

-- =====================================================
-- FONCTION: Vérifier si un Besoin peut être transformé
-- =====================================================
CREATE OR REPLACE FUNCTION public.can_transform_besoin(_besoin_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.demandes_achat WHERE besoin_id = _besoin_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.bons_livraison WHERE besoin_id = _besoin_id
  ) AND EXISTS (
    SELECT 1 FROM public.besoins WHERE id = _besoin_id AND status = 'accepte'
  )
$$;

-- =====================================================
-- FONCTION: Vérifier si utilisateur est Achats
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_achats(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('responsable_achats', 'agent_achats')
  )
$$;

-- =====================================================
-- RLS: Demandes d'Achat
-- =====================================================
ALTER TABLE public.demandes_achat ENABLE ROW LEVEL SECURITY;

-- Admin voit tout
CREATE POLICY "Admin voit toutes les DA"
ON public.demandes_achat FOR SELECT
USING (is_admin(auth.uid()));

-- DG voit tout
CREATE POLICY "DG voit toutes les DA"
ON public.demandes_achat FOR SELECT
USING (is_dg(auth.uid()));

-- Logistique voit tout
CREATE POLICY "Logistique voit toutes les DA"
ON public.demandes_achat FOR SELECT
USING (is_logistics(auth.uid()));

-- Achats voit les DA soumises
CREATE POLICY "Achats voit les DA soumises"
ON public.demandes_achat FOR SELECT
USING (is_achats(auth.uid()) AND status IN ('soumise', 'rejetee'));

-- Département demandeur voit ses DA
CREATE POLICY "Département voit ses DA"
ON public.demandes_achat FOR SELECT
USING (department_id = get_user_department(auth.uid()));

-- Logistique peut créer des DA
CREATE POLICY "Logistique peut créer DA"
ON public.demandes_achat FOR INSERT
WITH CHECK (is_logistics(auth.uid()) AND created_by = auth.uid());

-- Logistique peut modifier DA brouillon
CREATE POLICY "Logistique peut modifier DA brouillon"
ON public.demandes_achat FOR UPDATE
USING (is_logistics(auth.uid()) AND status = 'brouillon');

-- Achats peut rejeter DA soumise
CREATE POLICY "Achats peut rejeter DA soumise"
ON public.demandes_achat FOR UPDATE
USING (is_achats(auth.uid()) AND status = 'soumise');

-- Admin peut supprimer
CREATE POLICY "Admin peut supprimer DA"
ON public.demandes_achat FOR DELETE
USING (is_admin(auth.uid()));

-- =====================================================
-- RLS: Articles DA
-- =====================================================
ALTER TABLE public.da_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accès articles DA via DA"
ON public.da_articles FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.demandes_achat da 
  WHERE da.id = da_id 
  AND (is_admin(auth.uid()) OR is_dg(auth.uid()) OR is_logistics(auth.uid()) 
       OR is_achats(auth.uid()) OR da.department_id = get_user_department(auth.uid()))
));

CREATE POLICY "Logistique peut gérer articles DA"
ON public.da_articles FOR ALL
USING (is_logistics(auth.uid()))
WITH CHECK (is_logistics(auth.uid()));

-- =====================================================
-- RLS: Bons de Livraison
-- =====================================================
ALTER TABLE public.bons_livraison ENABLE ROW LEVEL SECURITY;

-- Admin voit tout
CREATE POLICY "Admin voit tous les BL"
ON public.bons_livraison FOR SELECT
USING (is_admin(auth.uid()));

-- DG voit tout
CREATE POLICY "DG voit tous les BL"
ON public.bons_livraison FOR SELECT
USING (is_dg(auth.uid()));

-- Logistique voit tout
CREATE POLICY "Logistique voit tous les BL"
ON public.bons_livraison FOR SELECT
USING (is_logistics(auth.uid()));

-- Département demandeur voit ses BL
CREATE POLICY "Département voit ses BL"
ON public.bons_livraison FOR SELECT
USING (department_id = get_user_department(auth.uid()));

-- Logistique peut créer des BL
CREATE POLICY "Logistique peut créer BL"
ON public.bons_livraison FOR INSERT
WITH CHECK (is_logistics(auth.uid()) AND created_by = auth.uid());

-- Logistique peut modifier BL
CREATE POLICY "Logistique peut modifier BL"
ON public.bons_livraison FOR UPDATE
USING (is_logistics(auth.uid()));

-- Admin peut supprimer
CREATE POLICY "Admin peut supprimer BL"
ON public.bons_livraison FOR DELETE
USING (is_admin(auth.uid()));

-- =====================================================
-- RLS: Articles BL
-- =====================================================
ALTER TABLE public.bl_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accès articles BL via BL"
ON public.bl_articles FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.bons_livraison bl 
  WHERE bl.id = bl_id 
  AND (is_admin(auth.uid()) OR is_dg(auth.uid()) OR is_logistics(auth.uid()) 
       OR bl.department_id = get_user_department(auth.uid()))
));

CREATE POLICY "Logistique peut gérer articles BL"
ON public.bl_articles FOR ALL
USING (is_logistics(auth.uid()))
WITH CHECK (is_logistics(auth.uid()));

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

-- Notification lors création DA
CREATE OR REPLACE FUNCTION public.notify_on_da_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _besoin RECORD;
BEGIN
  SELECT b.*, p.first_name, p.last_name 
  INTO _besoin 
  FROM public.besoins b
  JOIN public.profiles p ON p.id = b.user_id
  WHERE b.id = NEW.besoin_id;
  
  -- Notifier le créateur du besoin
  PERFORM create_notification(
    _besoin.user_id,
    'da_created',
    'Demande d''Achat créée',
    CONCAT('Votre besoin "', _besoin.title, '" a été transformé en Demande d''Achat (', NEW.reference, ')'),
    '/demandes-achat/' || NEW.id
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_da_created
  AFTER INSERT ON public.demandes_achat
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_da_created();

-- Notification lors soumission DA aux Achats
CREATE OR REPLACE FUNCTION public.notify_on_da_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _achats_user RECORD;
BEGIN
  IF OLD.status = 'brouillon' AND NEW.status = 'soumise' THEN
    -- Notifier tous les utilisateurs Achats
    FOR _achats_user IN 
      SELECT DISTINCT ur.user_id 
      FROM public.user_roles ur
      WHERE ur.role IN ('responsable_achats', 'agent_achats')
    LOOP
      PERFORM create_notification(
        _achats_user.user_id,
        'da_submitted',
        'Nouvelle DA à traiter',
        CONCAT('La demande d''achat ', NEW.reference, ' nécessite votre attention'),
        '/demandes-achat/' || NEW.id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_da_submitted
  AFTER UPDATE ON public.demandes_achat
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_da_submitted();

-- Notification lors création BL
CREATE OR REPLACE FUNCTION public.notify_on_bl_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _besoin RECORD;
  _dg_user RECORD;
BEGIN
  SELECT b.*, p.first_name, p.last_name 
  INTO _besoin 
  FROM public.besoins b
  JOIN public.profiles p ON p.id = b.user_id
  WHERE b.id = NEW.besoin_id;
  
  -- Notifier le créateur du besoin
  PERFORM create_notification(
    _besoin.user_id,
    'bl_created',
    'Bon de Livraison créé',
    CONCAT('Votre besoin "', _besoin.title, '" sera livré depuis le stock (', NEW.reference, ')'),
    '/bons-livraison/' || NEW.id
  );
  
  -- Notifier le DG
  FOR _dg_user IN 
    SELECT DISTINCT ur.user_id 
    FROM public.user_roles ur
    WHERE ur.role = 'dg'
  LOOP
    PERFORM create_notification(
      _dg_user.user_id,
      'bl_created',
      'Nouveau Bon de Livraison',
      CONCAT('BL ', NEW.reference, ' créé pour livraison depuis stock'),
      '/bons-livraison/' || NEW.id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_bl_created
  AFTER INSERT ON public.bons_livraison
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_bl_created();