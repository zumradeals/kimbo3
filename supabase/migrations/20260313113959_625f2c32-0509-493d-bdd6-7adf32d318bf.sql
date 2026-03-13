-- Fix: allow creator to submit note with soumis_aal status
DROP POLICY IF EXISTS "Créateur peut soumettre note" ON public.notes_frais;
CREATE POLICY "Créateur peut soumettre note"
  ON public.notes_frais FOR UPDATE
  USING (user_id = auth.uid() AND status IN ('brouillon', 'rejetee', 'retour_aal'))
  WITH CHECK (user_id = auth.uid() AND status IN ('brouillon', 'soumise', 'soumis_aal'));