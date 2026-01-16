-- Fix RLS for hierarchical manager access without depending on profiles RLS

-- 1) Helper: check manager/subordinate relationship (bypasses profiles RLS)
CREATE OR REPLACE FUNCTION public.is_manager_of(_manager_id uuid, _employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _employee_id
      AND p.chef_hierarchique_id = _manager_id
  );
$$;

-- 2) Recreate manager SELECT policy using the helper
DROP POLICY IF EXISTS "Managers can view subordinate expressions" ON public.expressions_besoin;
CREATE POLICY "Managers can view subordinate expressions"
ON public.expressions_besoin
FOR SELECT
USING (
  public.is_manager_of(auth.uid(), public.expressions_besoin.user_id)
);

-- 3) Allow managers to UPDATE their subordinate expressions (for validation/rejection)
DROP POLICY IF EXISTS "Managers can update subordinate expressions" ON public.expressions_besoin;
CREATE POLICY "Managers can update subordinate expressions"
ON public.expressions_besoin
FOR UPDATE
USING (
  public.is_manager_of(auth.uid(), public.expressions_besoin.user_id)
)
WITH CHECK (
  public.is_manager_of(auth.uid(), public.expressions_besoin.user_id)
);

-- 4) Optional: backend-side permission check for UI (avoids direct profiles reads)
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
      JOIN public.profiles me ON me.id = auth.uid()
      WHERE e.id = _expression_id
        AND me.department_id = e.department_id
        AND me.position_departement = 'chef'
    );
$$;