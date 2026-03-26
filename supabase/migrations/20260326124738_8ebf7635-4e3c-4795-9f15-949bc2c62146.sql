-- Renforcer les politiques RLS de soumission du workflow BL
DROP POLICY IF EXISTS "Logistique peut modifier BL" ON public.bons_livraison;

CREATE POLICY "Logistique peut modifier BL brouillon"
ON public.bons_livraison
FOR UPDATE
TO authenticated
USING (
  public.is_logistics(auth.uid())
  AND status IN ('brouillon'::public.bl_status, 'prepare'::public.bl_status, 'refusee'::public.bl_status, 'refuse_daf'::public.bl_status)
)
WITH CHECK (
  public.is_logistics(auth.uid())
  AND status IN ('brouillon'::public.bl_status, 'prepare'::public.bl_status, 'soumis_aal'::public.bl_status)
);

CREATE POLICY "Logistique peut preparer livraison BL"
ON public.bons_livraison
FOR UPDATE
TO authenticated
USING (
  public.is_logistics(auth.uid())
  AND status IN ('valide_daf'::public.bl_status, 'pret_a_livrer'::public.bl_status, 'livre'::public.bl_status)
)
WITH CHECK (
  public.is_logistics(auth.uid())
  AND status IN ('pret_a_livrer'::public.bl_status, 'livre'::public.bl_status, 'livree_partiellement'::public.bl_status, 'cloture'::public.bl_status)
);