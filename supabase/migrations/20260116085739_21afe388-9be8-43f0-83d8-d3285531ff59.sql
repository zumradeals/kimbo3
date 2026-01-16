-- Donner accès au module expressions à TOUS les rôles
DO $$
DECLARE
  perm_voir_id uuid;
  perm_creer_id uuid;
BEGIN
  SELECT id INTO perm_voir_id FROM permissions WHERE code = 'expressions.voir';
  SELECT id INTO perm_creer_id FROM permissions WHERE code = 'expressions.creer';
  
  -- Ajouter expressions.voir pour tous les rôles qui ne l'ont pas encore
  INSERT INTO role_permissions (role, permission_id)
  SELECT role_name::app_role, perm_voir_id
  FROM unnest(ARRAY['admin', 'responsable_logistique', 'agent_logistique', 'comptable', 'responsable_departement', 'employe']) AS role_name
  WHERE perm_voir_id IS NOT NULL
  ON CONFLICT DO NOTHING;
  
  -- Ajouter expressions.creer pour tous les rôles qui doivent pouvoir créer
  INSERT INTO role_permissions (role, permission_id)
  SELECT role_name::app_role, perm_creer_id
  FROM unnest(ARRAY['admin', 'dg', 'daf', 'responsable_logistique', 'agent_logistique', 'responsable_achats', 'agent_achats', 'comptable', 'responsable_departement', 'employe']) AS role_name
  WHERE perm_creer_id IS NOT NULL
  ON CONFLICT DO NOTHING;
END$$;