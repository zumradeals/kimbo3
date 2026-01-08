
-- Supprimer l'ancienne politique SELECT sur da_articles
DROP POLICY IF EXISTS "Accès articles DA via DA" ON public.da_articles;

-- Créer la nouvelle politique SELECT incluant le DAF
CREATE POLICY "Accès articles DA via DA" 
ON public.da_articles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM demandes_achat da
    WHERE da.id = da_articles.da_id
    AND (
      is_admin(auth.uid()) OR 
      is_dg(auth.uid()) OR 
      is_logistics(auth.uid()) OR 
      is_achats(auth.uid()) OR 
      has_role(auth.uid(), 'daf'::app_role) OR
      da.department_id = get_user_department(auth.uid())
    )
  )
);
