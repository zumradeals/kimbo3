
-- Fix overly permissive INSERT policy on immobilisation_history
DROP POLICY IF EXISTS "System can insert immobilisation history" ON public.immobilisation_history;

CREATE POLICY "Authenticated can insert own history"
  ON public.immobilisation_history FOR INSERT TO authenticated
  WITH CHECK (performed_by = auth.uid());
