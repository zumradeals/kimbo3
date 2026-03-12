import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle, ArrowRight, FileText, ShoppingCart,
  CreditCard, CheckCircle, Truck, ClipboardCheck, X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PendingAction {
  id: string;
  label: string;
  count: number;
  icon: React.ReactNode;
  link: string;
  color: string;
  description: string;
}

export function PendingActionsAlert() {
  const { user, hasAnyRole, isAdmin } = useAuth();
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPendingActions = async () => {
    if (!user) return;

    const pendingActions: PendingAction[] = [];

    try {
      // AAL: DA chiffrées à valider
      if (hasAnyRole(['aal']) || isAdmin) {
        const { count } = await supabase
          .from('demandes_achat')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'chiffree');
        if (count && count > 0) {
          pendingActions.push({
            id: 'aal-chiffree',
            label: 'DA à valider (AAL)',
            count,
            icon: <ClipboardCheck className="h-5 w-5" />,
            link: '/demandes-achat?status=chiffree',
            color: 'bg-warning/15 border-warning/30 text-warning',
            description: 'Demandes d\'achat chiffrées en attente de votre validation',
          });
        }

        // AAL: DA retour_aal
        const { count: retourCount } = await supabase
          .from('demandes_achat')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'retour_aal');
        if (retourCount && retourCount > 0) {
          pendingActions.push({
            id: 'aal-retour',
            label: 'DA retournées par Finance',
            count: retourCount,
            icon: <AlertTriangle className="h-5 w-5" />,
            link: '/demandes-achat?status=retour_aal',
            color: 'bg-destructive/15 border-destructive/30 text-destructive',
            description: 'DA refusées par la Finance nécessitant votre action',
          });
        }
      }

      // DAF: DA soumise_validation
      if (hasAnyRole(['daf']) || isAdmin) {
        const { count } = await supabase
          .from('demandes_achat')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'soumise_validation');
        if (count && count > 0) {
          pendingActions.push({
            id: 'daf-validation',
            label: 'DA à valider (Finance)',
            count,
            icon: <CreditCard className="h-5 w-5" />,
            link: '/demandes-achat?status=soumise_validation',
            color: 'bg-primary/15 border-primary/30 text-primary',
            description: 'Demandes d\'achat en attente de validation financière',
          });
        }
      }

      // DG: DA en_attente_dg
      if (hasAnyRole(['dg']) || isAdmin) {
        const { count } = await supabase
          .from('demandes_achat')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'en_attente_dg');
        if (count && count > 0) {
          pendingActions.push({
            id: 'dg-validation',
            label: 'DA à approuver (DG)',
            count,
            icon: <CheckCircle className="h-5 w-5" />,
            link: '/demandes-achat?status=en_attente_dg',
            color: 'bg-destructive/15 border-destructive/30 text-destructive',
            description: 'Demandes d\'achat à montant élevé nécessitant votre approbation',
          });
        }

        // DG: BL en attente validation
        const { count: blCount } = await supabase
          .from('bons_livraison')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'en_attente_validation');
        if (blCount && blCount > 0) {
          pendingActions.push({
            id: 'dg-bl',
            label: 'BL à valider',
            count: blCount,
            icon: <Truck className="h-5 w-5" />,
            link: '/bons-livraison?status=en_attente_validation',
            color: 'bg-warning/15 border-warning/30 text-warning',
            description: 'Bons de livraison en attente de validation',
          });
        }
      }

      // Comptable: DA validee_finance à comptabiliser
      if (hasAnyRole(['comptable']) || isAdmin) {
        const { count } = await supabase
          .from('demandes_achat')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'validee_finance');
        if (count && count > 0) {
          pendingActions.push({
            id: 'comptable-paiement',
            label: 'DA à comptabiliser',
            count,
            icon: <CreditCard className="h-5 w-5" />,
            link: '/demandes-achat?status=validee_finance',
            color: 'bg-success/15 border-success/30 text-success',
            description: 'Demandes d\'achat validées en attente de comptabilisation',
          });
        }
      }

      // Achats/Logistique: DA soumise à traiter
      if (hasAnyRole(['responsable_achats', 'agent_achats', 'responsable_logistique', 'agent_logistique']) || isAdmin) {
        const { count } = await supabase
          .from('demandes_achat')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'soumise');
        if (count && count > 0) {
          pendingActions.push({
            id: 'achats-soumise',
            label: 'DA à traiter',
            count,
            icon: <ShoppingCart className="h-5 w-5" />,
            link: '/demandes-achat?status=soumise',
            color: 'bg-primary/15 border-primary/30 text-primary',
            description: 'Nouvelles demandes d\'achat soumises',
          });
        }

        // DA en révision
        const { count: revCount } = await supabase
          .from('demandes_achat')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'en_revision_achats');
        if (revCount && revCount > 0) {
          pendingActions.push({
            id: 'achats-revision',
            label: 'DA en révision',
            count: revCount,
            icon: <AlertTriangle className="h-5 w-5" />,
            link: '/demandes-achat?status=en_revision_achats',
            color: 'bg-warning/15 border-warning/30 text-warning',
            description: 'DA retournées pour révision du chiffrage',
          });
        }

        // Besoins à traiter
        const { count: besoinCount } = await supabase
          .from('besoins')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'cree');
        if (besoinCount && besoinCount > 0) {
          pendingActions.push({
            id: 'logistique-besoins',
            label: 'Besoins à traiter',
            count: besoinCount,
            icon: <FileText className="h-5 w-5" />,
            link: '/besoins?status=cree',
            color: 'bg-primary/15 border-primary/30 text-primary',
            description: 'Nouveaux besoins internes à prendre en charge',
          });
        }
      }

      // Manager: Expressions à valider (RLS filters automatically by manager access)
      const { count: exprCount } = await supabase
        .from('expressions_besoin')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'soumis');
      if (exprCount && exprCount > 0) {
        pendingActions.push({
          id: 'manager-expressions',
          label: 'Expressions à valider',
          count: exprCount,
          icon: <FileText className="h-5 w-5" />,
          link: '/expressions-besoin?status=soumis',
          color: 'bg-primary/15 border-primary/30 text-primary',
          description: 'Expressions de besoin en attente de votre validation',
        });
      }
    } catch (error) {
      console.error('Error fetching pending actions:', error);
    }

    setActions(pendingActions);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPendingActions();

    // Refresh every 30 seconds
    const interval = setInterval(fetchPendingActions, 30000);

    // Realtime: refresh on DA/BL/besoin changes
    if (!user) return;
    const channel = supabase
      .channel('pending-actions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'demandes_achat' }, () => fetchPendingActions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bons_livraison' }, () => fetchPendingActions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'besoins' }, () => fetchPendingActions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expressions_besoin' }, () => fetchPendingActions())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (isLoading || actions.length === 0 || dismissed) return null;

  const totalPending = actions.reduce((sum, a) => sum + a.count, 0);

  return (
    <div className="space-y-4">
      {/* Top Alert Banner */}
      <div className="relative overflow-hidden rounded-lg border-2 border-warning/40 bg-warning/10 p-4">
        <div className="absolute left-0 top-0 h-full w-1.5 bg-warning" />
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 pl-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/20">
              <AlertTriangle className="h-5 w-5 text-warning animate-pulse" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                {totalPending} action{totalPending > 1 ? 's' : ''} en attente
              </h3>
              <p className="text-sm text-muted-foreground">
                Vous avez des éléments nécessitant votre intervention immédiate
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-warning/50 bg-warning/20 text-warning font-bold text-lg px-3 py-1">
              {totalPending}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <Link key={action.id} to={action.link}>
            <Card className={cn(
              'group cursor-pointer border-2 transition-all hover:shadow-md hover:scale-[1.02]',
              action.color.replace('text-', 'hover:border-')
            )}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border',
                  action.color
                )}>
                  {action.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm truncate">{action.label}</h4>
                    <Badge variant="secondary" className="shrink-0 font-bold">
                      {action.count}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {action.description}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
