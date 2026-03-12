-- Allow Logistics to create projects
CREATE POLICY "Logistique peut créer projets"
  ON public.projets FOR INSERT
  WITH CHECK (is_logistics(auth.uid()) AND created_by = auth.uid());

-- Allow Logistics to modify draft projects they created
CREATE POLICY "Logistique peut modifier projets brouillon"
  ON public.projets FOR UPDATE
  USING (is_logistics(auth.uid()) AND status = 'brouillon' AND created_by = auth.uid())
  WITH CHECK (is_logistics(auth.uid()) AND status IN ('brouillon', 'soumis_daf'));