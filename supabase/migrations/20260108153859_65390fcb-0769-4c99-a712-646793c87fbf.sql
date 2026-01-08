-- ============================================
-- PROMPT 3: Logistique Pivot, Continuité Achats & Visibilité (CORRECTED)
-- ============================================

-- 5. Update RLS policies for demandes_achat (Purchase Requisitions)
-- Both Logistics and Purchasing can manage DAs
DROP POLICY IF EXISTS "demandes_achat_select_policy" ON demandes_achat;
CREATE POLICY "demandes_achat_select_policy" ON demandes_achat
FOR SELECT USING (
  -- Creator sees their own
  auth.uid() = created_by
  -- Department members can see their DAs
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.department_id = demandes_achat.department_id
  )
  -- Logistics, Purchasing, Admin, DAF, DG, Comptable see all
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'dg', 'daf', 'responsable_logistique', 'agent_logistique', 'responsable_achats', 'agent_achats', 'comptable')
  )
);

-- INSERT policy: Logistics AND Purchasing can create DAs
DROP POLICY IF EXISTS "demandes_achat_insert_policy" ON demandes_achat;
CREATE POLICY "demandes_achat_insert_policy" ON demandes_achat
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'responsable_logistique', 'agent_logistique', 'responsable_achats', 'agent_achats')
  )
);

-- UPDATE policy: Operational roles can update
DROP POLICY IF EXISTS "demandes_achat_update_policy" ON demandes_achat;
CREATE POLICY "demandes_achat_update_policy" ON demandes_achat
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'dg', 'daf', 'responsable_logistique', 'agent_logistique', 'responsable_achats', 'agent_achats', 'comptable')
  )
);

-- 7. Grant role permissions for mutualization
-- Give Purchasing roles the same module permissions as Logistics
INSERT INTO role_permissions (role, permission_id)
SELECT 'responsable_achats', p.id FROM permissions p 
WHERE p.code IN ('besoins.voir', 'besoins.transformer', 'bl.voir', 'bl.creer', 'bl.valider', 'da.voir', 'da.creer', 'da.analyser', 'stock.voir', 'expressions.voir', 'expressions.voir_global')
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role = 'responsable_achats' AND rp.permission_id = p.id
);

INSERT INTO role_permissions (role, permission_id)
SELECT 'agent_achats', p.id FROM permissions p 
WHERE p.code IN ('besoins.voir', 'besoins.transformer', 'bl.voir', 'bl.creer', 'da.voir', 'da.creer', 'da.analyser', 'stock.voir', 'expressions.voir', 'expressions.voir_global')
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role = 'agent_achats' AND rp.permission_id = p.id
);

-- Give Logistics expressions global view permission
INSERT INTO role_permissions (role, permission_id)
SELECT 'responsable_logistique', p.id FROM permissions p 
WHERE p.code = 'expressions.voir_global'
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role = 'responsable_logistique' AND rp.permission_id = p.id
);

INSERT INTO role_permissions (role, permission_id)
SELECT 'agent_logistique', p.id FROM permissions p 
WHERE p.code = 'expressions.voir_global'
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role = 'agent_logistique' AND rp.permission_id = p.id
);

-- Add expressions module to DAF/DG
INSERT INTO role_permissions (role, permission_id)
SELECT 'daf', p.id FROM permissions p 
WHERE p.code IN ('expressions.voir', 'expressions.voir_global')
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role = 'daf' AND rp.permission_id = p.id
);

INSERT INTO role_permissions (role, permission_id)
SELECT 'dg', p.id FROM permissions p 
WHERE p.code IN ('expressions.voir', 'expressions.voir_global')
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role = 'dg' AND rp.permission_id = p.id
);