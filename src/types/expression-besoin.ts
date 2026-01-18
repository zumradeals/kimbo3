// ============================================
// Types Expression de Besoin - Machine à états stricte
// ============================================

/**
 * Statuts de l'Expression de Besoin (machine à états)
 * 
 * Flux:
 * BROUILLON -> SOUMIS -> [EN_EXAMEN] -> VALIDE_DEPARTEMENT | REJETE_DEPARTEMENT
 * VALIDE_DEPARTEMENT -> ENVOYE_LOGISTIQUE
 */
export type ExpressionBesoinStatus = 
  | 'brouillon'           // Créé par le membre, modifiable
  | 'soumis'              // Soumis au chef, en attente
  | 'en_examen'           // Pris en charge par le chef (optionnel)
  | 'valide_departement'  // Validé, prêt pour logistique
  | 'rejete_departement'  // Rejeté par le chef
  | 'envoye_logistique';  // Transmis, besoin créé

/**
 * Labels de statut en français
 */
export const EXPRESSION_STATUS_LABELS: Record<ExpressionBesoinStatus, string> = {
  brouillon: 'Brouillon',
  soumis: 'En attente de validation',
  en_examen: 'En cours d\'examen',
  valide_departement: 'Validée par le département',
  rejete_departement: 'Rejetée',
  envoye_logistique: 'Transmise à la logistique',
};

/**
 * Descriptions détaillées des statuts - VERSION PAR RÔLE
 */
export const EXPRESSION_STATUS_DESCRIPTIONS_BY_ROLE: Record<
  ExpressionBesoinStatus, 
  { owner: string; manager: string; viewer: string }
> = {
  brouillon: {
    owner: 'Vous pouvez encore modifier votre expression avant de la soumettre.',
    manager: 'Cette expression est en cours de rédaction par le demandeur.',
    viewer: 'Expression en cours de rédaction.',
  },
  soumis: {
    owner: 'Votre expression est en attente de validation par votre responsable hiérarchique.',
    manager: 'Cette expression attend votre décision. Vous pouvez la valider ou la rejeter.',
    viewer: 'Expression soumise, en attente de validation hiérarchique.',
  },
  en_examen: {
    owner: 'Votre responsable hiérarchique examine actuellement votre expression.',
    manager: 'Vous examinez cette expression. Précisez les quantités et validez, ou rejetez.',
    viewer: 'Expression en cours d\'examen par le responsable.',
  },
  valide_departement: {
    owner: 'Votre expression a été validée. Elle sera bientôt transmise à la logistique.',
    manager: 'Expression validée. Vous pouvez maintenant la transmettre à la logistique.',
    viewer: 'Expression validée par le département, en attente de transmission.',
  },
  rejete_departement: {
    owner: 'Votre expression a été rejetée par votre responsable. Consultez le motif ci-dessous.',
    manager: 'Vous avez rejeté cette expression.',
    viewer: 'Expression rejetée par le responsable hiérarchique.',
  },
  envoye_logistique: {
    owner: 'Votre expression a été transmise à la logistique. Un besoin interne a été créé.',
    manager: 'Expression transmise à la logistique. Le processus suit son cours.',
    viewer: 'Expression transmise, besoin interne créé.',
  },
};

/**
 * Couleurs des badges de statut (classes Tailwind)
 */
export const EXPRESSION_STATUS_COLORS: Record<ExpressionBesoinStatus, string> = {
  brouillon: 'bg-muted text-muted-foreground',
  soumis: 'bg-warning/10 text-warning',
  en_examen: 'bg-primary/10 text-primary',
  valide_departement: 'bg-success/10 text-success',
  rejete_departement: 'bg-destructive/10 text-destructive',
  envoye_logistique: 'bg-success/10 text-success',
};

/**
 * Icône associée à chaque statut (nom Lucide)
 */
export const EXPRESSION_STATUS_ICONS = {
  brouillon: 'FileEdit',
  soumis: 'Clock',
  en_examen: 'Eye',
  valide_departement: 'CheckCircle',
  rejete_departement: 'XCircle',
  envoye_logistique: 'Send',
} as const;

/**
 * Rôle de l'utilisateur dans le contexte d'une expression
 */
export type ExpressionUserRole = 
  | 'owner'       // Propriétaire de l'expression
  | 'manager'     // Chef hiérarchique / validateur
  | 'viewer';     // Observateur (admin, DG, DAF)

/**
 * Actions possibles sur une expression selon le rôle et le statut
 */
export interface ExpressionActions {
  canEdit: boolean;
  canSubmit: boolean;
  canValidate: boolean;
  canReject: boolean;
  canSendToLogistics: boolean;
  canDelete: boolean;
}

/**
 * Retourne les actions disponibles selon le rôle et le statut
 */
export function getExpressionActions(
  status: ExpressionBesoinStatus,
  role: ExpressionUserRole
): ExpressionActions {
  const actions: ExpressionActions = {
    canEdit: false,
    canSubmit: false,
    canValidate: false,
    canReject: false,
    canSendToLogistics: false,
    canDelete: false,
  };

  // Propriétaire
  if (role === 'owner') {
    if (status === 'brouillon') {
      actions.canEdit = true;
      actions.canSubmit = true;
      actions.canDelete = true;
    }
    // Aucune autre action pour le propriétaire après soumission
  }

  // Chef / Manager
  if (role === 'manager') {
    if (status === 'soumis' || status === 'en_examen') {
      actions.canValidate = true;
      actions.canReject = true;
    }
    if (status === 'valide_departement') {
      actions.canSendToLogistics = true;
    }
  }

  // Viewer (admin) peut toujours supprimer
  if (role === 'viewer') {
    actions.canDelete = true;
  }

  return actions;
}

/**
 * Vérifie si un statut est terminal (aucune action possible)
 */
export function isTerminalStatus(status: ExpressionBesoinStatus): boolean {
  return status === 'rejete_departement' || status === 'envoye_logistique';
}

/**
 * Vérifie si le statut indique une expression active
 */
export function isActiveStatus(status: ExpressionBesoinStatus): boolean {
  return !isTerminalStatus(status);
}

/**
 * Profil public enrichi (retour de get_public_profiles RPC)
 */
export interface PublicProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  department_name: string | null;
  fonction: string | null;
  photo_url: string | null;
  email: string | null;
}

/**
 * Interface Expression de Besoin complète
 */
export interface ExpressionBesoin {
  id: string;
  user_id: string;
  department_id: string;
  nom_article: string;
  commentaire: string | null;
  quantite: number | null;
  unite: string | null;
  precision_technique: string | null;
  status: ExpressionBesoinStatus;
  chef_validateur_id: string | null;
  besoin_id: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  validated_at: string | null;
  rejected_at: string | null;
  reviewed_at: string | null;
  sent_to_logistics_at: string | null;
  
  // Relations jointes
  user?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    photo_url: string | null;
    fonction: string | null;
    chef_hierarchique_id: string | null;
    department?: {
      name: string;
    };
  };
  department?: {
    id: string;
    name: string;
  };
  chef_validateur?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    photo_url: string | null;
    fonction: string | null;
  };
  besoin?: {
    id: string;
    title: string;
    status: string;
  };
}

/**
 * Helper pour formater le nom complet
 */
export function formatFullName(firstName?: string | null, lastName?: string | null): string {
  const name = [firstName, lastName].filter(Boolean).join(' ');
  return name || '—';
}
