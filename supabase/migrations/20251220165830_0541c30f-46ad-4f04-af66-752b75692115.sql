-- Fix Achats SELECT policy so updated rows (e.g. en_analyse) remain readable (needed for update return=representation)

DROP POLICY IF EXISTS "Achats voit les DA soumises" ON public.demandes_achat;

CREATE POLICY "Achats voit les DA soumises"
ON public.demandes_achat
FOR SELECT
USING (
  is_achats(auth.uid())
  AND status = ANY (ARRAY[
    'soumise'::da_status,
    'en_analyse'::da_status,
    'chiffree'::da_status,
    'soumise_validation'::da_status,
    'en_revision_achats'::da_status,
    'rejetee'::da_status
  ])
);