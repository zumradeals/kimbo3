-- =============================================================================
-- KPM (KIMBO Procurement Management) - Complete Database Schema
-- Export for self-hosted deployment (VPS, Supabase self-hosted, etc.)
-- Generated: 2026-01-01 (v1.1 - Fixed handle_new_user trigger)
-- =============================================================================

-- =============================================================================
-- SECTION 1: ENUMS (Types énumérés)
-- =============================================================================

CREATE TYPE public.app_role AS ENUM (
  'admin', 'dg', 'daf', 'responsable_departement', 'responsable_logistique', 
  'agent_logistique', 'responsable_achats', 'agent_achats', 'comptable', 'employe'
);

CREATE TYPE public.besoin_status AS ENUM (
  'cree', 'pris_en_charge', 'accepte', 'refuse', 'retourne'
);

CREATE TYPE public.besoin_urgency AS ENUM (
  'normale', 'urgente', 'critique'
);

CREATE TYPE public.besoin_category AS ENUM (
  'fournitures', 'equipement', 'services', 'travaux', 'maintenance', 'autre'
);

CREATE TYPE public.besoin_ligne_category AS ENUM (
  'materiel', 'service', 'consommable', 'equipement', 'autre'
);

CREATE TYPE public.da_status AS ENUM (
  'brouillon', 'soumise', 'en_analyse', 'chiffree', 'soumise_validation',
  'validee_finance', 'refusee_finance', 'en_revision_achats', 'rejetee',
  'payee', 'rejetee_comptabilite'
);

CREATE TYPE public.da_priority AS ENUM (
  'normale', 'urgente', 'critique'
);

CREATE TYPE public.bl_status AS ENUM (
  'prepare', 'en_attente_validation', 'valide', 'livre', 'livree_partiellement', 'refusee'
);

CREATE TYPE public.stock_status AS ENUM (
  'disponible', 'reserve', 'epuise'
);

CREATE TYPE public.note_frais_status AS ENUM (
  'brouillon', 'soumise', 'validee_daf', 'payee', 'rejetee'
);

-- =============================================================================
-- SECTION 2: TABLES PRINCIPALES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: departments (Départements)
-- -----------------------------------------------------------------------------
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: roles (Rôles dynamiques)
-- -----------------------------------------------------------------------------
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: permissions (Permissions granulaires)
-- -----------------------------------------------------------------------------
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  module TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: role_permissions (Liaison rôles-permissions)
-- -----------------------------------------------------------------------------
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  role public.app_role,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- -----------------------------------------------------------------------------
-- Table: profiles (Profils utilisateurs)
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  department_id UUID REFERENCES public.departments(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: user_roles (Attribution des rôles aux utilisateurs)
-- -----------------------------------------------------------------------------
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  role public.app_role,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- -----------------------------------------------------------------------------
-- Table: projets (Projets)
-- -----------------------------------------------------------------------------
CREATE TABLE public.projets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  budget_total NUMERIC DEFAULT 0,
  budget_consomme NUMERIC DEFAULT 0,
  date_debut DATE,
  date_fin DATE,
  status TEXT NOT NULL DEFAULT 'actif',
  responsable_id UUID REFERENCES public.profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: stock_categories (Catégories de stock)
-- -----------------------------------------------------------------------------
CREATE TABLE public.stock_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.stock_categories(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: units (Unités de mesure)
-- -----------------------------------------------------------------------------
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: articles_stock (Articles en stock)
-- -----------------------------------------------------------------------------
CREATE TABLE public.articles_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  designation TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'unité',
  category_id UUID REFERENCES public.stock_categories(id),
  quantity_available NUMERIC NOT NULL DEFAULT 0,
  quantity_reserved NUMERIC NOT NULL DEFAULT 0,
  quantity_min NUMERIC DEFAULT 0,
  location TEXT,
  status public.stock_status NOT NULL DEFAULT 'disponible',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: stock_movements (Mouvements de stock)
-- -----------------------------------------------------------------------------
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_stock_id UUID NOT NULL REFERENCES public.articles_stock(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  quantity_before NUMERIC NOT NULL,
  quantity_after NUMERIC NOT NULL,
  reference TEXT NOT NULL,
  bl_id UUID,
  da_id UUID,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: besoins (Besoins internes)
-- -----------------------------------------------------------------------------
CREATE TABLE public.besoins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  objet_besoin VARCHAR,
  category public.besoin_category NOT NULL,
  urgency public.besoin_urgency NOT NULL DEFAULT 'normale',
  besoin_type TEXT DEFAULT 'article',
  estimated_quantity NUMERIC,
  unit TEXT DEFAULT 'unité',
  desired_date DATE,
  intended_usage TEXT,
  technical_specs TEXT,
  fournisseur_impose BOOLEAN DEFAULT false,
  fournisseur_impose_nom TEXT,
  fournisseur_impose_contact TEXT,
  besoin_vehicule BOOLEAN DEFAULT false,
  besoin_avance_caisse BOOLEAN DEFAULT false,
  avance_caisse_montant NUMERIC,
  confirmation_engagement BOOLEAN DEFAULT false,
  lieu_livraison TEXT,
  site_projet TEXT,
  attachment_url TEXT,
  attachment_name TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  department_id UUID NOT NULL REFERENCES public.departments(id),
  projet_id UUID REFERENCES public.projets(id),
  status public.besoin_status NOT NULL DEFAULT 'cree',
  taken_by UUID REFERENCES auth.users(id),
  taken_at TIMESTAMP WITH TIME ZONE,
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  return_comment TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMP WITH TIME ZONE,
  locked_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: besoin_lignes (Lignes de besoin)
-- -----------------------------------------------------------------------------
CREATE TABLE public.besoin_lignes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  besoin_id UUID NOT NULL REFERENCES public.besoins(id) ON DELETE CASCADE,
  designation TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'unité',
  category public.besoin_ligne_category NOT NULL DEFAULT 'materiel',
  urgency public.besoin_urgency NOT NULL DEFAULT 'normale',
  justification TEXT,
  article_stock_id UUID REFERENCES public.articles_stock(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: besoin_attachments (Pièces jointes besoins)
-- -----------------------------------------------------------------------------
CREATE TABLE public.besoin_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  besoin_id UUID NOT NULL REFERENCES public.besoins(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: fournisseurs (Fournisseurs)
-- -----------------------------------------------------------------------------
CREATE TABLE public.fournisseurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: payment_categories (Catégories de paiement)
-- -----------------------------------------------------------------------------
CREATE TABLE public.payment_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: payment_methods (Méthodes de paiement)
-- -----------------------------------------------------------------------------
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  requires_reference BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: caisses (Caisses)
-- -----------------------------------------------------------------------------
CREATE TABLE public.caisses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'principale',
  devise TEXT NOT NULL DEFAULT 'XAF',
  solde_initial NUMERIC NOT NULL DEFAULT 0,
  solde_actuel NUMERIC NOT NULL DEFAULT 0,
  responsable_id UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: demandes_achat (Demandes d'achat)
-- -----------------------------------------------------------------------------
CREATE TABLE public.demandes_achat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  besoin_id UUID NOT NULL REFERENCES public.besoins(id),
  department_id UUID NOT NULL REFERENCES public.departments(id),
  projet_id UUID REFERENCES public.projets(id),
  category public.besoin_category NOT NULL,
  priority public.da_priority NOT NULL DEFAULT 'normale',
  desired_date DATE,
  status public.da_status NOT NULL DEFAULT 'brouillon',
  currency TEXT DEFAULT 'XOF',
  total_amount NUMERIC,
  selected_fournisseur_id UUID REFERENCES public.fournisseurs(id),
  fournisseur_justification TEXT,
  observations TEXT,
  attachment_url TEXT,
  attachment_name TEXT,
  -- Workflow fields
  created_by UUID NOT NULL REFERENCES auth.users(id),
  submitted_at TIMESTAMP WITH TIME ZONE,
  analyzed_by UUID REFERENCES auth.users(id),
  analyzed_at TIMESTAMP WITH TIME ZONE,
  priced_by UUID REFERENCES auth.users(id),
  priced_at TIMESTAMP WITH TIME ZONE,
  submitted_validation_by UUID REFERENCES auth.users(id),
  submitted_validation_at TIMESTAMP WITH TIME ZONE,
  validated_finance_by UUID REFERENCES auth.users(id),
  validated_finance_at TIMESTAMP WITH TIME ZONE,
  finance_decision_comment TEXT,
  revision_requested_by UUID REFERENCES auth.users(id),
  revision_requested_at TIMESTAMP WITH TIME ZONE,
  revision_comment TEXT,
  rejected_by UUID REFERENCES auth.users(id),
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  -- Comptabilité
  comptabilise_by UUID REFERENCES auth.users(id),
  comptabilise_at TIMESTAMP WITH TIME ZONE,
  comptabilite_rejection_reason TEXT,
  syscohada_classe INTEGER,
  syscohada_compte TEXT,
  syscohada_nature_charge TEXT,
  syscohada_centre_cout TEXT,
  mode_paiement TEXT,
  reference_paiement TEXT,
  payment_category_id UUID REFERENCES public.payment_categories(id),
  payment_method_id UUID REFERENCES public.payment_methods(id),
  payment_details JSONB DEFAULT '{}'::jsonb,
  caisse_id UUID REFERENCES public.caisses(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: da_articles (Articles de DA)
-- -----------------------------------------------------------------------------
CREATE TABLE public.da_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  da_id UUID NOT NULL REFERENCES public.demandes_achat(id) ON DELETE CASCADE,
  designation TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'unité',
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: da_article_prices (Prix fournisseurs par article)
-- -----------------------------------------------------------------------------
CREATE TABLE public.da_article_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  da_article_id UUID NOT NULL REFERENCES public.da_articles(id) ON DELETE CASCADE,
  fournisseur_id UUID NOT NULL REFERENCES public.fournisseurs(id),
  unit_price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XOF',
  delivery_delay TEXT,
  conditions TEXT,
  is_selected BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: bons_livraison (Bons de livraison)
-- -----------------------------------------------------------------------------
CREATE TABLE public.bons_livraison (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  besoin_id UUID NOT NULL REFERENCES public.besoins(id),
  department_id UUID NOT NULL REFERENCES public.departments(id),
  projet_id UUID REFERENCES public.projets(id),
  bl_type TEXT DEFAULT 'fournisseur',
  status public.bl_status NOT NULL DEFAULT 'prepare',
  delivery_date DATE,
  warehouse TEXT,
  observations TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMP WITH TIME ZONE,
  delivered_by UUID REFERENCES auth.users(id),
  delivered_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID REFERENCES auth.users(id),
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: bl_articles (Articles de BL)
-- -----------------------------------------------------------------------------
CREATE TABLE public.bl_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bl_id UUID NOT NULL REFERENCES public.bons_livraison(id) ON DELETE CASCADE,
  designation TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  quantity_ordered NUMERIC,
  quantity_delivered NUMERIC DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'unité',
  article_stock_id UUID REFERENCES public.articles_stock(id),
  observations TEXT,
  ecart_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: notes_frais (Notes de frais)
-- -----------------------------------------------------------------------------
CREATE TABLE public.notes_frais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  department_id UUID NOT NULL REFERENCES public.departments(id),
  projet_id UUID REFERENCES public.projets(id),
  status public.note_frais_status NOT NULL DEFAULT 'brouillon',
  currency TEXT NOT NULL DEFAULT 'XAF',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  submitted_at TIMESTAMP WITH TIME ZONE,
  validated_daf_by UUID REFERENCES auth.users(id),
  validated_daf_at TIMESTAMP WITH TIME ZONE,
  paid_by UUID REFERENCES auth.users(id),
  paid_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID REFERENCES auth.users(id),
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  mode_paiement TEXT,
  reference_paiement TEXT,
  payment_category_id UUID REFERENCES public.payment_categories(id),
  payment_method_id UUID REFERENCES public.payment_methods(id),
  payment_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: note_frais_lignes (Lignes de notes de frais)
-- -----------------------------------------------------------------------------
CREATE TABLE public.note_frais_lignes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_frais_id UUID NOT NULL REFERENCES public.notes_frais(id) ON DELETE CASCADE,
  date_depense DATE NOT NULL,
  motif TEXT NOT NULL,
  montant NUMERIC NOT NULL,
  projet_id UUID REFERENCES public.projets(id),
  justificatif_url TEXT,
  justificatif_name TEXT,
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: comptes_comptables (Plan comptable SYSCOHADA)
-- -----------------------------------------------------------------------------
CREATE TABLE public.comptes_comptables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  libelle TEXT NOT NULL,
  classe INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: ecritures_comptables (Écritures comptables)
-- -----------------------------------------------------------------------------
CREATE TABLE public.ecritures_comptables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL,
  da_id UUID NOT NULL REFERENCES public.demandes_achat(id),
  date_ecriture DATE NOT NULL DEFAULT CURRENT_DATE,
  classe_syscohada INTEGER NOT NULL,
  compte_comptable TEXT NOT NULL,
  libelle TEXT NOT NULL,
  nature_charge TEXT NOT NULL,
  centre_cout TEXT,
  debit NUMERIC NOT NULL DEFAULT 0,
  credit NUMERIC NOT NULL DEFAULT 0,
  devise TEXT NOT NULL DEFAULT 'XOF',
  mode_paiement TEXT,
  reference_paiement TEXT,
  observations TEXT,
  is_validated BOOLEAN NOT NULL DEFAULT false,
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: caisse_mouvements (Mouvements de caisse)
-- -----------------------------------------------------------------------------
CREATE TABLE public.caisse_mouvements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caisse_id UUID NOT NULL REFERENCES public.caisses(id),
  type TEXT NOT NULL,
  montant NUMERIC NOT NULL,
  solde_avant NUMERIC NOT NULL,
  solde_apres NUMERIC NOT NULL,
  motif TEXT NOT NULL,
  reference TEXT NOT NULL,
  da_id UUID REFERENCES public.demandes_achat(id),
  note_frais_id UUID REFERENCES public.notes_frais(id),
  observations TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: notifications
-- -----------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: audit_logs (Journal d'audit)
-- -----------------------------------------------------------------------------
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
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: governance_derogations (Dérogations de gouvernance)
-- -----------------------------------------------------------------------------
CREATE TABLE public.governance_derogations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  derogation_type TEXT NOT NULL,
  description TEXT NOT NULL,
  justification TEXT NOT NULL,
  role_concerned TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  approval_date DATE NOT NULL,
  expiration_date DATE,
  review_frequency TEXT DEFAULT 'trimestriel',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================================================
-- SECTION 3: FONCTIONS DE SÉCURITÉ (SECURITY DEFINER)
-- =============================================================================

-- Vérifier si un utilisateur est admin
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

-- Vérifier si un utilisateur est DG
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

-- Vérifier si un utilisateur a un rôle spécifique (enum)
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

-- Vérifier si un utilisateur a un rôle par code (text)
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

-- Vérifier si un utilisateur est logistique
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

-- Vérifier si un utilisateur est achats
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

-- Vérifier si un utilisateur est comptable
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

-- Obtenir le département d'un utilisateur
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

-- Obtenir les profils publics (bypass RLS pour affichage)
CREATE OR REPLACE FUNCTION public.get_public_profiles(_user_ids UUID[])
RETURNS TABLE(id UUID, first_name TEXT, last_name TEXT, department_name TEXT, email TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.first_name,
    p.last_name,
    d.name as department_name,
    p.email
  FROM public.profiles p
  LEFT JOIN public.departments d ON p.department_id = d.id
  WHERE p.id = ANY(_user_ids);
$$;

-- Obtenir les rôles d'un utilisateur
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

-- Obtenir les permissions d'un utilisateur
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

-- Vérifier une permission
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

-- Vérifier si l'utilisateur peut créer un besoin
CREATE OR REPLACE FUNCTION public.can_create_besoin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('admin', 'dg', 'daf', 'responsable_departement', 'responsable_logistique', 'responsable_achats')
  )
$$;

-- Vérifier si l'utilisateur peut insérer une ligne de besoin
CREATE OR REPLACE FUNCTION public.user_can_insert_besoin_ligne(_user_id UUID, _besoin_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.besoins
    WHERE id = _besoin_id 
      AND user_id = _user_id
      AND status = 'cree'
  )
$$;

-- Vérifier si un besoin peut être transformé
CREATE OR REPLACE FUNCTION public.can_transform_besoin(_besoin_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.demandes_achat WHERE besoin_id = _besoin_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.bons_livraison WHERE besoin_id = _besoin_id
  ) AND EXISTS (
    SELECT 1 FROM public.besoins WHERE id = _besoin_id AND status = 'accepte'
  )
$$;

-- =============================================================================
-- SECTION 4: FONCTIONS UTILITAIRES
-- =============================================================================

-- Générer une référence de DA
CREATE OR REPLACE FUNCTION public.generate_da_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year TEXT;
  _max_num INT;
  _ref TEXT;
BEGIN
  _year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(reference FROM 'DA-' || _year || '-([0-9]+)') AS INT)
  ), 0) + 1
  INTO _max_num
  FROM public.demandes_achat 
  WHERE reference LIKE 'DA-' || _year || '-%';
  _ref := 'DA-' || _year || '-' || lpad(_max_num::TEXT, 4, '0');
  RETURN _ref;
END;
$$;

-- Générer une référence de BL
CREATE OR REPLACE FUNCTION public.generate_bl_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year TEXT;
  _count INT;
  _ref TEXT;
BEGIN
  _year := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO _count 
  FROM public.bons_livraison 
  WHERE reference LIKE 'BL-' || _year || '-%';
  _ref := 'BL-' || _year || '-' || lpad(_count::TEXT, 4, '0');
  RETURN _ref;
END;
$$;

-- Générer une référence de Note de Frais
CREATE OR REPLACE FUNCTION public.generate_ndf_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year TEXT;
  _month TEXT;
  _count INT;
  _ref TEXT;
BEGIN
  _year := to_char(now(), 'YYYY');
  _month := to_char(now(), 'MM');
  SELECT COUNT(*) + 1 INTO _count 
  FROM public.notes_frais 
  WHERE reference LIKE 'NDF-' || _year || _month || '-%';
  _ref := 'NDF-' || _year || _month || '-' || lpad(_count::TEXT, 4, '0');
  RETURN _ref;
END;
$$;

-- Générer une référence d'écriture comptable
CREATE OR REPLACE FUNCTION public.generate_ecriture_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year TEXT;
  _month TEXT;
  _count INT;
  _ref TEXT;
BEGIN
  _year := to_char(now(), 'YYYY');
  _month := to_char(now(), 'MM');
  SELECT COUNT(*) + 1 INTO _count 
  FROM public.ecritures_comptables 
  WHERE reference LIKE 'EC-' || _year || _month || '-%';
  _ref := 'EC-' || _year || _month || '-' || lpad(_count::TEXT, 5, '0');
  RETURN _ref;
END;
$$;

-- Fonction de mise à jour automatique updated_at
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

-- Créer une notification
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id UUID, 
  _type TEXT, 
  _title TEXT, 
  _message TEXT, 
  _link TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (_user_id, _type, _title, _message, _link)
  RETURNING id INTO _notification_id;
  RETURN _notification_id;
END;
$$;

-- =============================================================================
-- SECTION 5: TRIGGERS
-- =============================================================================

-- Trigger pour mise à jour automatique de updated_at
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_projets_updated_at BEFORE UPDATE ON public.projets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_articles_stock_updated_at BEFORE UPDATE ON public.articles_stock
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_besoins_updated_at BEFORE UPDATE ON public.besoins
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_fournisseurs_updated_at BEFORE UPDATE ON public.fournisseurs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_demandes_achat_updated_at BEFORE UPDATE ON public.demandes_achat
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_bons_livraison_updated_at BEFORE UPDATE ON public.bons_livraison
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_notes_frais_updated_at BEFORE UPDATE ON public.notes_frais
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_caisses_updated_at BEFORE UPDATE ON public.caisses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger pour mise à jour automatique du statut de stock
CREATE OR REPLACE FUNCTION public.update_stock_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.quantity_available <= 0 THEN
    NEW.status := 'epuise'::stock_status;
  ELSIF NEW.quantity_reserved >= NEW.quantity_available THEN
    NEW.status := 'reserve'::stock_status;
  ELSE
    NEW.status := 'disponible'::stock_status;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_stock_status_trigger BEFORE UPDATE ON public.articles_stock
  FOR EACH ROW EXECUTE FUNCTION public.update_stock_status();

-- Trigger pour verrouiller le besoin lors de la conversion
CREATE OR REPLACE FUNCTION public.lock_besoin_on_conversion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.besoins 
  SET is_locked = true, 
      locked_at = now(),
      locked_reason = CASE 
        WHEN TG_TABLE_NAME = 'demandes_achat' THEN 'Converti en DA: ' || NEW.reference
        WHEN TG_TABLE_NAME = 'bons_livraison' THEN 'Converti en BL: ' || NEW.reference
        ELSE 'Conversion'
      END
  WHERE id = NEW.besoin_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER lock_besoin_on_da_creation AFTER INSERT ON public.demandes_achat
  FOR EACH ROW EXECUTE FUNCTION public.lock_besoin_on_conversion();

CREATE TRIGGER lock_besoin_on_bl_creation AFTER INSERT ON public.bons_livraison
  FOR EACH ROW EXECUTE FUNCTION public.lock_besoin_on_conversion();

-- Trigger pour empêcher les stocks négatifs
CREATE OR REPLACE FUNCTION public.prevent_negative_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quantity_available < 0 THEN
    INSERT INTO public.audit_logs (
      user_id, action, table_name, record_id, old_values, new_values
    ) VALUES (
      auth.uid(), 'STOCK_NEGATIVE_BLOCKED', 'articles_stock', NEW.id,
      jsonb_build_object('quantity_available', OLD.quantity_available),
      jsonb_build_object('attempted_quantity', NEW.quantity_available, 'designation', NEW.designation, 'blocked_at', NOW())
    );
    RAISE EXCEPTION 'STOCK_NEGATIF_INTERDIT: La quantité disponible ne peut pas être négative. Article: %, Quantité tentée: %', 
      NEW.designation, NEW.quantity_available;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_negative_stock_trigger BEFORE UPDATE ON public.articles_stock
  FOR EACH ROW EXECUTE FUNCTION public.prevent_negative_stock();

-- Trigger pour valider les ajustements de stock
CREATE OR REPLACE FUNCTION public.validate_stock_adjustment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.movement_type = 'ajustement' AND (NEW.observations IS NULL OR trim(NEW.observations) = '') THEN
    RAISE EXCEPTION 'Le motif est obligatoire pour les ajustements de stock';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_stock_adjustment_trigger BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.validate_stock_adjustment();

-- Trigger pour mettre à jour le solde de caisse
CREATE OR REPLACE FUNCTION public.update_caisse_solde()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'entree' THEN
    UPDATE public.caisses SET solde_actuel = solde_actuel + NEW.montant, updated_at = now()
    WHERE id = NEW.caisse_id;
  ELSIF NEW.type = 'sortie' THEN
    UPDATE public.caisses SET solde_actuel = solde_actuel - NEW.montant, updated_at = now()
    WHERE id = NEW.caisse_id;
  ELSIF NEW.type = 'ajustement' THEN
    UPDATE public.caisses SET solde_actuel = NEW.solde_apres, updated_at = now()
    WHERE id = NEW.caisse_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_caisse_solde_trigger AFTER INSERT ON public.caisse_mouvements
  FOR EACH ROW EXECUTE FUNCTION public.update_caisse_solde();

-- =============================================================================
-- FONCTION: handle_new_user (Création automatique profil et rôle)
-- CORRIGÉ: Always set both role (NOT NULL) and role_id to prevent null constraint violation
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _employe_role_id UUID;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  
  -- Get the 'employe' role id from roles table
  SELECT id INTO _employe_role_id FROM public.roles WHERE code = 'employe';
  
  -- Always insert with role enum set (required NOT NULL), optionally with role_id
  INSERT INTO public.user_roles (user_id, role, role_id)
  VALUES (NEW.id, 'employe'::public.app_role, _employe_role_id);
  
  RETURN NEW;
END;
$function$;

-- IMPORTANT: Ce trigger doit être créé sur auth.users (nécessite accès au schéma auth)
-- Exécuter manuellement après déploiement:
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger pour audit automatique
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values)
    VALUES (auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values)
    VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Créer les triggers d'audit pour les tables principales
CREATE TRIGGER audit_besoins AFTER INSERT OR UPDATE OR DELETE ON public.besoins
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_demandes_achat AFTER INSERT OR UPDATE OR DELETE ON public.demandes_achat
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_bons_livraison AFTER INSERT OR UPDATE OR DELETE ON public.bons_livraison
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_articles_stock AFTER INSERT OR UPDATE OR DELETE ON public.articles_stock
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_stock_movements AFTER INSERT OR UPDATE OR DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_notes_frais AFTER INSERT OR UPDATE OR DELETE ON public.notes_frais
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_ecritures_comptables AFTER INSERT OR UPDATE OR DELETE ON public.ecritures_comptables
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_caisse_mouvements AFTER INSERT OR UPDATE OR DELETE ON public.caisse_mouvements
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_fournisseurs AFTER INSERT OR UPDATE OR DELETE ON public.fournisseurs
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- =============================================================================
-- SECTION 6: ACTIVATION RLS (Row Level Security)
-- =============================================================================

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.besoins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.besoin_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.besoin_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fournisseurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caisses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demandes_achat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.da_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.da_article_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bons_livraison ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bl_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes_frais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_frais_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comptes_comptables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecritures_comptables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caisse_mouvements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_derogations ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- SECTION 7: POLITIQUES RLS (Row Level Security Policies)
-- Note: Ce fichier contient les politiques principales. 
-- Adaptez-les selon vos besoins de sécurité.
-- =============================================================================

-- DEPARTMENTS
CREATE POLICY "Tous les utilisateurs authentifiés peuvent voir les départements" 
  ON public.departments FOR SELECT USING (true);
CREATE POLICY "Seuls les admins peuvent gérer les départements" 
  ON public.departments FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- PROFILES
CREATE POLICY "Utilisateurs voient leur propre profil" 
  ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Admins voient tous les profils" 
  ON public.profiles FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Utilisateurs peuvent modifier leur propre profil" 
  ON public.profiles FOR UPDATE USING (id = auth.uid());

-- USER_ROLES
CREATE POLICY "Admins peuvent gérer les rôles utilisateurs" 
  ON public.user_roles FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- BESOINS (exemples - adaptez selon vos besoins)
CREATE POLICY "Créateur voit ses propres besoins" 
  ON public.besoins FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admin voit tous les besoins" 
  ON public.besoins FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "DG voit tous les besoins" 
  ON public.besoins FOR SELECT USING (is_dg(auth.uid()));
CREATE POLICY "DAF voit tous les besoins" 
  ON public.besoins FOR SELECT USING (has_role(auth.uid(), 'daf'::app_role));
CREATE POLICY "Logistique voit tous les besoins" 
  ON public.besoins FOR SELECT USING (is_logistics(auth.uid()));

-- NOTIFICATIONS
CREATE POLICY "Utilisateurs voient leurs propres notifications" 
  ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Utilisateurs peuvent modifier leurs propres notifications" 
  ON public.notifications FOR UPDATE USING (user_id = auth.uid());

-- AUDIT_LOGS
CREATE POLICY "Admin DG DAF peuvent voir les logs" 
  ON public.audit_logs FOR SELECT USING (is_admin(auth.uid()) OR is_dg(auth.uid()) OR has_role(auth.uid(), 'daf'::app_role));
CREATE POLICY "Le système peut insérer des logs" 
  ON public.audit_logs FOR INSERT WITH CHECK (true);

-- =============================================================================
-- SECTION 8: STORAGE BUCKETS
-- =============================================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('besoins-attachments', 'besoins-attachments', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('da-attachments', 'da-attachments', true);

-- Storage policies (à adapter)
CREATE POLICY "Utilisateurs authentifiés peuvent uploader" 
  ON storage.objects FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Fichiers publics lisibles" 
  ON storage.objects FOR SELECT USING (bucket_id IN ('besoins-attachments', 'da-attachments'));

-- =============================================================================
-- SECTION 9: DONNÉES INITIALES
-- =============================================================================

-- Rôles par défaut
INSERT INTO public.roles (code, label, description) VALUES
  ('admin', 'Administrateur', 'Accès complet au système'),
  ('dg', 'Directeur Général', 'Direction générale'),
  ('daf', 'Directeur Administratif et Financier', 'Direction financière'),
  ('responsable_departement', 'Responsable Département', 'Chef de département'),
  ('responsable_logistique', 'Responsable Logistique', 'Chef du service logistique'),
  ('agent_logistique', 'Agent Logistique', 'Agent du service logistique'),
  ('responsable_achats', 'Responsable Achats', 'Chef du service achats'),
  ('agent_achats', 'Agent Achats', 'Agent du service achats'),
  ('comptable', 'Comptable', 'Service comptabilité'),
  ('employe', 'Employé', 'Employé standard');

-- Unités par défaut
INSERT INTO public.units (code, name, symbol) VALUES
  ('unite', 'Unité', 'u'),
  ('piece', 'Pièce', 'pce'),
  ('kg', 'Kilogramme', 'kg'),
  ('litre', 'Litre', 'L'),
  ('metre', 'Mètre', 'm'),
  ('m2', 'Mètre carré', 'm²'),
  ('m3', 'Mètre cube', 'm³'),
  ('carton', 'Carton', 'ctn'),
  ('paquet', 'Paquet', 'pqt'),
  ('rame', 'Rame', 'rm'),
  ('boite', 'Boîte', 'bte'),
  ('rouleau', 'Rouleau', 'rlx');

-- Catégories de stock par défaut
INSERT INTO public.stock_categories (name, description) VALUES
  ('Fournitures de bureau', 'Papeterie, stylos, etc.'),
  ('Informatique', 'Matériel informatique et consommables'),
  ('Mobilier', 'Meubles de bureau'),
  ('Électroménager', 'Équipements électroménagers'),
  ('Entretien', 'Produits d''entretien et nettoyage'),
  ('Sécurité', 'Équipements de sécurité');

-- Méthodes de paiement par défaut
INSERT INTO public.payment_methods (code, name, requires_reference) VALUES
  ('especes', 'Espèces', false),
  ('cheque', 'Chèque', true),
  ('virement', 'Virement bancaire', true),
  ('mobile_money', 'Mobile Money', true),
  ('carte', 'Carte bancaire', true);

-- Catégories de paiement par défaut
INSERT INTO public.payment_categories (code, name) VALUES
  ('fournisseur', 'Paiement fournisseur'),
  ('salaire', 'Salaires et rémunérations'),
  ('frais', 'Frais généraux'),
  ('impots', 'Impôts et taxes'),
  ('autre', 'Autre');

-- =============================================================================
-- FIN DU SCRIPT
-- =============================================================================

-- NOTES IMPORTANTES:
-- 1. Ce script suppose que vous avez une instance Supabase/PostgreSQL configurée
-- 2. Les politiques RLS sont simplifiées - adaptez-les à vos besoins de sécurité
-- 3. Certains triggers de notifications ont été omis pour simplifier
-- 4. Testez d'abord sur un environnement de développement
-- 5. N'oubliez pas de créer un premier utilisateur admin manuellement
