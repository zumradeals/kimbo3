// KPM SYSTEME - Types & Interfaces

export type AppRole = 
  | 'admin'
  | 'dg'
  | 'daf'
  | 'comptable'
  | 'responsable_logistique'
  | 'agent_logistique'
  | 'responsable_achats'
  | 'agent_achats'
  | 'responsable_departement'
  | 'employe'
  | 'lecture_seule';

export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface Department {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  department_id: string | null;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  department?: Department | null;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  assigned_at: string;
  assigned_by: string | null;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  module: string | null;
  created_at: string;
}

export interface RolePermission {
  id: string;
  role: AppRole;
  permission_id: string;
  created_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  category: string;
  updated_at: string;
  updated_by: string | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// Labels pour l'affichage
export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrateur',
  dg: 'Directeur Général',
  daf: 'Directeur Administratif et Financier',
  comptable: 'Comptable',
  responsable_logistique: 'Responsable Logistique',
  agent_logistique: 'Agent Logistique',
  responsable_achats: 'Responsable Achats',
  agent_achats: 'Agent Achats',
  responsable_departement: 'Responsable Département',
  employe: 'Employé',
  lecture_seule: 'Lecture seule',
};

export const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Actif',
  inactive: 'Inactif',
  suspended: 'Suspendu',
};

// ==================== MODULE BESOIN ====================

export type BesoinCategory = 'materiel' | 'service' | 'maintenance' | 'urgence' | 'autre';
export type BesoinUrgency = 'normale' | 'urgente' | 'critique';
export type BesoinStatus = 'cree' | 'pris_en_charge' | 'accepte' | 'refuse';

export interface Besoin {
  id: string;
  department_id: string;
  user_id: string;
  title: string;
  description: string;
  category: BesoinCategory;
  urgency: BesoinUrgency;
  desired_date: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  status: BesoinStatus;
  rejection_reason: string | null;
  taken_by: string | null;
  taken_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  // Relations (partial types for joins)
  department?: { id: string; name: string } | null;
  user?: { id: string; first_name: string | null; last_name: string | null; email: string } | null;
  taken_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
  decided_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export const BESOIN_CATEGORY_LABELS: Record<BesoinCategory, string> = {
  materiel: 'Matériel',
  service: 'Service',
  maintenance: 'Maintenance',
  urgence: 'Urgence',
  autre: 'Autre',
};

export const BESOIN_URGENCY_LABELS: Record<BesoinUrgency, string> = {
  normale: 'Normale',
  urgente: 'Urgente',
  critique: 'Critique',
};

export const BESOIN_STATUS_LABELS: Record<BesoinStatus, string> = {
  cree: 'Créé',
  pris_en_charge: 'Pris en charge',
  accepte: 'Accepté',
  refuse: 'Refusé',
};

// Rôles autorisés à créer des besoins
export const ROLES_CAN_CREATE_BESOIN: AppRole[] = [
  'admin',
  'dg',
  'daf',
  'responsable_departement',
  'responsable_logistique',
  'responsable_achats',
];

// ==================== MODULE DEMANDE D'ACHAT (DA) ====================

export type DACategory = 'fournitures' | 'equipement' | 'service' | 'maintenance' | 'informatique' | 'autre';
export type DAPriority = 'basse' | 'normale' | 'haute' | 'urgente';
export type DAStatus = 'brouillon' | 'soumise' | 'en_analyse' | 'chiffree' | 'soumise_validation' | 'validee_finance' | 'refusee_finance' | 'en_revision_achats' | 'rejetee';

export interface DAArticle {
  id: string;
  da_id: string;
  designation: string;
  quantity: number;
  unit: string;
  observations: string | null;
  created_at: string;
  // Prix (optionnel, chargé séparément)
  prices?: DAArticlePrice[];
}

export interface DAArticlePrice {
  id: string;
  da_article_id: string;
  fournisseur_id: string;
  unit_price: number;
  currency: string;
  delivery_delay: string | null;
  conditions: string | null;
  is_selected: boolean;
  created_by: string | null;
  created_at: string;
  fournisseur?: Fournisseur | null;
}

export interface Fournisseur {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DemandeAchat {
  id: string;
  reference: string;
  besoin_id: string;
  department_id: string;
  created_by: string;
  description: string;
  category: DACategory;
  priority: DAPriority;
  desired_date: string | null;
  observations: string | null;
  status: DAStatus;
  rejection_reason: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  submitted_at: string | null;
  // Champs Achats
  selected_fournisseur_id: string | null;
  fournisseur_justification: string | null;
  total_amount: number | null;
  currency: string | null;
  analyzed_by: string | null;
  analyzed_at: string | null;
  priced_by: string | null;
  priced_at: string | null;
  submitted_validation_at: string | null;
  submitted_validation_by: string | null;
  // Champs Validation Financière
  validated_finance_by: string | null;
  validated_finance_at: string | null;
  finance_decision_comment: string | null;
  revision_requested_by: string | null;
  revision_requested_at: string | null;
  revision_comment: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  besoin?: Besoin | null;
  department?: { id: string; name: string } | null;
  created_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
  rejected_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
  selected_fournisseur?: Fournisseur | null;
  analyzed_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
  priced_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
  validated_finance_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
  revision_requested_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
  articles?: DAArticle[];
}

export const DA_CATEGORY_LABELS: Record<DACategory, string> = {
  fournitures: 'Fournitures',
  equipement: 'Équipement',
  service: 'Service',
  maintenance: 'Maintenance',
  informatique: 'Informatique',
  autre: 'Autre',
};

export const DA_PRIORITY_LABELS: Record<DAPriority, string> = {
  basse: 'Basse',
  normale: 'Normale',
  haute: 'Haute',
  urgente: 'Urgente',
};

export const DA_STATUS_LABELS: Record<DAStatus, string> = {
  brouillon: 'Brouillon',
  soumise: 'Soumise aux Achats',
  en_analyse: 'En analyse Achats',
  chiffree: 'Chiffrée',
  soumise_validation: 'En attente validation DAF/DG',
  validee_finance: 'Validée financièrement',
  refusee_finance: 'Refusée (DAF/DG)',
  en_revision_achats: 'En révision Achats',
  rejetee: 'Rejetée',
};

// ==================== MODULE BON DE LIVRAISON (BL) ====================

export type BLStatus = 'prepare' | 'en_attente_validation' | 'valide' | 'livre';

export interface BLArticle {
  id: string;
  bl_id: string;
  designation: string;
  quantity: number;
  unit: string;
  observations: string | null;
  created_at: string;
}

export interface BonLivraison {
  id: string;
  reference: string;
  besoin_id: string;
  department_id: string;
  created_by: string;
  delivery_date: string | null;
  warehouse: string | null;
  observations: string | null;
  status: BLStatus;
  validated_by: string | null;
  validated_at: string | null;
  delivered_by: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  besoin?: Besoin | null;
  department?: { id: string; name: string } | null;
  created_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
  validated_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
  delivered_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
  articles?: BLArticle[];
}

export const BL_STATUS_LABELS: Record<BLStatus, string> = {
  prepare: 'Préparé',
  en_attente_validation: 'En attente de validation',
  valide: 'Validé',
  livre: 'Livré',
};

// Rôles Logistique
export const LOGISTICS_ROLES: AppRole[] = ['responsable_logistique', 'agent_logistique'];

// Rôles Achats
export const ACHATS_ROLES: AppRole[] = ['responsable_achats', 'agent_achats'];
