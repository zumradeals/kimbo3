
-- Add AAL read access to tiers table
DROP POLICY IF EXISTS "Roles autorisés peuvent voir les tiers" ON public.tiers;
CREATE POLICY "Roles autorisés peuvent voir les tiers"
ON public.tiers
FOR SELECT
USING (
  is_logistics(auth.uid()) OR 
  is_achats(auth.uid()) OR 
  is_comptable(auth.uid()) OR 
  has_role(auth.uid(), 'daf'::app_role) OR 
  is_dg(auth.uid()) OR 
  is_admin(auth.uid()) OR
  has_role(auth.uid(), 'aal'::app_role)
);

-- Add AAL read access to fournisseurs table
DROP POLICY IF EXISTS "Utilisateurs voient fournisseurs actifs" ON public.fournisseurs;
CREATE POLICY "Utilisateurs voient fournisseurs actifs"
ON public.fournisseurs
FOR SELECT
USING (
  (is_active = true) OR 
  is_admin(auth.uid()) OR 
  is_achats(auth.uid())
);

-- Add explicit AAL SELECT policy for fournisseurs
CREATE POLICY "AAL peut voir les fournisseurs"
ON public.fournisseurs
FOR SELECT
USING (has_role(auth.uid(), 'aal'::app_role));
