-- Allow logistics to move BL directly from brouillon/prepare to pret_a_livrer, livre, cloture
DROP POLICY IF EXISTS "Logistique peut modifier BL brouillon" ON public.bons_livraison;
CREATE POLICY "Logistique peut modifier BL brouillon"
ON public.bons_livraison
FOR UPDATE
TO authenticated
USING (
  is_logistics(auth.uid())
  AND status = ANY (ARRAY['brouillon'::bl_status, 'prepare'::bl_status, 'refusee'::bl_status, 'refuse_daf'::bl_status])
)
WITH CHECK (
  is_logistics(auth.uid())
  AND status = ANY (ARRAY['brouillon'::bl_status, 'prepare'::bl_status, 'pret_a_livrer'::bl_status, 'livre'::bl_status, 'livree_partiellement'::bl_status, 'cloture'::bl_status])
);
