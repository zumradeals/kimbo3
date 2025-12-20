-- =============================================
-- KPM SYSTEME - SCHÉMA RBAC FONDATION
-- =============================================

-- 1. ENUM pour les rôles applicatifs
CREATE TYPE public.app_role AS ENUM (
  'admin',
  'dg',
  'daf',
  'comptable',
  'responsable_logistique',
  'agent_logistique',
  'responsable_achats',
  'agent_achats',
  'responsable_departement',
  'employe',
  'lecture_seule'
);

-- 2. ENUM pour les statuts
CREATE TYPE public.user_status AS ENUM ('active', 'inactive', 'suspended');

-- 3. TABLE DÉPARTEMENTS
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. TABLE PROFILS UTILISATEURS
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  department_id UUID REFERENCES public.departments(id),
  status public.user_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. TABLE RÔLES UTILISATEURS (séparée pour sécurité)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);

-- 6. TABLE PERMISSIONS (définitions abstraites)
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  module TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. TABLE ROLE_PERMISSIONS (matrice rôle-permission)
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role, permission_id)
);

-- 8. TABLE PARAMÈTRES SYSTÈME
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- 9. TABLE JOURNAL D'AUDIT
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- FONCTIONS SECURITY DEFINER (anti-recursion RLS)
-- =============================================

-- Fonction pour vérifier si un utilisateur a un rôle spécifique
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Fonction pour vérifier si un utilisateur est admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

-- Fonction pour obtenir le département d'un utilisateur
CREATE OR REPLACE FUNCTION public.get_user_department(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id
  FROM public.profiles
  WHERE id = _user_id
$$;

-- =============================================
-- TRIGGERS POUR UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_departments_updated
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_settings_updated
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- TRIGGER CRÉATION PROFIL AUTO
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  
  -- Assigner le rôle par défaut 'employe'
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employe');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- ACTIVATION RLS
-- =============================================

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- POLITIQUES RLS - DEPARTMENTS
-- =============================================

CREATE POLICY "Tous les utilisateurs authentifiés peuvent voir les départements"
  ON public.departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Seuls les admins peuvent gérer les départements"
  ON public.departments FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- =============================================
-- POLITIQUES RLS - PROFILES
-- =============================================

CREATE POLICY "Les utilisateurs peuvent voir leur propre profil"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Les admins peuvent voir tous les profils"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Les utilisateurs peuvent modifier leur propre profil"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Les admins peuvent gérer tous les profils"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- =============================================
-- POLITIQUES RLS - USER_ROLES
-- =============================================

CREATE POLICY "Les utilisateurs peuvent voir leurs propres rôles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Les admins peuvent voir tous les rôles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Seuls les admins peuvent gérer les rôles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- =============================================
-- POLITIQUES RLS - PERMISSIONS
-- =============================================

CREATE POLICY "Tous les authentifiés peuvent voir les permissions"
  ON public.permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Seuls les admins peuvent gérer les permissions"
  ON public.permissions FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- =============================================
-- POLITIQUES RLS - ROLE_PERMISSIONS
-- =============================================

CREATE POLICY "Tous les authentifiés peuvent voir la matrice"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Seuls les admins peuvent gérer la matrice"
  ON public.role_permissions FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- =============================================
-- POLITIQUES RLS - SETTINGS
-- =============================================

CREATE POLICY "Tous les authentifiés peuvent voir les paramètres"
  ON public.settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Seuls les admins peuvent modifier les paramètres"
  ON public.settings FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- =============================================
-- POLITIQUES RLS - AUDIT_LOGS
-- =============================================

CREATE POLICY "Seuls les admins peuvent voir les logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Le système peut insérer des logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =============================================
-- DONNÉES INITIALES
-- =============================================

-- Départements par défaut
INSERT INTO public.departments (name, description) VALUES
  ('Direction Générale', 'Direction générale de l''entreprise'),
  ('Direction Logistique', 'Gestion des stocks et approvisionnements'),
  ('Direction Achats', 'Gestion des achats et fournisseurs'),
  ('Direction Financière', 'Contrôle financier et validation'),
  ('Comptabilité', 'Comptabilité et paiements SYSCOHADA'),
  ('Direction Technique', 'Opérations techniques'),
  ('Direction RH', 'Ressources humaines'),
  ('Direction Commerciale', 'Ventes et relations clients'),
  ('Secrétariat', 'Administration générale');

-- Paramètres système par défaut
INSERT INTO public.settings (key, value, description, category) VALUES
  ('company_name', 'KIMBO AFRICA SA', 'Nom de l''entreprise', 'general'),
  ('currency', 'FCFA', 'Devise principale', 'general'),
  ('da_prefix', 'DA', 'Préfixe des demandes d''achat', 'references'),
  ('bl_prefix', 'BL', 'Préfixe des bons de livraison', 'references'),
  ('threshold_achats', '500000', 'Seuil validation Achats (FCFA)', 'thresholds'),
  ('threshold_dg', '2000000', 'Seuil validation DG (FCFA)', 'thresholds'),
  ('threshold_daf', '1000000', 'Seuil contrôle DAF (FCFA)', 'thresholds');

-- Permissions de base
INSERT INTO public.permissions (code, name, description, module) VALUES
  ('view_dashboard', 'Voir le tableau de bord', 'Accès au dashboard principal', 'dashboard'),
  ('manage_users', 'Gérer les utilisateurs', 'Créer, modifier, supprimer des utilisateurs', 'admin'),
  ('manage_roles', 'Gérer les rôles', 'Attribuer et retirer des rôles', 'admin'),
  ('manage_departments', 'Gérer les départements', 'Créer et modifier les départements', 'admin'),
  ('manage_settings', 'Gérer les paramètres', 'Modifier les paramètres système', 'admin'),
  ('view_audit_logs', 'Voir les logs', 'Consulter le journal d''audit', 'admin'),
  ('view_reports', 'Voir les rapports', 'Accéder aux rapports', 'reports');