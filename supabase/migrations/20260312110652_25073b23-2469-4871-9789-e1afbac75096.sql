
-- Fix can_validate_expression to also allow department heads
CREATE OR REPLACE FUNCTION public.can_validate_expression(_expression_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.expressions_besoin e
      WHERE e.id = _expression_id
        AND public.is_manager_of(auth.uid(), e.user_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.expressions_besoin e
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE e.id = _expression_id
        AND p.department_id = e.department_id
        AND p.position_departement = 'chef_departement'
    );
$$;
