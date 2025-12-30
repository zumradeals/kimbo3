-- ============================================================
-- MIGRATION: DAF peut valider et refuser les Bons de Livraison
-- Date: 2025-12-30
-- Description: Ajoute les policies RLS pour permettre au DAF de:
-- 1. Voir tous les BL (pour supervision)
-- 2. Modifier les BL en attente de validation
-- ============================================================

-- DAF peut voir tous les BL
CREATE POLICY "DAF voit tous les BL"
ON public.bons_livraison
FOR SELECT
USING (has_role(auth.uid(), 'daf'::app_role));

-- DAF peut valider/refuser les BL en attente de validation
CREATE POLICY "DAF peut valider BL"
ON public.bons_livraison
FOR UPDATE
USING (
  has_role(auth.uid(), 'daf'::app_role) 
  AND status = 'en_attente_validation'
)
WITH CHECK (
  has_role(auth.uid(), 'daf'::app_role) 
  AND status IN ('en_attente_validation', 'valide', 'refusee')
);