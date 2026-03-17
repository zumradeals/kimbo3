-- Add DAF role to projet_caisses INSERT policy
DROP POLICY IF EXISTS "Créateurs peuvent lier caisses" ON public.projet_caisses;
CREATE POLICY "Créateurs peuvent lier caisses"
ON public.projet_caisses
FOR INSERT
WITH CHECK (
  is_admin(auth.uid()) 
  OR has_role(auth.uid(), 'aal'::app_role) 
  OR is_logistics(auth.uid())
  OR has_role(auth.uid(), 'daf'::app_role)
);

-- Add DAF role to projet_caisses DELETE policy
DROP POLICY IF EXISTS "Créateurs peuvent délier caisses" ON public.projet_caisses;
CREATE POLICY "Créateurs peuvent délier caisses"
ON public.projet_caisses
FOR DELETE
USING (
  is_admin(auth.uid()) 
  OR has_role(auth.uid(), 'aal'::app_role) 
  OR is_logistics(auth.uid())
  OR has_role(auth.uid(), 'daf'::app_role)
);

-- Add DAF role to projet_caisses UPDATE policy
DROP POLICY IF EXISTS "Admin peut modifier liens caisses" ON public.projet_caisses;
CREATE POLICY "Admin DAF peut modifier liens caisses"
ON public.projet_caisses
FOR UPDATE
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'daf'::app_role))
WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'daf'::app_role));