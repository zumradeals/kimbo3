
-- AAL can see BL articles
CREATE POLICY "AAL voit les articles BL"
ON public.bl_articles FOR SELECT
TO public
USING (has_role(auth.uid(), 'aal'::app_role));

-- DAF can see BL articles
CREATE POLICY "DAF voit les articles BL"
ON public.bl_articles FOR SELECT
TO public
USING (has_role(auth.uid(), 'daf'::app_role));
