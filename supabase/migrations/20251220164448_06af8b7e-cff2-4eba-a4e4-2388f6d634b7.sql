-- Drop the existing policy
DROP POLICY IF EXISTS "Achats peut traiter DA" ON public.demandes_achat;

-- Create a comprehensive policy that covers all statuses Achats needs to handle
CREATE POLICY "Achats peut traiter DA" 
ON public.demandes_achat 
FOR UPDATE 
USING (
  (is_achats(auth.uid()) OR is_admin(auth.uid())) 
  AND status IN ('soumise'::da_status, 'en_analyse'::da_status, 'chiffree'::da_status, 'en_revision_achats'::da_status)
)
WITH CHECK (
  (is_achats(auth.uid()) OR is_admin(auth.uid())) 
  AND status IN ('soumise'::da_status, 'en_analyse'::da_status, 'chiffree'::da_status, 'soumise_validation'::da_status, 'rejetee'::da_status)
);