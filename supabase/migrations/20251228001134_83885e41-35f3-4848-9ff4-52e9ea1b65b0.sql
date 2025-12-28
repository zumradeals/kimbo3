-- Mettre à jour les politiques RLS pour stock_categories
-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Lecture catégories actives pour rôles autorisés" ON public.stock_categories;
DROP POLICY IF EXISTS "Admin DAF peuvent créer catégories" ON public.stock_categories;
DROP POLICY IF EXISTS "Admin DAF peuvent modifier catégories" ON public.stock_categories;
DROP POLICY IF EXISTS "Admin peut supprimer catégories" ON public.stock_categories;

-- Nouvelle politique : Lecture catégories pour rôles autorisés (Stock en lecture)
CREATE POLICY "Lecture catégories pour rôles autorisés"
ON public.stock_categories
FOR SELECT
USING (
  is_admin(auth.uid()) OR 
  is_dg(auth.uid()) OR 
  has_role(auth.uid(), 'daf'::app_role) OR
  is_logistics(auth.uid()) OR
  is_achats(auth.uid())
);

-- Nouvelle politique : Admin, DAF, Logistique peuvent créer catégories
CREATE POLICY "Admin DAF Logistique peuvent créer catégories"
ON public.stock_categories
FOR INSERT
WITH CHECK (
  is_admin(auth.uid()) OR 
  has_role(auth.uid(), 'daf'::app_role) OR
  is_logistics(auth.uid())
);

-- Nouvelle politique : Admin, DAF, Logistique peuvent modifier catégories
CREATE POLICY "Admin DAF Logistique peuvent modifier catégories"
ON public.stock_categories
FOR UPDATE
USING (
  is_admin(auth.uid()) OR 
  has_role(auth.uid(), 'daf'::app_role) OR
  is_logistics(auth.uid())
);

-- Admin et DAF peuvent supprimer (mais l'UI proposera archivage d'abord)
CREATE POLICY "Admin DAF peuvent supprimer catégories"
ON public.stock_categories
FOR DELETE
USING (
  is_admin(auth.uid()) OR 
  has_role(auth.uid(), 'daf'::app_role)
);

-- Ajouter contrainte d'unicité case-insensitive pour name + parent_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_categories_unique_name_parent 
ON public.stock_categories (LOWER(name), COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid));