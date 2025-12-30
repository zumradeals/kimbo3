-- ============================================================
-- MIGRATION: Permissions pour le statut 'retourne' des besoins
-- Date: 2025-12-30
-- ============================================================

-- Ajouter une policy pour permettre au créateur de modifier un besoin retourné
DROP POLICY IF EXISTS "Créateur peut modifier besoin retourné" ON public.besoins;
CREATE POLICY "Créateur peut modifier besoin retourné"
  ON public.besoins
  FOR UPDATE
  USING (user_id = auth.uid() AND status = 'retourne')
  WITH CHECK (user_id = auth.uid() AND (status = 'retourne' OR status = 'cree'));

-- Policy pour que la logistique puisse retourner un besoin
-- Mise à jour de la policy existante pour inclure le statut 'retourne' comme cible
DROP POLICY IF EXISTS "Logistique peut gérer les besoins" ON public.besoins;
CREATE POLICY "Logistique peut gérer les besoins"
  ON public.besoins
  FOR UPDATE
  USING (is_logistics(auth.uid()) OR is_admin(auth.uid()))
  WITH CHECK (is_logistics(auth.uid()) OR is_admin(auth.uid()));