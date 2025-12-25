-- Vider et repeupler la table permissions avec tous les modules et actions
TRUNCATE TABLE public.role_permissions CASCADE;
TRUNCATE TABLE public.permissions CASCADE;

-- Insérer toutes les permissions par module
-- FORMAT: module.action ou module.action_metier

-- ============ ADMINISTRATION ============
INSERT INTO public.permissions (code, name, module, description) VALUES
('administration.voir', 'Voir le module Administration', 'administration', 'Accès au menu Administration'),
('administration.gerer_users', 'Gérer les utilisateurs', 'administration', 'Créer, modifier, supprimer des utilisateurs'),
('administration.gerer_roles', 'Gérer les rôles', 'administration', 'Modifier les permissions des rôles'),
('administration.gerer_departements', 'Gérer les départements', 'administration', 'CRUD départements'),
('administration.gerer_unites', 'Gérer les unités', 'administration', 'CRUD unités de mesure'),
('administration.gerer_modes_paiement', 'Gérer les modes de paiement', 'administration', 'CRUD modes de paiement'),
('administration.gerer_plan_comptable', 'Gérer le plan comptable', 'administration', 'CRUD comptes comptables'),
('administration.gerer_parametres', 'Gérer les paramètres', 'administration', 'Modifier les paramètres système');

-- ============ BESOINS ============
INSERT INTO public.permissions (code, name, module, description) VALUES
('besoins.voir', 'Voir les besoins', 'besoins', 'Accès au menu Besoins'),
('besoins.lire', 'Lire les besoins', 'besoins', 'Voir le détail des besoins'),
('besoins.ecrire', 'Créer/Modifier des besoins', 'besoins', 'Créer et modifier ses propres besoins'),
('besoins.supprimer', 'Supprimer des besoins', 'besoins', 'Supprimer des besoins'),
('besoins.prendre_en_charge', 'Prendre en charge', 'besoins', 'Prendre en charge un besoin (logistique)'),
('besoins.accepter', 'Accepter un besoin', 'besoins', 'Valider un besoin pour transformation'),
('besoins.refuser', 'Refuser un besoin', 'besoins', 'Rejeter un besoin'),
('besoins.convertir_da', 'Convertir en DA', 'besoins', 'Transformer un besoin en Demande d''Achat'),
('besoins.convertir_bl', 'Convertir en BL', 'besoins', 'Transformer un besoin en Bon de Livraison'),
('besoins.verrouiller', 'Verrouiller/Déverrouiller', 'besoins', 'Gérer le verrouillage des besoins');

-- ============ DEMANDES D'ACHAT ============
INSERT INTO public.permissions (code, name, module, description) VALUES
('da.voir', 'Voir les DA', 'da', 'Accès au menu Demandes d''Achat'),
('da.lire', 'Lire les DA', 'da', 'Voir le détail des DA'),
('da.ecrire', 'Créer/Modifier des DA', 'da', 'Créer et modifier des DA'),
('da.supprimer', 'Supprimer des DA', 'da', 'Supprimer des DA'),
('da.soumettre_achats', 'Soumettre aux Achats', 'da', 'Soumettre une DA au service Achats'),
('da.analyser', 'Analyser', 'da', 'Passer une DA en analyse'),
('da.chiffrer', 'Chiffrer', 'da', 'Ajouter les prix fournisseurs'),
('da.choisir_fournisseur', 'Choisir fournisseur', 'da', 'Sélectionner le fournisseur retenu'),
('da.soumettre_validation', 'Soumettre à validation DAF/DG', 'da', 'Soumettre pour validation financière'),
('da.valider_finance', 'Valider (DAF/DG)', 'da', 'Approuver financièrement une DA'),
('da.refuser_finance', 'Refuser (DAF/DG)', 'da', 'Rejeter financièrement une DA'),
('da.demander_revision', 'Demander révision', 'da', 'Renvoyer aux Achats pour révision'),
('da.rejeter', 'Rejeter (Achats)', 'da', 'Rejeter une DA au niveau Achats'),
('da.comptabiliser', 'Comptabiliser', 'da', 'Rattacher comptabilité SYSCOHADA'),
('da.payer', 'Payer', 'da', 'Enregistrer le paiement d''une DA');

-- ============ BONS DE LIVRAISON ============
INSERT INTO public.permissions (code, name, module, description) VALUES
('bl.voir', 'Voir les BL', 'bl', 'Accès au menu Bons de Livraison'),
('bl.lire', 'Lire les BL', 'bl', 'Voir le détail des BL'),
('bl.ecrire', 'Créer/Modifier des BL', 'bl', 'Créer et modifier des BL'),
('bl.supprimer', 'Supprimer des BL', 'bl', 'Supprimer des BL'),
('bl.valider', 'Valider un BL', 'bl', 'Valider un bon de livraison'),
('bl.livrer', 'Marquer comme livré', 'bl', 'Confirmer la livraison'),
('bl.rejeter', 'Rejeter un BL', 'bl', 'Rejeter un bon de livraison');

-- ============ FOURNISSEURS ============
INSERT INTO public.permissions (code, name, module, description) VALUES
('fournisseurs.voir', 'Voir les fournisseurs', 'fournisseurs', 'Accès au menu Fournisseurs'),
('fournisseurs.lire', 'Lire les fournisseurs', 'fournisseurs', 'Voir le détail des fournisseurs'),
('fournisseurs.ecrire', 'Créer/Modifier des fournisseurs', 'fournisseurs', 'CRUD fournisseurs'),
('fournisseurs.supprimer', 'Supprimer des fournisseurs', 'fournisseurs', 'Supprimer/archiver des fournisseurs');

-- ============ STOCK ============
INSERT INTO public.permissions (code, name, module, description) VALUES
('stock.voir', 'Voir le stock', 'stock', 'Accès au menu Stock'),
('stock.lire', 'Lire le stock', 'stock', 'Voir le détail du stock'),
('stock.ecrire', 'Créer/Modifier le stock', 'stock', 'Ajouter des articles au stock'),
('stock.supprimer', 'Supprimer du stock', 'stock', 'Supprimer des articles'),
('stock.ajuster', 'Ajuster le stock', 'stock', 'Faire des ajustements de quantité'),
('stock.valider_mouvement', 'Valider mouvements', 'stock', 'Valider les mouvements de stock');

-- ============ COMPTABILITE ============
INSERT INTO public.permissions (code, name, module, description) VALUES
('comptabilite.voir', 'Voir la comptabilité', 'comptabilite', 'Accès au menu Comptabilité'),
('comptabilite.lire', 'Lire les écritures', 'comptabilite', 'Voir les écritures comptables'),
('comptabilite.ecrire', 'Créer des écritures', 'comptabilite', 'Créer des écritures comptables'),
('comptabilite.supprimer', 'Supprimer des écritures', 'comptabilite', 'Supprimer des écritures'),
('comptabilite.rattacher_syscohada', 'Rattacher SYSCOHADA', 'comptabilite', 'Attribuer classe/compte SYSCOHADA'),
('comptabilite.payer', 'Enregistrer paiement', 'comptabilite', 'Valider un paiement'),
('comptabilite.rejeter_paiement', 'Rejeter paiement', 'comptabilite', 'Rejeter un paiement');

-- ============ PROJETS ============
INSERT INTO public.permissions (code, name, module, description) VALUES
('projets.voir', 'Voir les projets', 'projets', 'Accès au menu Projets'),
('projets.lire', 'Lire les projets', 'projets', 'Voir le détail des projets'),
('projets.ecrire', 'Créer/Modifier des projets', 'projets', 'CRUD projets'),
('projets.supprimer', 'Supprimer des projets', 'projets', 'Archiver/supprimer des projets');

-- ============ NOTES DE FRAIS ============
INSERT INTO public.permissions (code, name, module, description) VALUES
('notes_frais.voir', 'Voir les notes de frais', 'notes_frais', 'Accès au menu Notes de frais'),
('notes_frais.lire', 'Lire les notes de frais', 'notes_frais', 'Voir le détail des notes'),
('notes_frais.ecrire', 'Créer/Modifier ses notes', 'notes_frais', 'Créer et modifier ses notes de frais'),
('notes_frais.supprimer', 'Supprimer des notes', 'notes_frais', 'Supprimer des notes de frais'),
('notes_frais.valider_daf', 'Valider (DAF)', 'notes_frais', 'Valider une note de frais'),
('notes_frais.rejeter', 'Rejeter', 'notes_frais', 'Rejeter une note de frais'),
('notes_frais.payer', 'Payer', 'notes_frais', 'Enregistrer le remboursement');

-- ============ CAISSE ============
INSERT INTO public.permissions (code, name, module, description) VALUES
('caisse.voir', 'Voir les caisses', 'caisse', 'Accès au menu Caisse'),
('caisse.lire', 'Lire les mouvements', 'caisse', 'Voir les mouvements de caisse'),
('caisse.ecrire', 'Créer des mouvements', 'caisse', 'Créer des entrées/sorties'),
('caisse.supprimer', 'Supprimer des mouvements', 'caisse', 'Supprimer des mouvements'),
('caisse.gerer', 'Gérer les caisses', 'caisse', 'Créer/modifier les caisses');

-- ============ AUDIT ============
INSERT INTO public.permissions (code, name, module, description) VALUES
('audit.voir', 'Voir le journal d''audit', 'audit', 'Accès au journal d''audit'),
('audit.lire', 'Lire les logs', 'audit', 'Consulter les logs détaillés');

-- ============ RAPPORTS ============
INSERT INTO public.permissions (code, name, module, description) VALUES
('rapports.voir', 'Voir les rapports', 'rapports', 'Accès au menu Rapports'),
('rapports.lire', 'Lire les rapports', 'rapports', 'Consulter les rapports'),
('rapports.exporter', 'Exporter', 'rapports', 'Exporter les rapports en PDF/Excel');

-- ============ TABLEAU DE BORD ============
INSERT INTO public.permissions (code, name, module, description) VALUES
('dashboard.voir', 'Voir le tableau de bord', 'dashboard', 'Accès au tableau de bord');

-- =======================================================
-- ATTRIBUTION DES PERMISSIONS PAR ROLE (configuration initiale Kimbo)
-- =======================================================

-- ADMIN: toutes les permissions
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::app_role, id FROM public.permissions;

-- DG: accès large en lecture + validations
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'dg'::app_role, id FROM public.permissions 
WHERE code IN (
  'dashboard.voir',
  'besoins.voir', 'besoins.lire',
  'da.voir', 'da.lire', 'da.valider_finance', 'da.refuser_finance', 'da.demander_revision',
  'bl.voir', 'bl.lire',
  'fournisseurs.voir', 'fournisseurs.lire',
  'stock.voir', 'stock.lire',
  'comptabilite.voir', 'comptabilite.lire',
  'projets.voir', 'projets.lire', 'projets.ecrire',
  'notes_frais.voir', 'notes_frais.lire',
  'caisse.voir', 'caisse.lire',
  'audit.voir', 'audit.lire',
  'rapports.voir', 'rapports.lire', 'rapports.exporter'
);

-- DAF: finance + validation
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'daf'::app_role, id FROM public.permissions 
WHERE code IN (
  'dashboard.voir',
  'besoins.voir', 'besoins.lire',
  'da.voir', 'da.lire', 'da.analyser', 'da.chiffrer', 'da.choisir_fournisseur', 'da.soumettre_validation', 
  'da.valider_finance', 'da.refuser_finance', 'da.demander_revision', 'da.comptabiliser', 'da.payer',
  'bl.voir', 'bl.lire',
  'fournisseurs.voir', 'fournisseurs.lire', 'fournisseurs.ecrire',
  'stock.voir', 'stock.lire', 'stock.ecrire',
  'comptabilite.voir', 'comptabilite.lire', 'comptabilite.ecrire', 'comptabilite.rattacher_syscohada', 'comptabilite.payer', 'comptabilite.rejeter_paiement',
  'projets.voir', 'projets.lire', 'projets.ecrire',
  'notes_frais.voir', 'notes_frais.lire', 'notes_frais.valider_daf', 'notes_frais.rejeter', 'notes_frais.payer',
  'caisse.voir', 'caisse.lire', 'caisse.ecrire', 'caisse.gerer',
  'audit.voir', 'audit.lire',
  'rapports.voir', 'rapports.lire', 'rapports.exporter'
);

-- COMPTABLE
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'comptable'::app_role, id FROM public.permissions 
WHERE code IN (
  'dashboard.voir',
  'besoins.voir', 'besoins.lire',
  'da.voir', 'da.lire', 'da.comptabiliser', 'da.payer',
  'fournisseurs.voir', 'fournisseurs.lire',
  'stock.voir', 'stock.lire',
  'comptabilite.voir', 'comptabilite.lire', 'comptabilite.ecrire', 'comptabilite.rattacher_syscohada', 'comptabilite.payer', 'comptabilite.rejeter_paiement',
  'projets.voir', 'projets.lire',
  'notes_frais.voir', 'notes_frais.lire', 'notes_frais.payer',
  'caisse.voir', 'caisse.lire', 'caisse.ecrire',
  'audit.voir', 'audit.lire'
);

-- RESPONSABLE LOGISTIQUE
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'responsable_logistique'::app_role, id FROM public.permissions 
WHERE code IN (
  'dashboard.voir',
  'besoins.voir', 'besoins.lire', 'besoins.ecrire', 'besoins.prendre_en_charge', 'besoins.accepter', 'besoins.refuser', 
  'besoins.convertir_da', 'besoins.convertir_bl', 'besoins.verrouiller',
  'da.voir', 'da.lire', 'da.ecrire', 'da.soumettre_achats',
  'bl.voir', 'bl.lire', 'bl.ecrire', 'bl.valider', 'bl.livrer', 'bl.rejeter',
  'fournisseurs.voir', 'fournisseurs.lire',
  'stock.voir', 'stock.lire', 'stock.ecrire', 'stock.ajuster', 'stock.valider_mouvement',
  'projets.voir', 'projets.lire'
);

-- AGENT LOGISTIQUE
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'agent_logistique'::app_role, id FROM public.permissions 
WHERE code IN (
  'dashboard.voir',
  'besoins.voir', 'besoins.lire', 'besoins.ecrire', 'besoins.prendre_en_charge', 'besoins.accepter', 'besoins.refuser',
  'besoins.convertir_da', 'besoins.convertir_bl',
  'da.voir', 'da.lire', 'da.ecrire', 'da.soumettre_achats',
  'bl.voir', 'bl.lire', 'bl.ecrire', 'bl.livrer',
  'fournisseurs.voir', 'fournisseurs.lire',
  'stock.voir', 'stock.lire', 'stock.ecrire',
  'projets.voir', 'projets.lire'
);

-- RESPONSABLE ACHATS
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'responsable_achats'::app_role, id FROM public.permissions 
WHERE code IN (
  'dashboard.voir',
  'besoins.voir', 'besoins.lire', 'besoins.ecrire',
  'da.voir', 'da.lire', 'da.analyser', 'da.chiffrer', 'da.choisir_fournisseur', 'da.soumettre_validation', 'da.rejeter',
  'fournisseurs.voir', 'fournisseurs.lire', 'fournisseurs.ecrire', 'fournisseurs.supprimer',
  'stock.voir', 'stock.lire',
  'projets.voir', 'projets.lire'
);

-- AGENT ACHATS
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'agent_achats'::app_role, id FROM public.permissions 
WHERE code IN (
  'dashboard.voir',
  'besoins.voir', 'besoins.lire',
  'da.voir', 'da.lire', 'da.analyser', 'da.chiffrer',
  'fournisseurs.voir', 'fournisseurs.lire', 'fournisseurs.ecrire',
  'stock.voir', 'stock.lire',
  'projets.voir', 'projets.lire'
);

-- RESPONSABLE DEPARTEMENT
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'responsable_departement'::app_role, id FROM public.permissions 
WHERE code IN (
  'dashboard.voir',
  'besoins.voir', 'besoins.lire', 'besoins.ecrire',
  'da.voir', 'da.lire',
  'notes_frais.voir', 'notes_frais.lire', 'notes_frais.ecrire',
  'projets.voir', 'projets.lire'
);

-- EMPLOYE
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'employe'::app_role, id FROM public.permissions 
WHERE code IN (
  'dashboard.voir',
  'besoins.voir', 'besoins.lire', 'besoins.ecrire',
  'notes_frais.voir', 'notes_frais.lire', 'notes_frais.ecrire',
  'projets.voir', 'projets.lire'
);

-- LECTURE SEULE
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'lecture_seule'::app_role, id FROM public.permissions 
WHERE code IN (
  'dashboard.voir',
  'besoins.voir', 'besoins.lire',
  'da.voir', 'da.lire',
  'bl.voir', 'bl.lire',
  'fournisseurs.voir', 'fournisseurs.lire',
  'stock.voir', 'stock.lire',
  'projets.voir', 'projets.lire'
);

-- =======================================================
-- FONCTION: Vérifier si un utilisateur a une permission
-- =======================================================
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id
      AND p.code = _permission_code
  )
$$;

-- =======================================================
-- FONCTION: Récupérer toutes les permissions d'un utilisateur
-- =======================================================
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS TABLE(permission_code text, module text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.code, p.module, p.name
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role = ur.role
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = _user_id
  ORDER BY p.module, p.code
$$;

-- =======================================================
-- FONCTION: Récupérer les modules accessibles par un utilisateur
-- =======================================================
CREATE OR REPLACE FUNCTION public.get_user_modules(_user_id uuid)
RETURNS TABLE(module text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.module
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role = ur.role
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = _user_id
    AND p.code LIKE '%.voir'
  ORDER BY p.module
$$;