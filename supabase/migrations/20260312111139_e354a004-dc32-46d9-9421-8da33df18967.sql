
-- Fix expressions_besoin_lignes SELECT: add department head access
DROP POLICY IF EXISTS "Users can view expression lines they have access to" ON public.expressions_besoin_lignes;
CREATE POLICY "Users can view expression lines they have access to"
  ON public.expressions_besoin_lignes FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM expressions_besoin eb
      WHERE eb.id = expressions_besoin_lignes.expression_id
        AND (
          eb.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = eb.user_id AND p.chef_hierarchique_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
              AND p.department_id = eb.department_id
              AND p.position_departement = 'chef_departement'
          )
          OR is_admin(auth.uid())
          OR is_dg(auth.uid())
          OR is_logistics(auth.uid())
        )
    )
  );

-- Fix expressions_besoin_lignes UPDATE: add department head access
DROP POLICY IF EXISTS "Users can update lines on their own expressions or as manager" ON public.expressions_besoin_lignes;
CREATE POLICY "Users can update lines on their own expressions or as manager"
  ON public.expressions_besoin_lignes FOR UPDATE
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM expressions_besoin eb
      WHERE eb.id = expressions_besoin_lignes.expression_id
        AND (
          (eb.user_id = auth.uid() AND eb.status = 'brouillon')
          OR (
            eb.status IN ('soumis', 'en_examen')
            AND (
              EXISTS (SELECT 1 FROM profiles p WHERE p.id = eb.user_id AND p.chef_hierarchique_id = auth.uid())
              OR EXISTS (
                SELECT 1 FROM profiles p
                WHERE p.id = auth.uid()
                  AND p.department_id = eb.department_id
                  AND p.position_departement = 'chef_departement'
              )
            )
          )
          OR is_admin(auth.uid())
        )
    )
  );
