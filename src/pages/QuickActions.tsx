import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquarePlus,
  ClipboardList,
  FileText,
  CheckCircle2,
  Clock,
  ArrowRight,
  Zap,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function QuickActions() {
  const { user, profile, roles, isAdmin } = useAuth();

  // Determine if user has specific roles using hasRole pattern
  const isResponsableDepartement = roles.includes('responsable_departement');
  const isResponsableLogistique = roles.includes('responsable_logistique');
  const isAgentLogistique = roles.includes('agent_logistique');
  const isResponsableAchats = roles.includes('responsable_achats');
  const isAgentAchats = roles.includes('agent_achats');
  
  const isLogistique = isResponsableLogistique || isAgentLogistique;
  const isAchat = isResponsableAchats || isAgentAchats;

  // Fetch pending validations count for managers
  const { data: pendingValidations } = useQuery({
    queryKey: ['quick-actions-pending', user?.id],
    queryFn: async () => {
      if (!user?.id) return { expressions: 0, besoins: 0, da: 0 };
      
      const counts = { expressions: 0, besoins: 0, da: 0 };

      // Expressions pending validation (for managers)
      if (isResponsableDepartement || isAdmin) {
        const { count: expCount } = await supabase
          .from('expressions_besoin')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'soumise' as any);
        counts.expressions = expCount || 0;
      }

      // Besoins pending (for logistique)
      if (isLogistique || isAdmin) {
        const { count: besoinCount } = await supabase
          .from('besoins')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'soumis' as any);
        counts.besoins = besoinCount || 0;
      }

      // DA pending analysis (for achats)
      if (isAchat || isAdmin) {
        const { count: daCount } = await supabase
          .from('demandes_achat')
          .select('*', { count: 'exact', head: true })
          .in('status', ['brouillon', 'soumise'] as any);
        counts.da = daCount || 0;
      }

      return counts;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Fetch user's own recent items
  const { data: myItems } = useQuery({
    queryKey: ['quick-actions-my-items', user?.id],
    queryFn: async () => {
      if (!user?.id) return { expressions: 0, besoins: 0 };

      const [expResult, besoinResult] = await Promise.all([
        supabase
          .from('expressions_besoin')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('besoins')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ]);

      return {
        expressions: expResult.count || 0,
        besoins: besoinResult.count || 0,
      };
    },
    enabled: !!user?.id,
  });

  const totalPending = (pendingValidations?.expressions || 0) + 
                       (pendingValidations?.besoins || 0) + 
                       (pendingValidations?.da || 0);

  return (
    <AppLayout>
      <div className="space-y-6 pb-20">
        {/* Header - Compact for mobile */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-bold text-foreground sm:text-2xl">
              Actions rapides
            </h1>
            <p className="text-sm text-muted-foreground">
              Accès direct mobile
            </p>
          </div>
        </div>

        {/* User info - minimal */}
        <Card className="border-muted bg-muted/30">
          <CardContent className="flex items-center gap-3 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {profile?.first_name} {profile?.last_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {profile?.department?.name || 'Département non assigné'}
              </p>
            </div>
            {totalPending > 0 && (
              <Badge variant="destructive" className="shrink-0">
                {totalPending} en attente
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Quick Create Actions */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Créer
          </h2>
          <div className="grid gap-3">
            {/* New Expression - available to all */}
            <Link to="/expressions-besoin/nouveau" className="block">
              <Card className="transition-all hover:border-primary hover:shadow-md active:scale-[0.98]">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                    <MessageSquarePlus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">
                      Expression de besoin
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Demande simple sans engagement
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>

            {/* New Besoin - for managers/logistique */}
            {(isResponsableDepartement || isLogistique || isAdmin) && (
              <Link to="/besoins/nouveau" className="block">
                <Card className="transition-all hover:border-primary hover:shadow-md active:scale-[0.98]">
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
                      <ClipboardList className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">
                        Besoin interne
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Besoin formel détaillé
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            )}
          </div>
        </div>

        {/* My Items Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Mes demandes
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link to="/expressions-besoin" className="block">
              <Card className="transition-all hover:border-primary active:scale-[0.98]">
                <CardContent className="flex items-center gap-3 py-3">
                  <MessageSquarePlus className="h-5 w-5 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-sm font-medium">Mes expressions</span>
                  <Badge variant="secondary">{myItems?.expressions || 0}</Badge>
                </CardContent>
              </Card>
            </Link>
            <Link to="/besoins" className="block">
              <Card className="transition-all hover:border-primary active:scale-[0.98]">
                <CardContent className="flex items-center gap-3 py-3">
                  <ClipboardList className="h-5 w-5 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-sm font-medium">Mes besoins</span>
                  <Badge variant="secondary">{myItems?.besoins || 0}</Badge>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Validations Section - Only for managers/specific roles */}
        {(isResponsableDepartement || isLogistique || isAchat || isAdmin) && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
              À valider / traiter
            </h2>
            <div className="grid gap-3">
              {/* Expressions to validate */}
              {(isResponsableDepartement || isAdmin) && (
                <Link 
                  to="/expressions-besoin" 
                  className="block"
                >
                  <Card className={cn(
                    "transition-all hover:border-primary active:scale-[0.98]",
                    (pendingValidations?.expressions || 0) > 0 && "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20"
                  )}>
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                        <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">
                          Expressions à valider
                        </p>
                        <p className="text-sm text-muted-foreground">
                          En attente de votre décision
                        </p>
                      </div>
                      {(pendingValidations?.expressions || 0) > 0 ? (
                        <Badge variant="destructive">{pendingValidations?.expressions}</Badge>
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )}

              {/* Besoins to process */}
              {(isLogistique || isAdmin) && (
                <Link 
                  to="/besoins" 
                  className="block"
                >
                  <Card className={cn(
                    "transition-all hover:border-primary active:scale-[0.98]",
                    (pendingValidations?.besoins || 0) > 0 && "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20"
                  )}>
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                        <ClipboardList className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">
                          Besoins à traiter
                        </p>
                        <p className="text-sm text-muted-foreground">
                          En attente de prise en charge
                        </p>
                      </div>
                      {(pendingValidations?.besoins || 0) > 0 ? (
                        <Badge variant="destructive">{pendingValidations?.besoins}</Badge>
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )}

              {/* DA to analyze */}
              {(isAchat || isAdmin) && (
                <Link 
                  to="/demandes-achat" 
                  className="block"
                >
                  <Card className={cn(
                    "transition-all hover:border-primary active:scale-[0.98]",
                    (pendingValidations?.da || 0) > 0 && "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20"
                  )}>
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                        <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">
                          DA à analyser
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Demandes en attente de prix
                        </p>
                      </div>
                      {(pendingValidations?.da || 0) > 0 ? (
                        <Badge variant="destructive">{pendingValidations?.da}</Badge>
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Quick links to other modules */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Navigation rapide
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link to="/dashboard">
              <Button variant="outline" size="sm">Tableau de bord</Button>
            </Link>
            <Link to="/notifications">
              <Button variant="outline" size="sm">Notifications</Button>
            </Link>
            <Link to="/demandes-achat">
              <Button variant="outline" size="sm">Demandes d'achat</Button>
            </Link>
            <Link to="/profile">
              <Button variant="outline" size="sm">Mon profil</Button>
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
