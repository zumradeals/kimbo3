-- Update BL policy to allow logistique to submit directly to soumis_daf (AAL bypass)
DROP POLICY IF EXISTS "Logistique peut modifier BL brouillon" ON public.bons_livraison;

CREATE POLICY "Logistique peut modifier BL brouillon"
ON public.bons_livraison
FOR UPDATE
TO authenticated
USING (
  is_logistics(auth.uid()) AND (status = ANY (ARRAY['brouillon'::bl_status, 'prepare'::bl_status, 'refusee'::bl_status, 'refuse_daf'::bl_status]))
)
WITH CHECK (
  is_logistics(auth.uid()) AND (status = ANY (ARRAY['brouillon'::bl_status, 'prepare'::bl_status, 'soumis_aal'::bl_status, 'soumis_daf'::bl_status]))
);