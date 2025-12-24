-- =====================================================
-- MODULE BESOIN - REFONTE COMPLÈTE
-- =====================================================

-- 1. Créer le nouvel enum pour le type de besoin
CREATE TYPE public.besoin_type_enum AS ENUM ('achat', 'transport', 'service', 'reparation', 'location');

-- 2. Créer l'enum pour la catégorie des lignes
CREATE TYPE public.besoin_ligne_category AS ENUM ('materiel', 'service', 'transport', 'autre');

-- 3. Ajouter les nouveaux champs à la table besoins
ALTER TABLE public.besoins 
ADD COLUMN IF NOT EXISTS site_projet TEXT,
ADD COLUMN IF NOT EXISTS objet_besoin VARCHAR(120),
ADD COLUMN IF NOT EXISTS fournisseur_impose BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS fournisseur_impose_nom TEXT,
ADD COLUMN IF NOT EXISTS fournisseur_impose_contact TEXT,
ADD COLUMN IF NOT EXISTS lieu_livraison TEXT,
ADD COLUMN IF NOT EXISTS besoin_vehicule BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS besoin_avance_caisse BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS avance_caisse_montant NUMERIC,
ADD COLUMN IF NOT EXISTS confirmation_engagement BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS return_comment TEXT;

-- 4. Créer la table besoin_lignes
CREATE TABLE IF NOT EXISTS public.besoin_lignes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    besoin_id UUID NOT NULL REFERENCES public.besoins(id) ON DELETE CASCADE,
    designation TEXT NOT NULL,
    category besoin_ligne_category NOT NULL DEFAULT 'materiel',
    unit TEXT NOT NULL DEFAULT 'unité',
    quantity NUMERIC NOT NULL DEFAULT 1,
    urgency besoin_urgency NOT NULL DEFAULT 'normale',
    justification TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Créer la table besoin_attachments
CREATE TABLE IF NOT EXISTS public.besoin_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    besoin_id UUID NOT NULL REFERENCES public.besoins(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Activer RLS sur les nouvelles tables
ALTER TABLE public.besoin_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.besoin_attachments ENABLE ROW LEVEL SECURITY;

-- 7. Policies pour besoin_lignes (héritent des droits du besoin parent)
CREATE POLICY "Créateur peut voir ses lignes"
ON public.besoin_lignes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.besoins b 
        WHERE b.id = besoin_lignes.besoin_id 
        AND b.user_id = auth.uid()
    )
);

CREATE POLICY "Logistique voit toutes les lignes"
ON public.besoin_lignes FOR SELECT
USING (is_logistics(auth.uid()) OR is_admin(auth.uid()));

CREATE POLICY "Admin voit toutes les lignes"
ON public.besoin_lignes FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "DG DAF voient toutes les lignes"
ON public.besoin_lignes FOR SELECT
USING (is_dg(auth.uid()) OR has_role(auth.uid(), 'daf'::app_role));

CREATE POLICY "Créateur peut insérer ses lignes"
ON public.besoin_lignes FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.besoins b 
        WHERE b.id = besoin_lignes.besoin_id 
        AND b.user_id = auth.uid()
        AND b.status = 'cree'
    )
);

CREATE POLICY "Créateur peut modifier ses lignes si statut cree"
ON public.besoin_lignes FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.besoins b 
        WHERE b.id = besoin_lignes.besoin_id 
        AND b.user_id = auth.uid()
        AND b.status = 'cree'
    )
);

CREATE POLICY "Admin peut supprimer les lignes"
ON public.besoin_lignes FOR DELETE
USING (is_admin(auth.uid()));

-- 8. Policies pour besoin_attachments
CREATE POLICY "Créateur peut voir ses pièces jointes"
ON public.besoin_attachments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.besoins b 
        WHERE b.id = besoin_attachments.besoin_id 
        AND b.user_id = auth.uid()
    )
);

CREATE POLICY "Logistique voit toutes les pièces jointes"
ON public.besoin_attachments FOR SELECT
USING (is_logistics(auth.uid()) OR is_admin(auth.uid()));

CREATE POLICY "Admin voit toutes les pièces jointes"
ON public.besoin_attachments FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "DG DAF voient toutes les pièces jointes"
ON public.besoin_attachments FOR SELECT
USING (is_dg(auth.uid()) OR has_role(auth.uid(), 'daf'::app_role));

CREATE POLICY "Créateur peut ajouter des pièces jointes"
ON public.besoin_attachments FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.besoins b 
        WHERE b.id = besoin_attachments.besoin_id 
        AND b.user_id = auth.uid()
        AND b.status = 'cree'
    )
);

CREATE POLICY "Créateur peut supprimer ses pièces jointes si statut cree"
ON public.besoin_attachments FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.besoins b 
        WHERE b.id = besoin_attachments.besoin_id 
        AND b.user_id = auth.uid()
        AND b.status = 'cree'
    )
);

CREATE POLICY "Admin peut supprimer les pièces jointes"
ON public.besoin_attachments FOR DELETE
USING (is_admin(auth.uid()));

-- 9. Index pour performance
CREATE INDEX IF NOT EXISTS idx_besoin_lignes_besoin_id ON public.besoin_lignes(besoin_id);
CREATE INDEX IF NOT EXISTS idx_besoin_attachments_besoin_id ON public.besoin_attachments(besoin_id);