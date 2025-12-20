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
