
-- AAL peut voir les besoins (lecture seule)
CREATE POLICY "AAL voit les besoins"
  ON public.besoins
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'aal'::app_role));

-- AAL peut voir les lignes de besoins (lecture seule)
CREATE POLICY "AAL voit les lignes besoins"
  ON public.besoin_lignes
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'aal'::app_role));

-- AAL peut voir les pièces jointes besoins (lecture seule)
CREATE POLICY "AAL voit les pièces jointes besoins"
  ON public.besoin_attachments
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'aal'::app_role));

-- AAL peut voir les demandes d'achat (lecture seule)
CREATE POLICY "AAL voit les demandes achat"
  ON public.demandes_achat
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'aal'::app_role));

-- AAL peut voir les articles DA (lecture seule)
CREATE POLICY "AAL voit les articles DA"
  ON public.da_articles
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'aal'::app_role));

-- AAL peut voir les prix articles DA (lecture seule)
CREATE POLICY "AAL voit les prix articles DA"
  ON public.da_article_prices
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'aal'::app_role));
