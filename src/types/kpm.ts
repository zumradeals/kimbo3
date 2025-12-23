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

export type BesoinType = 'article' | 'service';

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
  // Nouveaux champs enrichis (sans données financières)
  estimated_quantity: number | null;
  besoin_type: BesoinType;
  unit: string;
  technical_specs: string | null;
  intended_usage: string | null;
  created_at: string;
  updated_at: string;
  // Relations (partial types for joins)
  department?: { id: string; name: string } | null;
  user?: { id: string; first_name: string | null; last_name: string | null; email: string } | null;
  taken_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
  decided_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
}

export const BESOIN_TYPE_LABELS: Record<BesoinType, string> = {
  article: 'Article',
  service: 'Service',
};

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
export type DAStatus = 'brouillon' | 'soumise' | 'en_analyse' | 'chiffree' | 'soumise_validation' | 'validee_finance' | 'refusee_finance' | 'en_revision_achats' | 'rejetee' | 'payee' | 'rejetee_comptabilite';

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
  // Pièces jointes (ajoutées par Achats)
  attachment_url: string | null;
  attachment_name: string | null;
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
  // Champs Comptabilité
  comptabilise_by: string | null;
  comptabilise_at: string | null;
  syscohada_classe: number | null;
  syscohada_compte: string | null;
  syscohada_nature_charge: string | null;
  syscohada_centre_cout: string | null;
  mode_paiement: string | null;
  reference_paiement: string | null;
  comptabilite_rejection_reason: string | null;
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
  comptabilise_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
  submitted_validation_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
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
  payee: 'Payée',
  rejetee_comptabilite: 'Rejetée (Comptabilité)',
};

// Écriture comptable SYSCOHADA
export interface EcritureComptable {
  id: string;
  da_id: string;
  reference: string;
  date_ecriture: string;
  classe_syscohada: number;
  compte_comptable: string;
  nature_charge: string;
  centre_cout: string | null;
  libelle: string;
  debit: number;
  credit: number;
  devise: string;
  mode_paiement: string | null;
  reference_paiement: string | null;
  observations: string | null;
  created_by: string | null;
  created_at: string;
  is_validated: boolean;
  validated_by: string | null;
  validated_at: string | null;
}

// Classes SYSCOHADA
export const SYSCOHADA_CLASSES: Record<number, string> = {
  1: 'Comptes de ressources durables',
  2: 'Comptes d\'actif immobilisé',
  3: 'Comptes de stocks',
  4: 'Comptes de tiers',
  5: 'Comptes de trésorerie',
  6: 'Comptes de charges',
  7: 'Comptes de produits',
};

// Modes de paiement
export const MODES_PAIEMENT = [
  'Virement bancaire',
  'Chèque',
  'Espèces',
  'Mobile Money',
  'Traite',
  'Lettre de crédit',
];

// ==================== MODULE BON DE LIVRAISON (BL) ====================

export type BLStatus = 'prepare' | 'en_attente_validation' | 'valide' | 'livre' | 'livree_partiellement' | 'refusee';
export type BLType = 'fournisseur' | 'interne';

export interface BLArticle {
  id: string;
  bl_id: string;
  designation: string;
  quantity: number;
  quantity_ordered: number | null;
  quantity_delivered: number | null;
  unit: string;
  observations: string | null;
  ecart_reason: string | null;
  article_stock_id: string | null;
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
  bl_type: BLType;
  validated_by: string | null;
  validated_at: string | null;
  delivered_by: string | null;
  delivered_at: string | null;
  rejection_reason: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  besoin?: Besoin | null;
  department?: { id: string; name: string } | null;
  created_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
  validated_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
  delivered_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
  rejected_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
  articles?: BLArticle[];
}

export const BL_STATUS_LABELS: Record<BLStatus, string> = {
  prepare: 'Préparé',
  en_attente_validation: 'En attente de validation',
  valide: 'Validé',
  livre: 'Livré',
  livree_partiellement: 'Livré partiellement',
  refusee: 'Refusé',
};

export const BL_TYPE_LABELS: Record<BLType, string> = {
  fournisseur: 'Fournisseur',
  interne: 'Interne (stock)',
};

// Rôles Logistique
export const LOGISTICS_ROLES: AppRole[] = ['responsable_logistique', 'agent_logistique'];

// Rôles Achats
export const ACHATS_ROLES: AppRole[] = ['responsable_achats', 'agent_achats'];

// ==================== MODULE STOCK ====================

export type StockMovementType = 'entree' | 'sortie' | 'ajustement' | 'reservation' | 'liberation';
export type StockStatus = 'disponible' | 'reserve' | 'epuise';

export interface ArticleStock {
  id: string;
  designation: string;
  description: string | null;
  unit: string;
  quantity_available: number;
  quantity_reserved: number;
  quantity_min: number | null;
  status: StockStatus;
  location: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  created_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
}

export interface StockMovement {
  id: string;
  article_stock_id: string;
  movement_type: StockMovementType;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  bl_id: string | null;
  da_id: string | null;
  reference: string | null;
  observations: string | null;
  created_by: string;
  created_at: string;
  // Relations
  article_stock?: ArticleStock | null;
  bon_livraison?: BonLivraison | null;
  demande_achat?: DemandeAchat | null;
  created_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
}

export const STOCK_MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  entree: 'Entrée',
  sortie: 'Sortie',
  ajustement: 'Ajustement',
  reservation: 'Réservation',
  liberation: 'Libération',
};

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  disponible: 'Disponible',
  reserve: 'Réservé',
  epuise: 'Épuisé',
};
