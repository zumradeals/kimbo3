-- Politique pour permettre au DAF d'insérer des articles dans le stock
CREATE POLICY "DAF peut ajouter au stock" 
ON public.articles_stock 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'daf'::app_role));