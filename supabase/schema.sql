-- ==============================================================================
-- KPM (Kimbo Procurement Management) - Schéma complet de la base de données
-- Généré à partir de l'état actuel des 95+ migrations
-- ==============================================================================
-- ⚠️  Ce fichier est une RÉFÉRENCE. Ne pas l'exécuter si les migrations
--     ont déjà été appliquées. Utilisez-le pour recréer la base from scratch.
-- ==============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- TYPES ENUM
-- ==============================================================================
CREATE TYPE public.app_role AS ENUM (
  'admin', 'dg', 'daf', 'comptable',
  'responsable_logistique', 'agent_logistique',
  'responsable_achats', 'agent_achats', 'aal',
  'responsable_departement', 'employe', 'lecture_seule'
);

CREATE TYPE public.besoin_status AS ENUM (
  'cree', 'pris_en_charge', 'accepte', 'refuse', 'retourne', 'annule'
);

CREATE TYPE public.besoin_category AS ENUM (
  'materiel', 'service', 'travaux', 'fourniture', 'autre'
);

CREATE TYPE public.besoin_urgency AS ENUM (
  'normale', 'urgente', 'tres_urgente'
);

CREATE TYPE public.besoin_ligne_category AS ENUM (
  'materiel', 'service', 'travaux', 'fourniture', 'autre'
);

CREATE TYPE public.da_status AS ENUM (
  'brouillon', 'soumise', 'en_analyse', 'chiffree',
  'soumise_validation', 'validee_aal', 'rejetee_aal',
  'validee_finance', 'payee', 'annulee', 'en_revision'
);

CREATE TYPE public.da_category AS ENUM (
  'materiel', 'service', 'travaux', 'fourniture', 'autre'
);

CREATE TYPE public.da_priority AS ENUM (
  'basse', 'normale', 'haute', 'urgente'
);

CREATE TYPE public.bl_status AS ENUM (
  'prepare', 'en_attente_validation', 'valide', 'rejete',
  'livre', 'livree_partiellement', 'annule'
);

CREATE TYPE public.stock_status AS ENUM (
  'disponible', 'reserve', 'epuise', 'en_commande'
);

CREATE TYPE public.expression_besoin_status AS ENUM (
  'brouillon', 'soumis', 'valide', 'rejete'
);

CREATE TYPE public.expression_besoin_status_v2 AS ENUM (
  'brouillon', 'soumis', 'en_examen',
  'valide_departement', 'rejete_departement',
  'envoye_logistique'
);

CREATE TYPE public.payment_class AS ENUM (
  'investissement', 'fonctionnement'
);

-- ==============================================================================
-- TABLES PRINCIPALES
-- ==============================================================================

-- Départements
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Rôles (table dynamique)
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Permissions
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  module TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Association rôle <-> permissions
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  role public.app_role,
  permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- Profils utilisateurs (extension de auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  photo_url TEXT,
  fonction TEXT,
  department_id UUID REFERENCES public.departments(id),
  chef_hierarchique_id UUID REFERENCES public.profiles(id),
  position_departement TEXT,
  statut_utilisateur TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Rôles utilisateurs (table séparée — SÉCURITÉ RBAC)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  role_id UUID REFERENCES public.roles(id),
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Projets
CREATE TABLE public.projets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  code TEXT UNIQUE,
  description TEXT,
  statut TEXT DEFAULT 'actif',
  budget NUMERIC,
  devise TEXT DEFAULT 'XOF',
  responsable_id UUID REFERENCES public.profiles(id),
  department_id UUID REFERENCES public.departments(id),
  date_debut DATE,
  date_fin DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tiers
CREATE TABLE public.tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  type TEXT NOT NULL,
  email TEXT,
  telephone TEXT,
  adresse TEXT,
  ville TEXT,
  pays TEXT,
  code_fiscal TEXT,
  registre_commerce TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fournisseurs
CREATE TABLE public.fournisseurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  tiers_id UUID REFERENCES public.tiers(id),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Entrepôts
CREATE TABLE public.entrepots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  type TEXT DEFAULT 'principal',
  localisation TEXT,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Catégories stock
CREATE TABLE public.stock_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Articles en stock
CREATE TABLE public.articles_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  designation TEXT NOT NULL,
  description TEXT,
  unit TEXT DEFAULT 'unité',
  quantity_available NUMERIC DEFAULT 0,
  quantity_reserved NUMERIC DEFAULT 0,
  quantity_min NUMERIC,
  status public.stock_status DEFAULT 'disponible',
  location TEXT,
  category_id UUID REFERENCES public.stock_categories(id),
  entrepot_id UUID REFERENCES public.entrepots(id),
  prix_reference NUMERIC,
  prix_reference_note TEXT,
  prix_reference_updated_at TIMESTAMPTZ,
  devise TEXT,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Niveaux de stock par entrepôt
CREATE TABLE public.stock_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_stock_id UUID REFERENCES public.articles_stock(id) ON DELETE CASCADE NOT NULL,
  entrepot_id UUID REFERENCES public.entrepots(id) ON DELETE CASCADE NOT NULL,
  quantite_disponible NUMERIC DEFAULT 0,
  quantite_reservee NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entrepot_id, article_stock_id)
);

-- Mouvements de stock
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_stock_id UUID REFERENCES public.articles_stock(id) NOT NULL,
  entrepot_id UUID REFERENCES public.entrepots(id),
  movement_type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  quantity_before NUMERIC,
  quantity_after NUMERIC,
  reference TEXT,
  bl_id UUID,
  observations TEXT,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Besoins
CREATE TABLE public.besoins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category public.besoin_category NOT NULL,
  urgency public.besoin_urgency DEFAULT 'normale',
  status public.besoin_status DEFAULT 'cree',
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  department_id UUID REFERENCES public.departments(id) NOT NULL,
  projet_id UUID REFERENCES public.projets(id),
  objet_besoin TEXT,
  besoin_type TEXT,
  estimated_quantity NUMERIC,
  unit TEXT,
  desired_date DATE,
  technical_specs TEXT,
  intended_usage TEXT,
  site_projet TEXT,
  lieu_livraison TEXT,
  besoin_vehicule BOOLEAN,
  besoin_avance_caisse BOOLEAN,
  avance_caisse_montant NUMERIC,
  fournisseur_impose BOOLEAN,
  fournisseur_impose_nom TEXT,
  fournisseur_impose_contact TEXT,
  confirmation_engagement BOOLEAN,
  attachment_url TEXT,
  attachment_name TEXT,
  is_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_reason TEXT,
  taken_by UUID REFERENCES public.profiles(id),
  taken_at TIMESTAMPTZ,
  decided_by UUID REFERENCES public.profiles(id),
  decided_at TIMESTAMPTZ,
  rejection_reason TEXT,
  return_comment TEXT,
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES public.profiles(id),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Lignes de besoin
CREATE TABLE public.besoin_lignes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  besoin_id UUID REFERENCES public.besoins(id) ON DELETE CASCADE NOT NULL,
  designation TEXT NOT NULL,
  category public.besoin_ligne_category DEFAULT 'materiel',
  quantity NUMERIC DEFAULT 1,
  unit TEXT DEFAULT 'unité',
  urgency public.besoin_urgency DEFAULT 'normale',
  justification TEXT,
  article_stock_id UUID REFERENCES public.articles_stock(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pièces jointes besoins
CREATE TABLE public.besoin_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  besoin_id UUID REFERENCES public.besoins(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Expressions de besoin
CREATE TABLE public.expressions_besoin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  department_id UUID REFERENCES public.departments(id) NOT NULL,
  projet_id UUID REFERENCES public.projets(id),
  nom_article TEXT NOT NULL,
  titre TEXT,
  quantite NUMERIC,
  unite TEXT,
  precision_technique TEXT,
  commentaire TEXT,
  date_souhaitee DATE,
  lieu_projet TEXT,
  status public.expression_besoin_status_v2 DEFAULT 'brouillon',
  status_old public.expression_besoin_status DEFAULT 'brouillon',
  chef_validateur_id UUID REFERENCES public.profiles(id),
  besoin_id UUID REFERENCES public.besoins(id),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  sent_to_logistics_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Lignes d'expression de besoin
CREATE TABLE public.expressions_besoin_lignes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expression_id UUID REFERENCES public.expressions_besoin(id) ON DELETE CASCADE NOT NULL,
  nom_article TEXT NOT NULL,
  quantite NUMERIC,
  unite TEXT,
  precision_technique TEXT,
  justification TEXT,
  status TEXT DEFAULT 'en_attente',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Catégories de paiement
CREATE TABLE public.payment_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Méthodes de paiement
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  category_id UUID REFERENCES public.payment_categories(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Demandes d'achat
CREATE TABLE public.demandes_achat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  besoin_id UUID REFERENCES public.besoins(id) NOT NULL,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  department_id UUID REFERENCES public.departments(id) NOT NULL,
  projet_id UUID REFERENCES public.projets(id),
  description TEXT NOT NULL,
  category public.da_category NOT NULL,
  priority public.da_priority DEFAULT 'normale',
  status public.da_status DEFAULT 'brouillon',
  currency TEXT DEFAULT 'XOF',
  total_amount NUMERIC,
  desired_date DATE,
  observations TEXT,
  attachment_url TEXT,
  attachment_name TEXT,
  -- Analyse achats
  analyzed_by UUID REFERENCES public.profiles(id),
  analyzed_at TIMESTAMPTZ,
  selected_fournisseur_id UUID REFERENCES public.fournisseurs(id),
  fournisseur_justification TEXT,
  -- Chiffrage
  priced_by UUID REFERENCES public.profiles(id),
  priced_at TIMESTAMPTZ,
  -- Validation AAL
  validated_aal_by UUID REFERENCES public.profiles(id),
  validated_aal_at TIMESTAMPTZ,
  aal_comment TEXT,
  aal_rejection_reason TEXT,
  -- Soumission validation finance
  submitted_validation_by UUID REFERENCES public.profiles(id),
  submitted_validation_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  -- Validation finance
  validated_finance_by UUID REFERENCES public.profiles(id),
  validated_finance_at TIMESTAMPTZ,
  finance_decision_comment TEXT,
  -- Rejet
  rejected_by UUID REFERENCES public.profiles(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  -- Révision
  revision_requested_by UUID REFERENCES public.profiles(id),
  revision_requested_at TIMESTAMPTZ,
  revision_comment TEXT,
  -- Paiement
  mode_paiement TEXT,
  reference_paiement TEXT,
  payment_class public.payment_class,
  payment_category_id UUID REFERENCES public.payment_categories(id),
  payment_method_id UUID REFERENCES public.payment_methods(id),
  payment_details JSONB,
  caisse_id UUID,
  tiers_id UUID REFERENCES public.tiers(id),
  -- Comptabilité
  comptabilise_by UUID REFERENCES public.profiles(id),
  comptabilise_at TIMESTAMPTZ,
  comptabilite_rejection_reason TEXT,
  syscohada_classe INTEGER,
  syscohada_compte TEXT,
  syscohada_nature_charge TEXT,
  syscohada_centre_cout TEXT,
  -- Annulation
  cancelled_by UUID REFERENCES public.profiles(id),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Articles DA
CREATE TABLE public.da_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  da_id UUID REFERENCES public.demandes_achat(id) ON DELETE CASCADE NOT NULL,
  designation TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT DEFAULT 'unité',
  observations TEXT,
  article_stock_id UUID REFERENCES public.articles_stock(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Prix articles DA
CREATE TABLE public.da_article_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  da_article_id UUID REFERENCES public.da_articles(id) ON DELETE CASCADE NOT NULL,
  fournisseur_id UUID REFERENCES public.fournisseurs(id) NOT NULL,
  unit_price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'XOF',
  conditions TEXT,
  delivery_delay TEXT,
  is_selected BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bons de livraison
CREATE TABLE public.bons_livraison (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  besoin_id UUID REFERENCES public.besoins(id) NOT NULL,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  department_id UUID REFERENCES public.departments(id) NOT NULL,
  projet_id UUID REFERENCES public.projets(id),
  entrepot_id UUID REFERENCES public.entrepots(id),
  bl_type TEXT,
  status public.bl_status DEFAULT 'prepare',
  warehouse TEXT,
  delivery_date DATE,
  observations TEXT,
  -- Validation
  validated_by UUID REFERENCES public.profiles(id),
  validated_at TIMESTAMPTZ,
  -- Rejet
  rejected_by UUID REFERENCES public.profiles(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  -- Livraison
  delivered_by UUID REFERENCES public.profiles(id),
  delivered_at TIMESTAMPTZ,
  -- Annulation
  cancelled_by UUID REFERENCES public.profiles(id),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Articles BL
CREATE TABLE public.bl_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bl_id UUID REFERENCES public.bons_livraison(id) ON DELETE CASCADE NOT NULL,
  designation TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT DEFAULT 'unité',
  quantity_ordered NUMERIC,
  quantity_delivered NUMERIC,
  ecart_reason TEXT,
  observations TEXT,
  article_stock_id UUID REFERENCES public.articles_stock(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Caisses
CREATE TABLE public.caisses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'principale',
  devise TEXT DEFAULT 'XOF',
  solde_initial NUMERIC DEFAULT 0,
  solde_actuel NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  responsable_id UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Mouvements de caisse
CREATE TABLE public.caisse_mouvements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caisse_id UUID REFERENCES public.caisses(id) NOT NULL,
  type TEXT NOT NULL,
  montant NUMERIC NOT NULL,
  solde_avant NUMERIC NOT NULL,
  solde_apres NUMERIC NOT NULL,
  reference TEXT NOT NULL,
  motif TEXT NOT NULL,
  observations TEXT,
  payment_class public.payment_class,
  da_id UUID REFERENCES public.demandes_achat(id),
  note_frais_id UUID,
  transfer_id UUID REFERENCES public.caisse_mouvements(id),
  correction_of_id UUID REFERENCES public.caisse_mouvements(id),
  correction_reason TEXT,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notes de frais
CREATE TABLE public.notes_frais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  department_id UUID REFERENCES public.departments(id),
  projet_id UUID REFERENCES public.projets(id),
  titre TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'brouillon',
  total_amount NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'XOF',
  payment_class public.payment_class,
  payment_category_id UUID REFERENCES public.payment_categories(id),
  payment_details JSONB,
  caisse_id UUID REFERENCES public.caisses(id),
  tiers_id UUID REFERENCES public.tiers(id),
  validated_daf_by UUID REFERENCES public.profiles(id),
  validated_daf_at TIMESTAMPTZ,
  paid_by UUID REFERENCES public.profiles(id),
  paid_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES public.profiles(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Comptes comptables SYSCOHADA
CREATE TABLE public.comptes_comptables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  libelle TEXT NOT NULL,
  classe INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Écritures comptables
CREATE TABLE public.ecritures_comptables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL,
  libelle TEXT NOT NULL,
  date_ecriture DATE DEFAULT CURRENT_DATE,
  compte_comptable TEXT NOT NULL,
  classe_syscohada INTEGER NOT NULL,
  nature_charge TEXT NOT NULL,
  debit NUMERIC DEFAULT 0,
  credit NUMERIC DEFAULT 0,
  devise TEXT DEFAULT 'XOF',
  mode_paiement TEXT,
  reference_paiement TEXT,
  centre_cout TEXT,
  observations TEXT,
  da_id UUID REFERENCES public.demandes_achat(id),
  note_frais_id UUID REFERENCES public.notes_frais(id),
  tiers_id UUID REFERENCES public.tiers(id),
  is_validated BOOLEAN DEFAULT false,
  validated_by UUID REFERENCES public.profiles(id),
  validated_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Logs d'audit
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Dérogations de gouvernance
CREATE TABLE public.governance_derogations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  derogation_type TEXT NOT NULL,
  description TEXT NOT NULL,
  justification TEXT NOT NULL,
  role_concerned TEXT NOT NULL,
  approved_by UUID NOT NULL,
  approval_date DATE NOT NULL,
  expiration_date DATE,
  review_frequency TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- RLS (Row Level Security)
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.besoins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.besoin_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.besoin_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expressions_besoin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expressions_besoin_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demandes_achat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.da_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.da_article_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bons_livraison ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bl_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caisses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caisse_mouvements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes_frais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecritures_comptables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comptes_comptables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fournisseurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entrepots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- NOTE: Les politiques RLS détaillées sont définies dans les migrations.
-- Consultez supabase/migrations/ pour le détail complet.
-- ==============================================================================

-- ==============================================================================
-- TRIGGER : Création automatique profil + rôle à l'inscription
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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

  SELECT id INTO _employe_role_id FROM public.roles WHERE code = 'employe';

  INSERT INTO public.user_roles (user_id, role, role_id)
  VALUES (NEW.id, 'employe'::public.app_role, _employe_role_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
