-- Allow DAF to create projects
CREATE POLICY "DAF peut créer projets"
ON public.projets
FOR INSERT
TO public
WITH CHECK (has_role(auth.uid(), 'daf'::app_role));