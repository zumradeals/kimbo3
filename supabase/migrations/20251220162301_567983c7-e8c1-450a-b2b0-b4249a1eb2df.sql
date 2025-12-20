-- Drop the existing policy that's too restrictive
DROP POLICY IF EXISTS "Logistique peut modifier DA brouillon" ON public.demandes_achat;

-- Create a new policy that allows logistics to update DAs in brouillon status
-- The USING clause checks the current state, WITH CHECK validates the new state
CREATE POLICY "Logistique peut modifier DA brouillon" 
ON public.demandes_achat 
FOR UPDATE 
USING (is_logistics(auth.uid()) AND status = 'brouillon'::da_status)
WITH CHECK (is_logistics(auth.uid()) AND status IN ('brouillon'::da_status, 'soumise'::da_status));