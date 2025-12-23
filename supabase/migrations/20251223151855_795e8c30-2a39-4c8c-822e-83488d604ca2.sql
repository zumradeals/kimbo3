-- 1️⃣ ENRICHISSEMENT DU BESOIN INTERNE
-- Ajouter les nouveaux champs au formulaire Besoin
ALTER TABLE public.besoins 
ADD COLUMN IF NOT EXISTS estimated_quantity numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS besoin_type text DEFAULT 'article' CHECK (besoin_type IN ('article', 'service')),
ADD COLUMN IF NOT EXISTS unit text DEFAULT 'unité',
ADD COLUMN IF NOT EXISTS technical_specs text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS intended_usage text DEFAULT NULL;

-- 2️⃣ PIÈCES JOINTES POUR LES DA
-- Ajouter colonnes pour les pièces jointes DA
ALTER TABLE public.demandes_achat
ADD COLUMN IF NOT EXISTS attachment_url text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS attachment_name text DEFAULT NULL;

-- Créer le bucket storage pour les pièces jointes DA
INSERT INTO storage.buckets (id, name, public)
VALUES ('da-attachments', 'da-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Politique pour que les utilisateurs Achats puissent uploader des pièces jointes
CREATE POLICY "Achats peut uploader des pièces jointes DA"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'da-attachments' 
  AND (is_achats(auth.uid()) OR is_admin(auth.uid()))
);

-- Politique pour que tout le monde puisse voir les pièces jointes
CREATE POLICY "Utilisateurs authentifiés peuvent voir pièces jointes DA"
ON storage.objects FOR SELECT
USING (bucket_id = 'da-attachments');

-- Politique pour que les Achats puissent supprimer leurs pièces jointes
CREATE POLICY "Achats peut supprimer pièces jointes DA"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'da-attachments' 
  AND (is_achats(auth.uid()) OR is_admin(auth.uid()))
);

-- 3️⃣ CORRECTION DROITS DA - Permettre à la Logistique de supprimer une DA brouillon
DROP POLICY IF EXISTS "Logistique peut supprimer DA brouillon" ON public.demandes_achat;
CREATE POLICY "Logistique peut supprimer DA brouillon"
ON public.demandes_achat
FOR DELETE
USING (is_logistics(auth.uid()) AND status = 'brouillon');