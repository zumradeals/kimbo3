-- Allow DAF to update projects
CREATE POLICY "DAF can update projects"
ON public.projets
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'daf'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'daf'::app_role));