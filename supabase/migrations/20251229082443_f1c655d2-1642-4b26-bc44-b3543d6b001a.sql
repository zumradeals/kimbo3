-- 1. Ajouter une politique SELECT pour les articles_stock pour les utilisateurs authentifiés (pour voir le stock dans les formulaires besoin)
DROP POLICY IF EXISTS "Utilisateurs authentifiés voient le stock" ON articles_stock;
CREATE POLICY "Utilisateurs authentifiés voient le stock" 
ON articles_stock 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 2. Corriger la politique INSERT pour bons_livraison pour inclure admin
DROP POLICY IF EXISTS "Logistique peut créer BL" ON bons_livraison;
CREATE POLICY "Logistique peut créer BL" 
ON bons_livraison 
FOR INSERT 
WITH CHECK ((is_logistics(auth.uid()) OR is_admin(auth.uid())) AND (created_by = auth.uid()));

-- 3. Ajouter une politique SELECT pour que la logistique voie le BL après création (retour du INSERT)
DROP POLICY IF EXISTS "Logistique voit tous les BL" ON bons_livraison;
CREATE POLICY "Logistique voit tous les BL" 
ON bons_livraison 
FOR SELECT 
USING (is_logistics(auth.uid()) OR is_admin(auth.uid()));