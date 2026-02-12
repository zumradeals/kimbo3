import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ShieldCheck, Clock, CheckCircle, XCircle, ArrowUpRight, 
  BarChart3, FileText, Send
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DA_STATUS_LABELS } from '@/types/kpm';

interface AALStats {
  daChiffrees: number;
  daValidees: number;
  daRejetees: number;
  daTransmises: number;
  recentDA: Array<{
    id: string;
    reference: string;
    description: string;
    total_amount: number | null;
    status: string;
    created_at: string;
    department?: { name: string } | null;
  }>;
}

export function AALDashboard() {
  const [stats, setStats] = useState<AALStats>({
    daChiffrees: 0,
    daValidees: 0,
    daRejetees: 0,
    daTransmises: 0,
    recentDA: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAALStats = async () => {
      try {
        const [chiffrees, validees, rejetees, transmises, recent] = await Promise.all([
          supabase.from('demandes_achat').select('*', { count: 'exact', head: true }).eq('status', 'chiffree'),
          supabase.from('demandes_achat').select('*', { count: 'exact', head: true }).eq('status', 'validee_aal'),
          supabase.from('demandes_achat').select('*', { count: 'exact', head: true }).eq('status', 'rejetee_aal'),
          supabase.from('demandes_achat').select('*', { count: 'exact', head: true }).eq('status', 'soumise_validation'),
          supabase.from('demandes_achat')
            .select('id, reference, description, total_amount, status, created_at, department:departments(name)')
            .in('status', ['chiffree', 'validee_aal', 'rejetee_aal', 'soumise_validation'])
            .order('created_at', { ascending: false })
            .limit(10),
        ]);

        setStats({
          daChiffrees: chiffrees.count || 0,
          daValidees: validees.count || 0,
          daRejetees: rejetees.count || 0,
          daTransmises: transmises.count || 0,
          recentDA: (recent.data as any[]) || [],
        });
      } catch (error) {
        console.error('Error fetching AAL stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAALStats();
  }, []);

  const formatMontant = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.ceil(value)) + ' XOF';
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><div className="h-20 bg-muted animate-pulse rounded" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Tableau de bord AAL
          </h2>
          <p className="text-sm text-muted-foreground">
            Validation des demandes d'achat chiffrées
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/demandes-achat?status=chiffree">
            DA à valider
            <ArrowUpRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-warning bg-warning/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">À valider</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.daChiffrees}</div>
            <p className="text-xs text-muted-foreground">DA chiffrées en attente</p>
            {stats.daChiffrees > 0 && (
              <Button asChild variant="link" className="mt-2 h-auto p-0 text-xs text-warning">
                <Link to="/demandes-achat?status=chiffree">Traiter maintenant →</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-success">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Validées AAL</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.daValidees}</div>
            <p className="text-xs text-muted-foreground">En attente de transmission</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transmises DAF</CardTitle>
            <Send className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.daTransmises}</div>
            <p className="text-xs text-muted-foreground">En validation DAF/DG</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejetées</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.daRejetees}</div>
            <p className="text-xs text-muted-foreground">Renvoyées aux Achats</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent DA Table */}
      {stats.recentDA.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Dernières DA concernées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.recentDA.map((da) => (
                <Link
                  key={da.id}
                  to={`/demandes-achat/${da.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{da.reference}</span>
                      <Badge variant="outline" className="text-xs">
                        {DA_STATUS_LABELS[da.status as keyof typeof DA_STATUS_LABELS] || da.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {da.description}
                    </p>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    {da.total_amount && (
                      <p className="font-semibold text-sm">{formatMontant(da.total_amount)}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(da.created_at), 'dd MMM', { locale: fr })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
