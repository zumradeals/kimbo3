
-- Create immobilisations permissions
INSERT INTO public.permissions (code, name, description, module) VALUES
  ('immobilisations.voir', 'Voir les immobilisations', 'Accéder au module immobilisations', 'immobilisations'),
  ('immobilisations.lire', 'Lire les immobilisations', 'Consulter le détail des fiches', 'immobilisations'),
  ('immobilisations.ecrire', 'Créer/modifier les immobilisations', 'Créer et modifier des fiches', 'immobilisations'),
  ('immobilisations.supprimer', 'Archiver les immobilisations', 'Archiver des fiches', 'immobilisations')
ON CONFLICT DO NOTHING;

-- Grant all immobilisations permissions to DAF
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'daf', p.id
FROM public.permissions p
WHERE p.module = 'immobilisations'
ON CONFLICT DO NOTHING;

-- Also grant to admin
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', p.id
FROM public.permissions p
WHERE p.module = 'immobilisations'
ON CONFLICT DO NOTHING;
