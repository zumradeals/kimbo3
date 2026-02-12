
-- Fix: Insert role_permissions with both role enum and role_id
INSERT INTO public.role_permissions (role, role_id, permission_id)
SELECT 'aal'::app_role, r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'aal'
  AND p.code LIKE '%.voir'
  AND p.module IN ('da', 'dashboard', 'besoins', 'bl', 'fournisseurs', 'stock', 'projets', 'audit', 'rapports')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, role_id, permission_id)
SELECT 'aal'::app_role, r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'aal'
  AND p.code IN ('da.valider_aal', 'da.rejeter_aal', 'da.transmettre_daf', 'da.lire', 'da.ecrire')
ON CONFLICT DO NOTHING;
