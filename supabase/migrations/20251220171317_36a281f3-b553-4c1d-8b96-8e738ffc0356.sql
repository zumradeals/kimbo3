-- Fix RLS: allow Comptable to update DA from 'validee_finance' to 'payee' or 'rejetee_comptabilite'
-- The WITH CHECK clause was missing, causing "new row violates row-level security policy"

DROP POLICY IF EXISTS "Comptable peut traiter DA validees" ON public.demandes_achat;

CREATE POLICY "Comptable peut traiter DA validees"
ON public.demandes_achat
FOR UPDATE
USING (
  is_comptable(auth.uid()) AND status = 'validee_finance'::da_status
)
WITH CHECK (
  is_comptable(auth.uid()) 
  AND status = ANY (ARRAY[
    'validee_finance'::da_status,
    'payee'::da_status,
    'rejetee_comptabilite'::da_status
  ])
);