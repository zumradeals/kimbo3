-- Allow owner to delete their own expressions in brouillon, soumis, rejete_departement
DROP POLICY IF EXISTS "Admin can delete expressions" ON public.expressions_besoin;

CREATE POLICY "Admin peut supprimer expressions"
ON public.expressions_besoin FOR DELETE TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Proprietaire peut supprimer expressions brouillon soumis rejete"
ON public.expressions_besoin FOR DELETE TO authenticated
USING (
  user_id = auth.uid() 
  AND status IN ('brouillon', 'soumis', 'rejete_departement')
);

-- Also allow deleting associated lignes when owner deletes expression
DROP POLICY IF EXISTS "Users can delete lines on their own draft expressions" ON public.expressions_besoin_lignes;

CREATE POLICY "Users can delete lines on their own expressions"
ON public.expressions_besoin_lignes FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM expressions_besoin eb
    WHERE eb.id = expressions_besoin_lignes.expression_id
    AND (
      (eb.user_id = auth.uid() AND eb.status IN ('brouillon', 'soumis', 'rejete_departement'))
      OR is_admin(auth.uid())
    )
  )
);