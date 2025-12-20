-- Fix RLS: allow DAF/DG to validate a DA by updating status out of 'soumise_validation'
-- Without a WITH CHECK clause, UPDATE can fail with: "new row violates row-level security policy"

DROP POLICY IF EXISTS "DAF DG peuvent valider DA" ON public.demandes_achat;

CREATE POLICY "DAF DG peuvent valider DA"
ON public.demandes_achat
FOR UPDATE
USING (
  (has_role(auth.uid(), 'daf'::app_role) OR is_dg(auth.uid()) OR is_admin(auth.uid()))
  AND status = 'soumise_validation'::da_status
)
WITH CHECK (
  (has_role(auth.uid(), 'daf'::app_role) OR is_dg(auth.uid()) OR is_admin(auth.uid()))
  AND status = ANY (ARRAY[
    'soumise_validation'::da_status,
    'validee_finance'::da_status,
    'refusee_finance'::da_status,
    'en_revision_achats'::da_status
  ])
);
