import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  FileText,
  Send,
  BarChart3,
  Calculator,
  FileCheck,
  ShieldCheck,
  Ban,
  RotateCcw,
  XCircle,
  Banknote,
  BookX,
  User,
  Clock,
  Building2,
  Briefcase,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ROLE_LABELS, AppRole } from '@/types/kpm';

interface ActorProfile {
  first_name?: string | null;
  last_name?: string | null;
}

interface ActorWithDetails {
  profile?: ActorProfile | null;
  roles?: AppRole[];
  department?: string | null;
}

interface TimelineEvent {
  id: string;
  action: string;
  date: string | null;
  actor?: ActorWithDetails;
  description?: string;
  status: 'completed' | 'current' | 'pending';
  icon: React.ElementType;
  color: string;
}

interface DATimelineProps {
  da: {
    created_at: string;
    created_by_profile?: ActorProfile | null;
    created_by_roles?: AppRole[];
    created_by_department?: string | null;
    submitted_at?: string | null;
    analyzed_at?: string | null;
    analyzed_by_profile?: ActorProfile | null;
    analyzed_by_roles?: AppRole[];
    analyzed_by_department?: string | null;
    priced_at?: string | null;
    priced_by_profile?: ActorProfile | null;
    priced_by_roles?: AppRole[];
    priced_by_department?: string | null;
    submitted_validation_at?: string | null;
    submitted_validation_by_profile?: ActorProfile | null;
    submitted_validation_by_roles?: AppRole[];
    submitted_validation_by_department?: string | null;
    validated_finance_at?: string | null;
    validated_finance_by_profile?: ActorProfile | null;
    validated_finance_by_roles?: AppRole[];
    validated_finance_by_department?: string | null;
    comptabilise_at?: string | null;
    comptabilise_by_profile?: ActorProfile | null;
    comptabilise_by_roles?: AppRole[];
    comptabilise_by_department?: string | null;
    rejected_at?: string | null;
    rejected_by_profile?: ActorProfile | null;
    rejected_by_roles?: AppRole[];
    rejected_by_department?: string | null;
    revision_requested_at?: string | null;
    revision_requested_by_profile?: ActorProfile | null;
    revision_requested_by_roles?: AppRole[];
    revision_requested_by_department?: string | null;
    status: string;
    rejection_reason?: string | null;
    revision_comment?: string | null;
    finance_decision_comment?: string | null;
    comptabilite_rejection_reason?: string | null;
  };
}

const formatActorName = (profile?: ActorProfile | null): string => {
  if (!profile) return 'Système';
  const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
  return name || 'Utilisateur';
};

const formatRoles = (roles?: AppRole[]): string => {
  if (!roles || roles.length === 0) return '';
  return roles.map(r => ROLE_LABELS[r] || r).join(', ');
};

export function DATimeline({ da }: DATimelineProps) {
  const events: TimelineEvent[] = [];

  // 1. Création
  events.push({
    id: 'created',
    action: 'Création de la DA',
    date: da.created_at,
    actor: {
      profile: da.created_by_profile,
      roles: da.created_by_roles,
      department: da.created_by_department,
    },
    status: 'completed',
    icon: FileText,
    color: 'text-primary',
  });

  // 2. Soumission aux Achats
  if (da.submitted_at) {
    events.push({
      id: 'submitted',
      action: 'Soumise aux Achats',
      date: da.submitted_at,
      actor: {
        profile: da.created_by_profile,
        roles: da.created_by_roles,
        department: da.created_by_department,
      },
      status: 'completed',
      icon: Send,
      color: 'text-primary',
    });
  }

  // 3. Prise en charge Achats
  if (da.analyzed_at) {
    events.push({
      id: 'analyzed',
      action: 'Prise en charge Achats',
      date: da.analyzed_at,
      actor: {
        profile: da.analyzed_by_profile,
        roles: da.analyzed_by_roles,
        department: da.analyzed_by_department,
      },
      status: 'completed',
      icon: BarChart3,
      color: 'text-warning',
    });
  }

  // 4. Chiffrage
  if (da.priced_at) {
    events.push({
      id: 'priced',
      action: 'Chiffrage effectué',
      date: da.priced_at,
      actor: {
        profile: da.priced_by_profile,
        roles: da.priced_by_roles,
        department: da.priced_by_department,
      },
      status: 'completed',
      icon: Calculator,
      color: 'text-success',
    });
  }

  // 5. Soumission à validation
  if (da.submitted_validation_at) {
    events.push({
      id: 'submitted_validation',
      action: 'Soumise à validation DAF/DG',
      date: da.submitted_validation_at,
      actor: {
        profile: da.submitted_validation_by_profile,
        roles: da.submitted_validation_by_roles,
        department: da.submitted_validation_by_department,
      },
      status: 'completed',
      icon: FileCheck,
      color: 'text-accent',
    });
  }

  // 6a. Demande de révision
  if (da.revision_requested_at && da.status === 'en_revision_achats') {
    events.push({
      id: 'revision',
      action: 'Révision demandée',
      date: da.revision_requested_at,
      actor: {
        profile: da.revision_requested_by_profile,
        roles: da.revision_requested_by_roles,
        department: da.revision_requested_by_department,
      },
      description: da.revision_comment || undefined,
      status: 'current',
      icon: RotateCcw,
      color: 'text-warning',
    });
  }

  // 6b. Validation financière
  if (da.validated_finance_at && ['validee_finance', 'payee', 'rejetee_comptabilite'].includes(da.status)) {
    events.push({
      id: 'validated_finance',
      action: 'Validée financièrement',
      date: da.validated_finance_at,
      actor: {
        profile: da.validated_finance_by_profile,
        roles: da.validated_finance_by_roles,
        department: da.validated_finance_by_department,
      },
      description: da.finance_decision_comment || undefined,
      status: 'completed',
      icon: ShieldCheck,
      color: 'text-success',
    });
  }

  // 6c. Refus financier
  if (da.validated_finance_at && da.status === 'refusee_finance') {
    events.push({
      id: 'refused_finance',
      action: 'Refusée par DAF/DG',
      date: da.validated_finance_at,
      actor: {
        profile: da.validated_finance_by_profile,
        roles: da.validated_finance_by_roles,
        department: da.validated_finance_by_department,
      },
      description: da.finance_decision_comment || undefined,
      status: 'current',
      icon: Ban,
      color: 'text-destructive',
    });
  }

  // 7. Rejet Achats
  if (da.rejected_at && da.status === 'rejetee') {
    events.push({
      id: 'rejected',
      action: 'Rejetée par les Achats',
      date: da.rejected_at,
      actor: {
        profile: da.rejected_by_profile,
        roles: da.rejected_by_roles,
        department: da.rejected_by_department,
      },
      description: da.rejection_reason || undefined,
      status: 'current',
      icon: XCircle,
      color: 'text-destructive',
    });
  }

  // 8. Paiement
  if (da.comptabilise_at && da.status === 'payee') {
    events.push({
      id: 'paid',
      action: 'Paiement enregistré',
      date: da.comptabilise_at,
      actor: {
        profile: da.comptabilise_by_profile,
        roles: da.comptabilise_by_roles,
        department: da.comptabilise_by_department,
      },
      status: 'completed',
      icon: Banknote,
      color: 'text-success',
    });
  }

  // 9. Rejet comptabilité
  if (da.comptabilise_at && da.status === 'rejetee_comptabilite') {
    events.push({
      id: 'rejected_comptabilite',
      action: 'Rejetée par la Comptabilité',
      date: da.comptabilise_at,
      actor: {
        profile: da.comptabilise_by_profile,
        roles: da.comptabilise_by_roles,
        department: da.comptabilise_by_department,
      },
      description: da.comptabilite_rejection_reason || undefined,
      status: 'current',
      icon: BookX,
      color: 'text-destructive',
    });
  }

  // Sort by date
  events.sort((a, b) => {
    if (!a.date || !b.date) return 0;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  if (events.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          Historique des actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 h-full w-0.5 bg-border" />
          
          <div className="space-y-4">
            {events.map((event, index) => {
              const IconComponent = event.icon;
              const isLast = index === events.length - 1;
              const actorName = formatActorName(event.actor?.profile);
              const actorRoles = formatRoles(event.actor?.roles);
              const actorDepartment = event.actor?.department;
              
              return (
                <div key={event.id} className="relative flex gap-4 pl-0">
                  {/* Icon circle */}
                  <div 
                    className={cn(
                      "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-background",
                      event.status === 'completed' && "border-success bg-success/10",
                      event.status === 'current' && event.color.includes('destructive') && "border-destructive bg-destructive/10",
                      event.status === 'current' && event.color.includes('warning') && "border-warning bg-warning/10",
                      event.status === 'pending' && "border-muted bg-muted"
                    )}
                  >
                    <IconComponent className={cn("h-4 w-4", event.color)} />
                  </div>
                  
                  {/* Content */}
                  <div className={cn("flex-1 pb-4", isLast && "pb-0")}>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-medium text-foreground">{event.action}</p>
                      {event.date && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(event.date), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                        </p>
                      )}
                    </div>
                    
                    {/* Actor details with role and department */}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span className="font-medium text-foreground">{actorName}</span>
                      </div>
                      {actorRoles && (
                        <Badge variant="outline" className="h-5 gap-1 text-xs">
                          <Briefcase className="h-3 w-3" />
                          {actorRoles}
                        </Badge>
                      )}
                      {actorDepartment && (
                        <Badge variant="secondary" className="h-5 gap-1 text-xs">
                          <Building2 className="h-3 w-3" />
                          {actorDepartment}
                        </Badge>
                      )}
                    </div>

                    {event.description && (
                      <p className="mt-2 rounded-md bg-muted/50 p-2 text-sm text-muted-foreground italic">
                        "{event.description}"
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
