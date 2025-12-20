-- Add DAF to besoins SELECT policy
DROP POLICY IF EXISTS "DAF voit tous les besoins" ON public.besoins;

CREATE POLICY "DAF voit tous les besoins"
ON public.besoins
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'daf'));
