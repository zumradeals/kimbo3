-- Add RLS policy for DAF to view DA in soumise_validation, validee_finance, refusee_finance, en_revision_achats, payee statuses
CREATE POLICY "DAF voit toutes les DA validées et en attente"
ON public.demandes_achat
FOR SELECT
USING (
  has_role(auth.uid(), 'daf'::app_role) 
  AND status IN ('soumise_validation', 'validee_finance', 'refusee_finance', 'en_revision_achats', 'payee', 'rejetee_comptabilite')
);