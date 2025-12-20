import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROLE_LABELS } from '@/types/kpm';
import { Users, Building2, FileText, AlertCircle } from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  totalDepartments: number;
  activeDepartments: number;
}

export default function Dashboard() {
  const { profile, roles, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalDepartments: 0,
    activeDepartments: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch departments count (visible par tous)
        const { count: deptCount } = await supabase
          .from('departments')
          .select('*', { count: 'exact', head: true });

        const { count: activeDeptCount } = await supabase
          .from('departments')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        // Fetch users count (only for admin)
        let userCount = 0;
        if (isAdmin) {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });
          userCount = count || 0;
        }

        setStats({
          totalUsers: userCount,
          totalDepartments: deptCount || 0,
          activeDepartments: activeDeptCount || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [isAdmin]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">
            Tableau de bord
          </h1>
          <p className="text-muted-foreground">
            Bienvenue, {profile?.first_name || 'Utilisateur'}
          </p>
        </div>

        {/* User info card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Votre profil</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Nom complet</p>
                <p className="font-medium">
                  {profile?.first_name} {profile?.last_name}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{profile?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rôle(s)</p>
                <div className="flex flex-wrap gap-1">
                  {roles.map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                    >
                      {ROLE_LABELS[role]}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Département</p>
                <p className="font-medium">
                  {profile?.department?.name || 'Non assigné'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats cards (Admin only) */}
        {isAdmin && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? '...' : stats.totalUsers}
                </div>
                <p className="text-xs text-muted-foreground">
                  Comptes enregistrés
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Départements</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? '...' : stats.activeDepartments}
                </div>
                <p className="text-xs text-muted-foreground">
                  sur {stats.totalDepartments} total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Modules</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">
                  Aucun module métier activé
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Info message */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-foreground">
                Système en cours de déploiement
              </p>
              <p className="text-sm text-muted-foreground">
                Les modules métier (Besoins, DA, Stock, Comptabilité) seront activés
                progressivement après la stabilisation du système RBAC.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
