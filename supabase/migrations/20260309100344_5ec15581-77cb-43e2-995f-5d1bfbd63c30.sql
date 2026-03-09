
-- Broaden INSERT policy to also allow 'soumis' status (handles race conditions / cached builds)
DROP POLICY IF EXISTS "Users can insert lines on their own expressions" ON public.expressions_besoin_lignes;

CREATE POLICY "Users can insert lines on their own expressions"
ON public.expressions_besoin_lignes FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM expressions_besoin eb
    WHERE eb.id = expressions_besoin_lignes.expression_id
    AND eb.user_id = auth.uid()
    AND eb.status IN ('brouillon', 'soumis')
  )
);

-- Clean up Yvette's orphaned expressions (soumis with 0 lines)
DELETE FROM public.expressions_besoin 
WHERE user_id = '178d60f9-ff2b-40f9-8195-5ec6417a89f2'
AND status = 'soumis'
AND id NOT IN (SELECT DISTINCT expression_id FROM expressions_besoin_lignes);
