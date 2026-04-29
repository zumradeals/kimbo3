INSERT INTO public.role_permissions (role, permission_id)
SELECT r.role, p.id
FROM (VALUES ('responsable_logistique'::app_role), ('agent_logistique'::app_role)) AS r(role)
CROSS JOIN public.permissions p
WHERE p.module = 'immobilisations'
ON CONFLICT DO NOTHING;