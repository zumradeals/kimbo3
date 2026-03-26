
-- 1. Add SELECT policy for AAL on bons_livraison
CREATE POLICY "AAL voit tous les BL"
ON public.bons_livraison FOR SELECT
TO public
USING (has_role(auth.uid(), 'aal'::app_role));

-- 2. Add UPDATE policy for AAL on bons_livraison (can validate/reject when status = soumis_aal)
CREATE POLICY "AAL peut valider ou rejeter BL soumis"
ON public.bons_livraison FOR UPDATE
TO public
USING (has_role(auth.uid(), 'aal'::app_role) AND status = 'soumis_aal'::bl_status)
WITH CHECK (has_role(auth.uid(), 'aal'::app_role) AND status IN ('soumis_aal'::bl_status, 'soumis_daf'::bl_status, 'brouillon'::bl_status));

-- 3. Drop old DAF policy that uses wrong status
DROP POLICY IF EXISTS "DAF peut valider BL" ON public.bons_livraison;

-- 4. Recreate DAF UPDATE policy with correct new workflow statuses
CREATE POLICY "DAF peut valider BL"
ON public.bons_livraison FOR UPDATE
TO public
USING (has_role(auth.uid(), 'daf'::app_role) AND status IN ('soumis_daf'::bl_status, 'valide_daf'::bl_status, 'pret_a_livrer'::bl_status))
WITH CHECK (has_role(auth.uid(), 'daf'::app_role) AND status IN ('soumis_daf'::bl_status, 'valide_daf'::bl_status, 'refuse_daf'::bl_status, 'pret_a_livrer'::bl_status));
