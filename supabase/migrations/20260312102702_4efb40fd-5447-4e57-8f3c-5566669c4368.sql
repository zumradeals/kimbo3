-- Fix RLS policies: 'chef' -> 'chef_departement' to match actual data
DROP POLICY IF EXISTS "Department heads can view department expressions" ON public.expressions_besoin;
CREATE POLICY "Department heads can view department expressions"
  ON public.expressions_besoin FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.department_id = expressions_besoin.department_id
        AND p.position_departement = 'chef_departement'
    )
  );

DROP POLICY IF EXISTS "Department heads can update department expressions" ON public.expressions_besoin;
CREATE POLICY "Department heads can update department expressions"
  ON public.expressions_besoin FOR UPDATE
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.department_id = expressions_besoin.department_id
        AND p.position_departement = 'chef_departement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.department_id = expressions_besoin.department_id
        AND p.position_departement = 'chef_departement'
    )
  );

-- Add missing tables to realtime publication for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.expressions_besoin;
ALTER PUBLICATION supabase_realtime ADD TABLE public.demandes_achat;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bons_livraison;
ALTER PUBLICATION supabase_realtime ADD TABLE public.besoins;