-- Allow DAF to insert projects
CREATE POLICY "DAF can insert projects"
ON public.projets
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'daf'::app_role));