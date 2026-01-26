-- Drop the existing restrictive delete policy
DROP POLICY IF EXISTS "Admin peut supprimer les tiers" ON public.tiers;

-- Create a new delete policy that allows the same roles as other operations
CREATE POLICY "Roles autorisés peuvent supprimer les tiers"
ON public.tiers
FOR DELETE
USING (
  is_logistics(auth.uid()) OR 
  is_achats(auth.uid()) OR 
  is_comptable(auth.uid()) OR 
  has_role(auth.uid(), 'daf'::app_role) OR 
  is_dg(auth.uid()) OR 
  is_admin(auth.uid())
);