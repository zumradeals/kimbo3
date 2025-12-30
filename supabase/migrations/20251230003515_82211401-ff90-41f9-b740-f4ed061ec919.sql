-- ============================================================
-- MIGRATION: RLS policies pour modification besoin retourné par créateur
-- Date: 2025-12-30
-- ============================================================

-- Politique UPDATE pour le créateur sur besoin retourné
CREATE POLICY "Créateur peut modifier lignes besoin retourné"
ON public.besoin_lignes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.besoins b
    WHERE b.id = besoin_lignes.besoin_id
      AND b.user_id = auth.uid()
      AND b.status = 'retourne'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.besoins b
    WHERE b.id = besoin_lignes.besoin_id
      AND b.user_id = auth.uid()
      AND b.status = 'retourne'
  )
);

-- Politique INSERT pour le créateur sur besoin retourné
CREATE POLICY "Créateur peut ajouter lignes besoin retourné"
ON public.besoin_lignes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.besoins b
    WHERE b.id = besoin_lignes.besoin_id
      AND b.user_id = auth.uid()
      AND b.status = 'retourne'
  )
);

-- Politique DELETE pour le créateur sur besoin retourné
CREATE POLICY "Créateur peut supprimer lignes besoin retourné"
ON public.besoin_lignes
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.besoins b
    WHERE b.id = besoin_lignes.besoin_id
      AND b.user_id = auth.uid()
      AND b.status = 'retourne'
  )
);