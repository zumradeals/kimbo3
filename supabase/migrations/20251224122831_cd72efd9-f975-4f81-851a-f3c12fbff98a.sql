-- 1. Allow DAF to delete projects
CREATE POLICY "DAF can delete projects"
ON public.projets
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'daf'::app_role));

-- 2. DAF can do comptable operations on ecritures_comptables
CREATE POLICY "DAF peut creer ecritures"
ON public.ecritures_comptables
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'daf'::app_role) AND created_by = auth.uid());

CREATE POLICY "DAF peut modifier ecritures non validees"
ON public.ecritures_comptables
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'daf'::app_role) AND is_validated = false);

-- 3. DAF can do comptable operations on demandes_achat (payer les DA)
CREATE POLICY "DAF peut traiter DA validees comme comptable"
ON public.demandes_achat
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'daf'::app_role) AND status = 'validee_finance'::da_status)
WITH CHECK (public.has_role(auth.uid(), 'daf'::app_role) AND status = ANY (ARRAY['validee_finance'::da_status, 'payee'::da_status, 'rejetee_comptabilite'::da_status]));

-- 4. DAF can do achats operations on da_article_prices
CREATE POLICY "DAF peut gerer prix articles"
ON public.da_article_prices
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'daf'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'daf'::app_role));

-- 5. DAF can do achats operations on demandes_achat
CREATE POLICY "DAF peut traiter DA comme achats"
ON public.demandes_achat
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'daf'::app_role) AND status = ANY (ARRAY['soumise'::da_status, 'en_analyse'::da_status, 'chiffree'::da_status, 'en_revision_achats'::da_status]))
WITH CHECK (public.has_role(auth.uid(), 'daf'::app_role) AND status = ANY (ARRAY['soumise'::da_status, 'en_analyse'::da_status, 'chiffree'::da_status, 'soumise_validation'::da_status, 'rejetee'::da_status]));

-- 6. DAF can see all DA like achats
CREATE POLICY "DAF voit toutes les DA"
ON public.demandes_achat
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'daf'::app_role));

-- 7. DAF can manage fournisseurs like achats
CREATE POLICY "DAF peut creer fournisseurs"
ON public.fournisseurs
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'daf'::app_role));

CREATE POLICY "DAF peut modifier fournisseurs"
ON public.fournisseurs
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'daf'::app_role));

-- 8. DAF can pay notes de frais like comptable
CREATE POLICY "DAF peut payer notes frais"
ON public.notes_frais
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'daf'::app_role) AND status = 'validee_daf'::note_frais_status);