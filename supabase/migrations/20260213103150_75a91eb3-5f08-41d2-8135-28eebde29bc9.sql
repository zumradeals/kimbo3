
-- Add new validation columns to projets
ALTER TABLE public.projets 
  ADD COLUMN IF NOT EXISTS validated_daf_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS validated_daf_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS submitted_daf_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_daf_by uuid REFERENCES auth.users(id);

-- Update existing projects: current 'actif' projects should remain 'actif' (already validated)
-- New projects created by AAL will start as 'brouillon'

-- Drop old INSERT policies (logistique, DAF)
DROP POLICY IF EXISTS "Logistique Admin peuvent créer projets" ON public.projets;
DROP POLICY IF EXISTS "DAF can insert projects" ON public.projets;

-- Drop old UPDATE policies
DROP POLICY IF EXISTS "Logistique Admin peuvent modifier projets" ON public.projets;
DROP POLICY IF EXISTS "DAF can update projects" ON public.projets;

-- Drop old DELETE policies  
DROP POLICY IF EXISTS "Admin peut supprimer projets" ON public.projets;
DROP POLICY IF EXISTS "DAF can delete projects" ON public.projets;

-- Drop old SELECT policy
DROP POLICY IF EXISTS "Tous peuvent voir les projets actifs" ON public.projets;

-- NEW INSERT: Only AAL + Admin can create projects
CREATE POLICY "AAL Admin peuvent créer projets"
ON public.projets FOR INSERT
WITH CHECK (has_role(auth.uid(), 'aal'::app_role) OR is_admin(auth.uid()));

-- NEW UPDATE: AAL can update projects in brouillon only
CREATE POLICY "AAL peut modifier projets brouillon"
ON public.projets FOR UPDATE
USING (has_role(auth.uid(), 'aal'::app_role) AND status = 'brouillon')
WITH CHECK (has_role(auth.uid(), 'aal'::app_role) AND status IN ('brouillon', 'soumis_daf'));

-- NEW UPDATE: DAF can update projects in soumis_daf (for validation/rejection)
CREATE POLICY "DAF peut valider ou refuser projets soumis"
ON public.projets FOR UPDATE
USING (has_role(auth.uid(), 'daf'::app_role) AND status = 'soumis_daf')
WITH CHECK (has_role(auth.uid(), 'daf'::app_role) AND status IN ('soumis_daf', 'valide_daf', 'brouillon'));

-- NEW UPDATE: DAF can also update active/validated projects (status management)
CREATE POLICY "DAF peut gérer projets validés"
ON public.projets FOR UPDATE
USING (has_role(auth.uid(), 'daf'::app_role) AND status IN ('valide_daf', 'actif', 'termine', 'suspendu'))
WITH CHECK (has_role(auth.uid(), 'daf'::app_role) AND status IN ('actif', 'termine', 'suspendu'));

-- NEW UPDATE: Admin can always update
CREATE POLICY "Admin peut modifier tous les projets"
ON public.projets FOR UPDATE
USING (is_admin(auth.uid()));

-- NEW DELETE: Only Admin can delete
CREATE POLICY "Admin peut supprimer projets"
ON public.projets FOR DELETE
USING (is_admin(auth.uid()));

-- NEW SELECT: Everyone sees active/validated projects, AAL/Admin/DG/DAF see all
CREATE POLICY "Visibilité projets selon statut et rôle"
ON public.projets FOR SELECT
USING (
  -- Admin, DG, DAF, AAL see all projects
  is_admin(auth.uid()) OR is_dg(auth.uid()) OR has_role(auth.uid(), 'daf'::app_role) OR has_role(auth.uid(), 'aal'::app_role)
  -- Others only see active/validated projects
  OR (status IN ('actif', 'termine', 'suspendu', 'valide_daf') AND is_active = true)
);
