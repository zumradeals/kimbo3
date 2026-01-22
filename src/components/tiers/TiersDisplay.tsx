import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Building2 } from 'lucide-react';
import { Tiers, TIERS_TYPE_LABELS, TIERS_TYPE_COLORS } from '@/types/tiers';

interface TiersDisplayProps {
  tiers: Tiers | null;
  label?: string;
  compact?: boolean;
}

export function TiersDisplay({ tiers, label = 'Tiers', compact = false }: TiersDisplayProps) {
  if (!tiers) {
    return (
      <div className="text-muted-foreground text-sm">
        Aucun tiers associé
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{tiers.nom}</span>
        <Badge className={TIERS_TYPE_COLORS[tiers.type]}>
          {TIERS_TYPE_LABELS[tiers.type]}
        </Badge>
      </div>
    );
  }

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {label}
            </div>
            <div className="font-semibold text-lg">{tiers.nom}</div>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={TIERS_TYPE_COLORS[tiers.type]}>
                {TIERS_TYPE_LABELS[tiers.type]}
              </Badge>
              {tiers.numero_contribuable && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {tiers.numero_contribuable}
                </span>
              )}
            </div>
            {(tiers.telephone || tiers.email || tiers.adresse) && (
              <div className="text-sm text-muted-foreground mt-2 space-y-0.5">
                {tiers.telephone && <div>📞 {tiers.telephone}</div>}
                {tiers.email && <div>✉️ {tiers.email}</div>}
                {tiers.adresse && <div>📍 {tiers.adresse}</div>}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
