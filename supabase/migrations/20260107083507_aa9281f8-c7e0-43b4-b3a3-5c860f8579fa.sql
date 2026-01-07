-- Politique pour permettre à l'Admin d'annuler les besoins (passer au statut 'annulee')
CREATE POLICY "Admin peut annuler les besoins"
ON public.besoins
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Politique pour permettre à l'Admin d'annuler les DA
CREATE POLICY "Admin peut annuler les DA"
ON public.demandes_achat
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Politique pour permettre au service Achats de modifier les articles de DA (quantités, etc.)
-- Vérifions d'abord si elle existe déjà
DROP POLICY IF EXISTS "Achats peut modifier articles DA" ON public.da_articles;

CREATE POLICY "Achats peut modifier articles DA"
ON public.da_articles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM demandes_achat da 
    WHERE da.id = da_articles.da_id 
    AND da.status IN ('en_analyse', 'en_revision_achats', 'chiffree')
    AND (is_achats(auth.uid()) OR is_admin(auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM demandes_achat da 
    WHERE da.id = da_articles.da_id 
    AND da.status IN ('en_analyse', 'en_revision_achats', 'chiffree', 'soumise_validation')
    AND (is_achats(auth.uid()) OR is_admin(auth.uid()))
  )
);