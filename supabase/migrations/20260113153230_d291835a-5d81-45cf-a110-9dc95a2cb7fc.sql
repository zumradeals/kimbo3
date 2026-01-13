
-- ============================================================
-- COMPTABLE - Accès lecture seule complet
-- ============================================================

-- 1. Permettre au comptable de lire TOUTES les DA (pas seulement les validées)
DROP POLICY IF EXISTS "Comptable voit DA validees finance" ON public.demandes_achat;

CREATE POLICY "Comptable voit toutes les DA en lecture"
  ON public.demandes_achat
  FOR SELECT
  USING (is_comptable(auth.uid()));

-- 2. Permettre au comptable de lire les fournisseurs
CREATE POLICY "Comptable voit les fournisseurs"
  ON public.fournisseurs
  FOR SELECT
  USING (is_comptable(auth.uid()));

-- 3. Permettre au comptable de lire le stock (déjà une policy générale mais on ajoute explicitement)
DROP POLICY IF EXISTS "Comptable voit le stock" ON public.articles_stock;

CREATE POLICY "Comptable voit le stock"
  ON public.articles_stock
  FOR SELECT
  USING (is_comptable(auth.uid()));

-- 4. Permettre au comptable de lire les mouvements de stock
CREATE POLICY "Comptable voit les mouvements stock"
  ON public.stock_movements
  FOR SELECT
  USING (is_comptable(auth.uid()));
