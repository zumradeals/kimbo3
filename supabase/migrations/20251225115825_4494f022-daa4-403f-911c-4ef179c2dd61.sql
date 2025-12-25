-- ============================================
-- STEP 1: Create the dynamic roles table
-- ============================================

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Policies for roles table
CREATE POLICY "Tous voient les rôles actifs"
  ON public.roles FOR SELECT
  USING (is_active = true OR is_admin(auth.uid()));

CREATE POLICY "Admin peut gérer les rôles"
  ON public.roles FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- ============================================
-- STEP 2: Populate roles from existing enum
-- ============================================

INSERT INTO public.roles (code, label, description, is_system) VALUES
  ('admin', 'Administrateur', 'Accès complet au système', true),
  ('dg', 'Directeur Général', 'Direction générale de l''entreprise', true),
  ('daf', 'Directeur Administratif et Financier', 'Gestion administrative et financière', true),
  ('comptable', 'Comptable', 'Gestion de la comptabilité', true),
  ('responsable_logistique', 'Responsable Logistique', 'Gestion de la logistique et du stock', true),
  ('agent_logistique', 'Agent Logistique', 'Opérations logistiques', true),
  ('responsable_achats', 'Responsable Achats', 'Gestion des achats et fournisseurs', true),
  ('agent_achats', 'Agent Achats', 'Opérations achats', true),
  ('responsable_departement', 'Responsable Département', 'Gestion de département', true),
  ('employe', 'Employé', 'Employé standard', true),
  ('lecture_seule', 'Lecture Seule', 'Consultation uniquement', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- STEP 3: Add role_id to user_roles and migrate
-- ============================================

ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id);

-- Migrate existing data from enum to role_id
UPDATE public.user_roles ur
SET role_id = r.id
FROM public.roles r
WHERE ur.role::text = r.code AND ur.role_id IS NULL;

-- ============================================
-- STEP 4: Add role_id to role_permissions and migrate
-- ============================================

ALTER TABLE public.role_permissions 
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id);

-- Migrate existing data
UPDATE public.role_permissions rp
SET role_id = r.id
FROM public.roles r
WHERE rp.role::text = r.code AND rp.role_id IS NULL;

-- ============================================
-- STEP 5: Create new security definer functions using role_id
-- ============================================

-- Function to check if user has a specific role by code
CREATE OR REPLACE FUNCTION public.has_role_by_code(_user_id UUID, _role_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      AND r.code = _role_code
      AND r.is_active = true
  )
$$;

-- Update is_admin to use new structure
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.code = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- Update is_dg to use new structure
CREATE OR REPLACE FUNCTION public.is_dg(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.code = 'dg'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'dg'
  )
$$;

-- Update is_logistics to use new structure
CREATE OR REPLACE FUNCTION public.is_logistics(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.code IN ('responsable_logistique', 'agent_logistique')
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('responsable_logistique', 'agent_logistique')
  )
$$;

-- Update is_achats to use new structure
CREATE OR REPLACE FUNCTION public.is_achats(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.code IN ('responsable_achats', 'agent_achats')
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('responsable_achats', 'agent_achats')
  )
$$;

-- Update is_comptable to use new structure
CREATE OR REPLACE FUNCTION public.is_comptable(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.code = 'comptable'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'comptable'
  )
$$;

-- Update has_role to support both old enum and new role_id
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      AND r.code = _role::text
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Update get_user_permissions to use role_id
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id UUID)
RETURNS TABLE(permission_code TEXT, module TEXT, name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.code, p.module, p.name
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  JOIN public.role_permissions rp ON rp.role_id = r.id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = _user_id AND r.is_active = true
  UNION
  SELECT DISTINCT p.code, p.module, p.name
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role = ur.role
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = _user_id AND ur.role IS NOT NULL
  ORDER BY module, code
$$;

-- Update get_user_modules to use role_id
CREATE OR REPLACE FUNCTION public.get_user_modules(_user_id UUID)
RETURNS TABLE(module TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.module
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  JOIN public.role_permissions rp ON rp.role_id = r.id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = _user_id
    AND r.is_active = true
    AND p.code LIKE '%.voir'
  UNION
  SELECT DISTINCT p.module
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role = ur.role
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = _user_id
    AND ur.role IS NOT NULL
    AND p.code LIKE '%.voir'
  ORDER BY module
$$;

-- Update has_permission to use role_id
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id
      AND p.code = _permission_code
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id
      AND p.code = _permission_code
  )
$$;

-- Function to get user roles (returns role codes)
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS TABLE(role_id UUID, role_code TEXT, role_label TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.code, r.label
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = _user_id AND r.is_active = true
  UNION
  SELECT r.id, r.code, r.label
  FROM public.user_roles ur
  JOIN public.roles r ON r.code = ur.role::text
  WHERE ur.user_id = _user_id AND ur.role IS NOT NULL AND r.is_active = true
$$;

-- Update handle_new_user to use role_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _employe_role_id UUID;
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  
  -- Get the 'employe' role id
  SELECT id INTO _employe_role_id FROM public.roles WHERE code = 'employe';
  
  -- Assign the default 'employe' role using role_id
  IF _employe_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, _employe_role_id);
  ELSE
    -- Fallback to enum if role not found
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'employe');
  END IF;
  
  RETURN NEW;
END;
$$;