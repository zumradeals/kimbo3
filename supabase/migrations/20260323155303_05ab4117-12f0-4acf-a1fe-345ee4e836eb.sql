
-- Allow AAL to view caisses (needed for project-caisse association)
CREATE POLICY "AAL peut voir les caisses"
  ON public.caisses FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'aal'::app_role));
