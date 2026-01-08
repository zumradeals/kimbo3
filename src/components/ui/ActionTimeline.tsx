import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { UserAvatar } from './UserAvatar';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  XCircle,
  Clock,
  Play,
  FileText,
  CreditCard,
  RotateCcw,
  Lock,
  Unlock,
  Ban,
  Send,
  Eye,
  Edit,
} from 'lucide-react';

export interface TimelineEvent {
  id: string;
  action: string;
  actionLabel: string;
  timestamp: string;
  user?: {
    id?: string;
    photoUrl?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    fonction?: string | null;
    departmentName?: string | null;
  };
  comment?: string | null;
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
}

const actionIcons: Record<string, React.ElementType> = {
  created: FileText,
  submitted: Send,
  taken: Play,
  accepted: CheckCircle,
  rejected: XCircle,
  returned: RotateCcw,
  validated: CheckCircle,
  paid: CreditCard,
  locked: Lock,
  unlocked: Unlock,
  cancelled: Ban,
  viewed: Eye,
  edited: Edit,
  default: Clock,
};

const variantStyles: Record<string, string> = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  info: 'bg-primary/10 text-primary',
};

interface ActionTimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export function ActionTimeline({ events, className }: ActionTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Aucun historique disponible
      </div>
    );
  }

  return (
    <div className={cn('relative space-y-0', className)}>
      {/* Vertical line */}
      <div className="absolute left-5 top-3 bottom-3 w-px bg-border" />
      
      {events.map((event, index) => {
        const Icon = actionIcons[event.action] || actionIcons.default;
        const variant = event.variant || 'default';
        
        return (
          <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Icon circle */}
            <div className={cn(
              'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-background',
              variantStyles[variant]
            )}>
              <Icon className="h-4 w-4" />
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                {/* User info */}
                {event.user && (
                  <div className="flex items-center gap-2">
                    <UserAvatar
                      photoUrl={event.user.photoUrl}
                      firstName={event.user.firstName}
                      lastName={event.user.lastName}
                      size="xs"
                    />
                    <span className="text-sm font-medium text-foreground">
                      {[event.user.firstName, event.user.lastName].filter(Boolean).join(' ') || 'Utilisateur'}
                    </span>
                    {event.user.fonction && (
                      <span className="text-xs text-muted-foreground">
                        • {event.user.fonction}
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              {/* Action label */}
              <p className="text-sm text-foreground mt-1">{event.actionLabel}</p>
              
              {/* Comment */}
              {event.comment && (
                <p className="mt-1 text-sm text-muted-foreground bg-muted/50 rounded px-2 py-1 italic">
                  "{event.comment}"
                </p>
              )}
              
              {/* Timestamp */}
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(event.timestamp), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
