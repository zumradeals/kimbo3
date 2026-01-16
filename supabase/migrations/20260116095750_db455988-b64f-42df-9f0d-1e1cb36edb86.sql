-- Drop the existing manager policy and recreate with clearer logic
DROP POLICY IF EXISTS "Managers can view subordinate expressions" ON expressions_besoin;

-- Create a simpler, more reliable policy for managers to view subordinate expressions
CREATE POLICY "Managers can view subordinate expressions"
ON expressions_besoin
FOR SELECT
USING (
  auth.uid() IN (
    SELECT chef_hierarchique_id 
    FROM profiles 
    WHERE id = expressions_besoin.user_id
  )
);

-- Also add a policy for department heads to view all expressions in their department
DROP POLICY IF EXISTS "Department heads can view department expressions" ON expressions_besoin;

CREATE POLICY "Department heads can view department expressions"
ON expressions_besoin
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.department_id = expressions_besoin.department_id
    AND p.position_departement = 'chef'
  )
);

-- Also add update policy for department heads
DROP POLICY IF EXISTS "Department heads can update department expressions" ON expressions_besoin;

CREATE POLICY "Department heads can update department expressions"
ON expressions_besoin
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.department_id = expressions_besoin.department_id
    AND p.position_departement = 'chef'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.department_id = expressions_besoin.department_id
    AND p.position_departement = 'chef'
  )
);