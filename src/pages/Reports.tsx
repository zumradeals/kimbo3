import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart3,
  TrendingUp,
  Package,
  FileText,
  Wallet,
  AlertTriangle,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  Users,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DA_STATUS_LABELS, SYSCOHADA_CLASSES } from '@/types/kpm';

interface Stats {
  besoins: { total: number; byStatus: Record<string, number>; byDepartment: { name: string; count: number }[] };
  da: { total: number; byStatus: Record<string, number>; totalAmount: number; avgProcessingDays: number };
  bl: { total: number; delivered: number; partial: number; pending: number };
  stock: { total: number; lowStock: number; outOfStock: number };
  finance: { byClass: { class: number; amount: number }[]; pendingPayments: number; totalPaid: number };
  anomalies: { longPending: number; frequentRejections: number; stockDiscrepancies: number };
}

export default function Reports() {
  const { roles, isAdmin } = useAuth();
  const { toast } = useToast();

  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recentDA, setRecentDA] = useState<any[]>([]);
  const [topArticles, setTopArticles] = useState<{ designation: string; count: number }[]>([]);

  const hasAccess = isAdmin || roles.some(r => ['dg', 'daf'].includes(r));
  const isFinance = roles.some(r => ['daf', 'comptable'].includes(r)) || isAdmin;
  const isLogistics = roles.some(r => ['responsable_logistique', 'agent_logistique'].includes(r));

  useEffect(() => {
    if (hasAccess) {
      fetchStats();
    }
  }, [hasAccess]);

  const fetchStats = async () => {
    try {
      // Besoins stats
      const { data: besoins } = await supabase.from('besoins').select('id, status, department_id');
      const { data: departments } = await supabase.from('departments').select('id, name');

      const besoinsByStatus: Record<string, number> = {};
      const besoinsByDept: Record<string, number> = {};
      (besoins || []).forEach(b => {
        besoinsByStatus[b.status] = (besoinsByStatus[b.status] || 0) + 1;
        besoinsByDept[b.department_id] = (besoinsByDept[b.department_id] || 0) + 1;
      });

      const deptMap = Object.fromEntries((departments || []).map(d => [d.id, d.name]));
      const besoinsByDepartment = Object.entries(besoinsByDept).map(([id, count]) => ({
        name: deptMap[id] || 'Inconnu',
        count,
      })).sort((a, b) => b.count - a.count);

      // DA stats
      const { data: das } = await supabase.from('demandes_achat').select('id, status, total_amount, created_at, submitted_at');
      const daByStatus: Record<string, number> = {};
      let totalAmount = 0;
      let processingDays = 0;
      let processedCount = 0;

      (das || []).forEach(da => {
        daByStatus[da.status] = (daByStatus[da.status] || 0) + 1;
        if (da.total_amount) totalAmount += da.total_amount;
        if (da.submitted_at && da.created_at) {
          const days = Math.floor((new Date(da.submitted_at).getTime() - new Date(da.created_at).getTime()) / (1000 * 60 * 60 * 24));
          if (days >= 0) {
            processingDays += days;
            processedCount++;
          }
        }
      });

      // BL stats
      const { data: bls } = await supabase.from('bons_livraison').select('id, status');
      const blStats = {
        total: (bls || []).length,
        delivered: (bls || []).filter(b => b.status === 'livre').length,
        partial: (bls || []).filter(b => b.status === 'livree_partiellement').length,
        pending: (bls || []).filter(b => ['prepare', 'en_attente_validation', 'valide'].includes(b.status)).length,
      };

      // Stock stats
      const { data: stock } = await supabase.from('articles_stock').select('id, status, quantity_available, quantity_min');
      const stockStats = {
        total: (stock || []).length,
        lowStock: (stock || []).filter(s => s.quantity_min && s.quantity_available <= s.quantity_min && s.quantity_available > 0).length,
        outOfStock: (stock || []).filter(s => s.quantity_available <= 0).length,
      };

      // Finance stats
      const { data: ecritures } = await supabase.from('ecritures_comptables').select('classe_syscohada, debit, credit, is_validated');
      const byClass: Record<number, number> = {};
      let totalPaid = 0;

      (ecritures || []).forEach(e => {
        const amount = e.debit || e.credit || 0;
        byClass[e.classe_syscohada] = (byClass[e.classe_syscohada] || 0) + amount;
        if (e.is_validated) totalPaid += amount;
      });

      const pendingPayments = (das || []).filter(d => d.status === 'validee_finance').reduce((sum, d) => sum + (d.total_amount || 0), 0);

      // Anomalies
      const thirtyDaysAgo = subDays(new Date(), 30);
      const longPending = (das || []).filter(d => 
        d.status === 'brouillon' && new Date(d.created_at) < thirtyDaysAgo
      ).length;
      const frequentRejections = (das || []).filter(d => 
        ['rejetee', 'refusee_finance', 'rejetee_comptabilite'].includes(d.status)
      ).length;

      // Recent DA
      const { data: recentDAs } = await supabase
        .from('demandes_achat')
        .select('id, reference, status, total_amount, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      setRecentDA(recentDAs || []);

      // Top articles
      const { data: blArticles } = await supabase.from('bl_articles').select('designation');
      const articleCounts: Record<string, number> = {};
      (blArticles || []).forEach(a => {
        articleCounts[a.designation] = (articleCounts[a.designation] || 0) + 1;
      });
      const topArts = Object.entries(articleCounts)
        .map(([designation, count]) => ({ designation, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setTopArticles(topArts);

      setStats({
        besoins: {
          total: (besoins || []).length,
          byStatus: besoinsByStatus,
          byDepartment: besoinsByDepartment,
        },
        da: {
          total: (das || []).length,
          byStatus: daByStatus,
          totalAmount,
          avgProcessingDays: processedCount > 0 ? Math.round(processingDays / processedCount) : 0,
        },
        bl: blStats,
        stock: stockStats,
        finance: {
          byClass: Object.entries(byClass).map(([c, amount]) => ({ class: parseInt(c), amount })),
          pendingPayments,
          totalPaid,
        },
        anomalies: {
          longPending,
          frequentRejections,
          stockDiscrepancies: 0,
        },
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const exportReport = () => {
    if (!stats) return;

    const lines = [
      `Rapport KPM SYSTEME - ${format(new Date(), 'dd MMMM yyyy', { locale: fr })}`,
      '',
      '=== BESOINS ===',
      `Total: ${stats.besoins.total}`,
      ...Object.entries(stats.besoins.byStatus).map(([k, v]) => `- ${k}: ${v}`),
      '',
      '=== DEMANDES D\'ACHAT ===',
      `Total: ${stats.da.total}`,
      `Montant total: ${stats.da.totalAmount.toLocaleString('fr-FR')} XOF`,
      `Délai moyen: ${stats.da.avgProcessingDays} jours`,
      ...Object.entries(stats.da.byStatus).map(([k, v]) => `- ${DA_STATUS_LABELS[k as keyof typeof DA_STATUS_LABELS] || k}: ${v}`),
      '',
      '=== LIVRAISONS ===',
      `Total: ${stats.bl.total}`,
      `Livrées: ${stats.bl.delivered}`,
      `Partielles: ${stats.bl.partial}`,
      `En attente: ${stats.bl.pending}`,
      '',
      '=== STOCK ===',
      `Articles: ${stats.stock.total}`,
      `Stock bas: ${stats.stock.lowStock}`,
      `Épuisés: ${stats.stock.outOfStock}`,
      '',
      '=== FINANCE ===',
      `Payé: ${stats.finance.totalPaid.toLocaleString('fr-FR')} XOF`,
      `En attente: ${stats.finance.pendingPayments.toLocaleString('fr-FR')} XOF`,
      '',
      '=== ANOMALIES ===',
      `DA en attente > 30j: ${stats.anomalies.longPending}`,
      `Rejets fréquents: ${stats.anomalies.frequentRejections}`,
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rapport_kpm_${format(new Date(), 'yyyy-MM-dd')}.txt`;
    link.click();
  };

  if (!hasAccess) {
    return (
      <AppLayout>
        <AccessDenied message="Vous n'avez pas les permissions nécessaires pour accéder aux rapports." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Rapports & Gouvernance
            </h1>
            <p className="text-muted-foreground">
              Synthèse et indicateurs clés de l'activité
            </p>
          </div>
          <Button variant="outline" onClick={exportReport} disabled={!stats}>
            <Download className="mr-2 h-4 w-4" />
            Exporter rapport
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : stats && (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="operations">Opérations</TabsTrigger>
              {isFinance && <TabsTrigger value="finance">Finance</TabsTrigger>}
              <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* KPI Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.besoins.total}</p>
                      <p className="text-sm text-muted-foreground">Besoins</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                      <TrendingUp className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.da.total}</p>
                      <p className="text-sm text-muted-foreground">Demandes d'achat</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
                      <Package className="h-6 w-6 text-warning" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.bl.delivered}</p>
                      <p className="text-sm text-muted-foreground">Livraisons</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
                      <Wallet className="h-6 w-6 text-destructive" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{(Math.ceil(stats.da.totalAmount) / 1000000).toFixed(1)}M</p>
                      <p className="text-sm text-muted-foreground">XOF engagés</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent DA & Top Articles */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Dernières demandes d'achat
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Référence</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentDA.map((da) => (
                          <TableRow key={da.id}>
                            <TableCell className="font-medium">{da.reference}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {DA_STATUS_LABELS[da.status as keyof typeof DA_STATUS_LABELS] || da.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {da.total_amount ? `${da.total_amount.toLocaleString('fr-FR')}` : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Articles les plus demandés
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {topArticles.map((art, index) => (
                        <div key={art.designation} className="flex items-center gap-4">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{art.designation}</p>
                            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${(art.count / (topArticles[0]?.count || 1)) * 100}%` }}
                              />
                            </div>
                          </div>
                          <span className="font-mono text-sm text-muted-foreground">{art.count}</span>
                        </div>
                      ))}
                      {topArticles.length === 0 && (
                        <p className="text-center text-muted-foreground">Aucun article</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* By Department */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Besoins par département
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.besoins.byDepartment.slice(0, 5).map((dept) => (
                      <div key={dept.name} className="flex items-center justify-between">
                        <span className="font-medium">{dept.name}</span>
                        <div className="flex items-center gap-4">
                          <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${(dept.count / stats.besoins.total) * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-sm">{dept.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Operations Tab */}
            <TabsContent value="operations" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Demandes d'achat par statut</CardTitle>
                    <CardDescription>Répartition actuelle</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(stats.da.byStatus).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <span className="text-sm">
                            {DA_STATUS_LABELS[status as keyof typeof DA_STATUS_LABELS] || status}
                          </span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Performance</CardTitle>
                    <CardDescription>Indicateurs clés</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                      <span>Délai moyen de traitement</span>
                      <span className="text-2xl font-bold">{stats.da.avgProcessingDays} jours</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                      <span>Taux de livraison complète</span>
                      <span className="text-2xl font-bold">
                        {stats.bl.total > 0 ? Math.round((stats.bl.delivered / stats.bl.total) * 100) : 0}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>État du stock</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-lg border p-4 text-center">
                      <CheckCircle className="mx-auto h-8 w-8 text-success" />
                      <p className="mt-2 text-2xl font-bold">{stats.stock.total - stats.stock.lowStock - stats.stock.outOfStock}</p>
                      <p className="text-sm text-muted-foreground">En stock</p>
                    </div>
                    <div className="rounded-lg border border-warning/50 bg-warning/5 p-4 text-center">
                      <AlertTriangle className="mx-auto h-8 w-8 text-warning" />
                      <p className="mt-2 text-2xl font-bold">{stats.stock.lowStock}</p>
                      <p className="text-sm text-muted-foreground">Stock bas</p>
                    </div>
                    <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-center">
                      <XCircle className="mx-auto h-8 w-8 text-destructive" />
                      <p className="mt-2 text-2xl font-bold">{stats.stock.outOfStock}</p>
                      <p className="text-sm text-muted-foreground">Épuisés</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Finance Tab */}
            {isFinance && (
              <TabsContent value="finance" className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="border-success/50 bg-success/5">
                    <CardContent className="py-6 text-center">
                      <p className="text-sm text-muted-foreground">Total payé</p>
                      <p className="text-3xl font-bold text-success">
                        {stats.finance.totalPaid.toLocaleString('fr-FR')} XOF
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-warning/50 bg-warning/5">
                    <CardContent className="py-6 text-center">
                      <p className="text-sm text-muted-foreground">En attente de paiement</p>
                      <p className="text-3xl font-bold text-warning">
                        {stats.finance.pendingPayments.toLocaleString('fr-FR')} XOF
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Répartition par classe SYSCOHADA</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {stats.finance.byClass.map((item) => (
                        <div key={item.class} className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <span className="font-bold">Classe {item.class}</span>
                            <span className="ml-2 text-sm text-muted-foreground">
                              {SYSCOHADA_CLASSES[item.class]}
                            </span>
                          </div>
                          <span className="font-mono font-medium">
                            {item.amount.toLocaleString('fr-FR')} XOF
                          </span>
                        </div>
                      ))}
                      {stats.finance.byClass.length === 0 && (
                        <p className="text-center text-muted-foreground">Aucune écriture comptable</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Anomalies Tab */}
            <TabsContent value="anomalies" className="space-y-6">
              <Card className="border-warning/50 bg-warning/5">
                <CardContent className="flex items-start gap-3 py-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                  <div>
                    <p className="font-medium text-foreground">Détection d'anomalies</p>
                    <p className="text-sm text-muted-foreground">
                      Ces indicateurs signalent des situations nécessitant une attention particulière.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-3">
                <Card className={stats.anomalies.longPending > 0 ? 'border-warning/50' : ''}>
                  <CardContent className="py-6 text-center">
                    <Clock className={`mx-auto h-8 w-8 ${stats.anomalies.longPending > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
                    <p className="mt-2 text-3xl font-bold">{stats.anomalies.longPending}</p>
                    <p className="text-sm text-muted-foreground">DA en attente &gt; 30 jours</p>
                  </CardContent>
                </Card>

                <Card className={stats.anomalies.frequentRejections > 5 ? 'border-destructive/50' : ''}>
                  <CardContent className="py-6 text-center">
                    <XCircle className={`mx-auto h-8 w-8 ${stats.anomalies.frequentRejections > 5 ? 'text-destructive' : 'text-muted-foreground'}`} />
                    <p className="mt-2 text-3xl font-bold">{stats.anomalies.frequentRejections}</p>
                    <p className="text-sm text-muted-foreground">DA rejetées</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="py-6 text-center">
                    <Package className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-3xl font-bold">{stats.bl.partial}</p>
                    <p className="text-sm text-muted-foreground">Livraisons partielles</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recommandations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stats.anomalies.longPending > 0 && (
                    <div className="flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/5 p-4">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                      <div>
                        <p className="font-medium">DA bloquées</p>
                        <p className="text-sm text-muted-foreground">
                          {stats.anomalies.longPending} demande(s) d'achat sont en brouillon depuis plus de 30 jours.
                          Vérifiez leur pertinence.
                        </p>
                      </div>
                    </div>
                  )}
                  {stats.stock.lowStock > 0 && (
                    <div className="flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/5 p-4">
                      <Package className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                      <div>
                        <p className="font-medium">Stock critique</p>
                        <p className="text-sm text-muted-foreground">
                          {stats.stock.lowStock} article(s) ont atteint leur seuil minimum.
                          Planifiez un réapprovisionnement.
                        </p>
                      </div>
                    </div>
                  )}
                  {stats.anomalies.longPending === 0 && stats.stock.lowStock === 0 && (
                    <div className="flex items-center gap-3 rounded-lg border border-success/50 bg-success/5 p-4">
                      <CheckCircle className="h-5 w-5 text-success" />
                      <p className="font-medium text-success">Aucune anomalie détectée</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
