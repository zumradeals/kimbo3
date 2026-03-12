-- 1. Add AAL UPDATE policy on demandes_achat
CREATE POLICY "AAL peut valider DA chiffrees"
ON public.demandes_achat
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'aal'::app_role) 
  AND status IN ('chiffree'::da_status, 'retour_aal'::da_status)
)
WITH CHECK (
  has_role(auth.uid(), 'aal'::app_role) 
  AND status IN ('soumise_validation'::da_status, 'rejetee_aal'::da_status, 'en_revision_achats'::da_status)
);

-- 2. Fix DAF/DG validation policy to include en_attente_dg and retour_aal in with_check
DROP POLICY IF EXISTS "DAF DG peuvent valider DA" ON public.demandes_achat;
CREATE POLICY "DAF DG peuvent valider DA"
ON public.demandes_achat
FOR UPDATE
TO authenticated
USING (
  (has_role(auth.uid(), 'daf'::app_role) OR is_dg(auth.uid()) OR is_admin(auth.uid()))
  AND status IN ('soumise_validation'::da_status, 'en_attente_dg'::da_status)
)
WITH CHECK (
  (has_role(auth.uid(), 'daf'::app_role) OR is_dg(auth.uid()) OR is_admin(auth.uid()))
  AND status IN (
    'soumise_validation'::da_status, 
    'validee_finance'::da_status, 
    'refusee_finance'::da_status, 
    'en_revision_achats'::da_status,
    'en_attente_dg'::da_status,
    'retour_aal'::da_status
  )
);