import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  ShieldCheck,
  FileText,
  Package,
  ClipboardList,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DA_STATUS_LABELS, BESOIN_STATUS_LABELS } from '@/types/kpm';

interface AALReportStats {
  da: {
    total: number;
    byStatus: Record<string, number>;
    totalAmount: number;
    avgProcessingDays: number;
    chiffrees: number;
    valideesAAL: number;
    rejeteesAAL: number;
    transmisesDaf: number;
  };
  besoins: {
    total: number;
    byStatus: Record<string, number>;
    byDepartment: { name: string; count: number }[];
  };
  bl: {
    total: number;
    delivered: number;
    partial: number;
    pending: number;
  };
  stock: {
    totalArticles: number;
    lowStock: number;
    outOfStock: number;
    topArticles: { designation: string; count: number }[];
  };
  anomalies: {
    longPendingDA: number;
    frequentRejections: number;
    daWithoutBL: number;
  };
}

export default function RapportsAAL() {
  const { roles, isAdmin } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<AALReportStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recentDA, setRecentDA] = useState<any[]>([]);

  const hasAccess = isAdmin || roles.includes('aal');

  useEffect(() => {
    if (hasAccess) fetchStats();
  }, [hasAccess]);

  const formatMontant = (value: number) =>
    new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.ceil(value)) + ' FCFA';

  const fetchStats = async () => {
    try {
      const [
        { data: das },
        { data: besoins },
        { data: departments },
        { data: bls },
        { data: stock },
        { data: blArticles },
      ] = await Promise.all([
        supabase.from('demandes_achat').select('id, status, total_amount, created_at, submitted_at'),
        supabase.from('besoins').select('id, status, department_id'),
        supabase.from('departments').select('id, name'),
        supabase.from('bons_livraison').select('id, status'),
        supabase.from('articles_stock').select('id, status, quantity_available, quantity_min'),
        supabase.from('bl_articles').select('designation'),
      ]);

      // DA stats
      const daByStatus: Record<string, number> = {};
      let totalAmount = 0;
      let processingDays = 0;
      let processedCount = 0;
      (das || []).forEach(da => {
        daByStatus[da.status] = (daByStatus[da.status] || 0) + 1;
        if (da.total_amount) totalAmount += da.total_amount;
        if (da.submitted_at && da.created_at) {
          const days = Math.floor((new Date(da.submitted_at).getTime() - new Date(da.created_at).getTime()) / (1000 * 60 * 60 * 24));
          if (days >= 0) { processingDays += days; processedCount++; }
        }
      });

      // Besoins stats
      const besoinsByStatus: Record<string, number> = {};
      const besoinsByDept: Record<string, number> = {};
      (besoins || []).forEach(b => {
        besoinsByStatus[b.status] = (besoinsByStatus[b.status] || 0) + 1;
        besoinsByDept[b.department_id] = (besoinsByDept[b.department_id] || 0) + 1;
      });
      const deptMap = Object.fromEntries((departments || []).map(d => [d.id, d.name]));
      const besoinsByDepartment = Object.entries(besoinsByDept)
        .map(([id, count]) => ({ name: deptMap[id] || 'Inconnu', count }))
        .sort((a, b) => b.count - a.count);

      // BL stats
      const blStats = {
        total: (bls || []).length,
        delivered: (bls || []).filter(b => b.status === 'livre').length,
        partial: (bls || []).filter(b => b.status === 'livree_partiellement').length,
        pending: (bls || []).filter(b => ['prepare', 'en_attente_validation', 'valide'].includes(b.status)).length,
      };

      // Stock stats
      const stockStats = {
        totalArticles: (stock || []).length,
        lowStock: (stock || []).filter(s => s.quantity_min && s.quantity_available <= s.quantity_min && s.quantity_available > 0).length,
        outOfStock: (stock || []).filter(s => s.quantity_available <= 0).length,
        topArticles: [] as { designation: string; count: number }[],
      };
      const articleCounts: Record<string, number> = {};
      (blArticles || []).forEach(a => { articleCounts[a.designation] = (articleCounts[a.designation] || 0) + 1; });
      stockStats.topArticles = Object.entries(articleCounts)
        .map(([designation, count]) => ({ designation, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Anomalies
      const thirtyDaysAgo = subDays(new Date(), 30);
      const longPendingDA = (das || []).filter(d => d.status === 'chiffree' && new Date(d.created_at) < thirtyDaysAgo).length;
      const frequentRejections = (das || []).filter(d => ['rejetee', 'rejetee_aal', 'refusee_finance', 'rejetee_comptabilite'].includes(d.status)).length;
      const daWithoutBL = (das || []).filter(d => d.status === 'validee_finance').length;

      // Recent DA for AAL
      const { data: recentDAs } = await supabase
        .from('demandes_achat')
        .select('id, reference, description, status, total_amount, created_at, department:departments(name)')
        .in('status', ['chiffree', 'validee_aal', 'rejetee_aal', 'soumise_validation', 'validee_finance'])
        .order('created_at', { ascending: false })
        .limit(15);
      setRecentDA(recentDAs || []);

      setStats({
        da: {
          total: (das || []).length,
          byStatus: daByStatus,
          totalAmount,
          avgProcessingDays: processedCount > 0 ? Math.round(processingDays / processedCount) : 0,
          chiffrees: daByStatus['chiffree'] || 0,
          valideesAAL: daByStatus['validee_aal'] || 0,
          rejeteesAAL: daByStatus['rejetee_aal'] || 0,
          transmisesDaf: daByStatus['soumise_validation'] || 0,
        },
        besoins: { total: (besoins || []).length, byStatus: besoinsByStatus, byDepartment: besoinsByDepartment },
        bl: blStats,
        stock: stockStats,
        anomalies: { longPendingDA, frequentRejections, daWithoutBL },
      });
    } catch (error: any) {
      console.error('Error fetching AAL report stats:', error);
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const exportReport = () => {
    if (!stats) return;
    const lines = [
      `Rapport AAL - KPM SYSTEME - ${format(new Date(), 'dd MMMM yyyy', { locale: fr })}`,
      '',
      '=== DEMANDES D\'ACHAT (périmètre AAL) ===',
      `Total: ${stats.da.total}`,
      `Montant total engagé: ${formatMontant(stats.da.totalAmount)}`,
      `Délai moyen traitement: ${stats.da.avgProcessingDays} jours`,
      `DA chiffrées (à valider): ${stats.da.chiffrees}`,
      `Validées AAL: ${stats.da.valideesAAL}`,
      `Rejetées AAL: ${stats.da.rejeteesAAL}`,
      `Transmises DAF: ${stats.da.transmisesDaf}`,
      ...Object.entries(stats.da.byStatus).map(([k, v]) => `- ${DA_STATUS_LABELS[k as keyof typeof DA_STATUS_LABELS] || k}: ${v}`),
      '',
      '=== BESOINS INTERNES ===',
      `Total: ${stats.besoins.total}`,
      ...Object.entries(stats.besoins.byStatus).map(([k, v]) => `- ${BESOIN_STATUS_LABELS[k as keyof typeof BESOIN_STATUS_LABELS] || k}: ${v}`),
      '',
      'Par département:',
      ...stats.besoins.byDepartment.map(d => `- ${d.name}: ${d.count}`),
      '',
      '=== LIVRAISONS ===',
      `Total: ${stats.bl.total}`,
      `Livrées: ${stats.bl.delivered}`,
      `Partielles: ${stats.bl.partial}`,
      `En attente: ${stats.bl.pending}`,
      '',
      '=== STOCK ===',
      `Articles: ${stats.stock.totalArticles}`,
      `Stock bas: ${stats.stock.lowStock}`,
      `Ruptures: ${stats.stock.outOfStock}`,
      '',
      'Top articles demandés:',
      ...stats.stock.topArticles.map((a, i) => `${i + 1}. ${a.designation} (${a.count}x)`),
      '',
      '=== ALERTES ===',
      `DA chiffrées > 30 jours: ${stats.anomalies.longPendingDA}`,
      `Rejets cumulés: ${stats.anomalies.frequentRejections}`,
      `DA validées sans BL: ${stats.anomalies.daWithoutBL}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rapport_aal_${format(new Date(), 'yyyy-MM-dd')}.txt`;
    link.click();
  };

  if (!hasAccess) {
    return (
      <AppLayout>
        <AccessDenied message="Accès réservé à l'Administrateur Achats & Logistique (AAL)." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Rapports AAL
            </h1>
            <p className="text-muted-foreground">
              Synthèse opérationnelle Achats & Logistique
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
          <Tabs defaultValue="da" className="space-y-6">
            <TabsList className="flex-wrap">
              <TabsTrigger value="da">Demandes d'achat</TabsTrigger>
              <TabsTrigger value="besoins">Besoins</TabsTrigger>
              <TabsTrigger value="livraisons">Livraisons</TabsTrigger>
              <TabsTrigger value="stock">Stock</TabsTrigger>
              <TabsTrigger value="alertes">Alertes</TabsTrigger>
            </TabsList>

            {/* DA Tab */}
            <TabsContent value="da" className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-l-4 border-l-warning">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold">{stats.da.chiffrees}</p>
                        <p className="text-sm text-muted-foreground">À valider</p>
                      </div>
                      <Clock className="h-8 w-8 text-warning" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-success">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold">{stats.da.valideesAAL}</p>
                        <p className="text-sm text-muted-foreground">Validées AAL</p>
                      </div>
                      <CheckCircle className="h-8 w-8 text-success" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-primary">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold">{stats.da.transmisesDaf}</p>
                        <p className="text-sm text-muted-foreground">Transmises DAF</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-primary" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-destructive">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold">{stats.da.rejeteesAAL}</p>
                        <p className="text-sm text-muted-foreground">Rejetées</p>
                      </div>
                      <XCircle className="h-8 w-8 text-destructive" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Montant & Délai */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardContent className="flex items-center gap-4 py-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-xl font-bold">{formatMontant(stats.da.totalAmount)}</p>
                      <p className="text-sm text-muted-foreground">Montant total engagé</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 py-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
                      <Clock className="h-6 w-6 text-warning" />
                    </div>
                    <div>
                      <p className="text-xl font-bold">{stats.da.avgProcessingDays} jours</p>
                      <p className="text-sm text-muted-foreground">Délai moyen de traitement</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Répartition par statut */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Répartition par statut ({stats.da.total} DA)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(stats.da.byStatus)
                      .sort(([, a], [, b]) => b - a)
                      .map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {DA_STATUS_LABELS[status as keyof typeof DA_STATUS_LABELS] || status}
                          </Badge>
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${(count / stats.da.total) * 100}%` }}
                              />
                            </div>
                            <span className="font-mono text-sm w-8 text-right">{count}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent DA */}
              {recentDA.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Dernières DA (périmètre AAL)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Référence</TableHead>
                          <TableHead>Département</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead className="text-right">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentDA.map((da: any) => (
                          <TableRow key={da.id}>
                            <TableCell className="font-medium">{da.reference}</TableCell>
                            <TableCell className="text-muted-foreground">{(da.department as any)?.name || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {DA_STATUS_LABELS[da.status as keyof typeof DA_STATUS_LABELS] || da.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {da.total_amount ? formatMontant(da.total_amount) : '-'}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {format(new Date(da.created_at), 'dd MMM yyyy', { locale: fr })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Besoins Tab */}
            <TabsContent value="besoins" className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="flex items-center gap-4 py-6">
                    <ClipboardList className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{stats.besoins.total}</p>
                      <p className="text-sm text-muted-foreground">Besoins total</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 py-6">
                    <CheckCircle className="h-8 w-8 text-success" />
                    <div>
                      <p className="text-2xl font-bold">{stats.besoins.byStatus['accepte_pour_transformation'] || 0}</p>
                      <p className="text-sm text-muted-foreground">Acceptés</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 py-6">
                    <Clock className="h-8 w-8 text-warning" />
                    <div>
                      <p className="text-2xl font-bold">{(stats.besoins.byStatus['cree'] || 0) + (stats.besoins.byStatus['pris_en_charge'] || 0)}</p>
                      <p className="text-sm text-muted-foreground">En cours</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Répartition par statut</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(stats.besoins.byStatus)
                      .sort(([, a], [, b]) => b - a)
                      .map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {BESOIN_STATUS_LABELS[status as keyof typeof BESOIN_STATUS_LABELS] || status}
                          </Badge>
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                              <div className="h-full bg-primary" style={{ width: `${(count / stats.besoins.total) * 100}%` }} />
                            </div>
                            <span className="font-mono text-sm w-8 text-right">{count}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Par département</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.besoins.byDepartment.slice(0, 8).map(dept => (
                      <div key={dept.name} className="flex items-center justify-between">
                        <span className="font-medium">{dept.name}</span>
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                            <div className="h-full bg-primary" style={{ width: `${(dept.count / stats.besoins.total) * 100}%` }} />
                          </div>
                          <span className="font-mono text-sm w-8 text-right">{dept.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Livraisons Tab */}
            <TabsContent value="livraisons" className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="flex items-center gap-4 py-6">
                    <Package className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{stats.bl.total}</p>
                      <p className="text-sm text-muted-foreground">BL total</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-success">
                  <CardContent className="pt-6">
                    <p className="text-2xl font-bold">{stats.bl.delivered}</p>
                    <p className="text-sm text-muted-foreground">Livrées complètes</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-warning">
                  <CardContent className="pt-6">
                    <p className="text-2xl font-bold">{stats.bl.partial}</p>
                    <p className="text-sm text-muted-foreground">Livrées partiellement</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-muted">
                  <CardContent className="pt-6">
                    <p className="text-2xl font-bold">{stats.bl.pending}</p>
                    <p className="text-sm text-muted-foreground">En attente</p>
                  </CardContent>
                </Card>
              </div>

              {stats.bl.total > 0 && (
                <Card>
                  <CardHeader><CardTitle>Taux de livraison</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="h-4 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="flex h-full">
                          <div className="bg-success" style={{ width: `${(stats.bl.delivered / stats.bl.total) * 100}%` }} />
                          <div className="bg-warning" style={{ width: `${(stats.bl.partial / stats.bl.total) * 100}%` }} />
                        </div>
                      </div>
                      <span className="font-mono text-sm">
                        {Math.round(((stats.bl.delivered + stats.bl.partial) / stats.bl.total) * 100)}%
                      </span>
                    </div>
                    <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-success" /> Complètes</span>
                      <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-warning" /> Partielles</span>
                      <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-muted-foreground" /> En attente</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Stock Tab */}
            <TabsContent value="stock" className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="flex items-center gap-4 py-6">
                    <Package className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{stats.stock.totalArticles}</p>
                      <p className="text-sm text-muted-foreground">Articles en stock</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-warning">
                  <CardContent className="pt-6">
                    <p className="text-2xl font-bold">{stats.stock.lowStock}</p>
                    <p className="text-sm text-muted-foreground">Stock bas</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-destructive">
                  <CardContent className="pt-6">
                    <p className="text-2xl font-bold">{stats.stock.outOfStock}</p>
                    <p className="text-sm text-muted-foreground">Ruptures de stock</p>
                  </CardContent>
                </Card>
              </div>

              {stats.stock.topArticles.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Articles les plus demandés
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {stats.stock.topArticles.map((art, index) => (
                        <div key={art.designation} className="flex items-center gap-4">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{art.designation}</p>
                            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                              <div className="h-full bg-primary" style={{ width: `${(art.count / (stats.stock.topArticles[0]?.count || 1)) * 100}%` }} />
                            </div>
                          </div>
                          <span className="font-mono text-sm text-muted-foreground">{art.count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Alertes Tab */}
            <TabsContent value="alertes" className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className={stats.anomalies.longPendingDA > 0 ? 'border-destructive' : ''}>
                  <CardContent className="flex items-center gap-4 py-6">
                    <AlertTriangle className={`h-8 w-8 ${stats.anomalies.longPendingDA > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="text-2xl font-bold">{stats.anomalies.longPendingDA}</p>
                      <p className="text-sm text-muted-foreground">DA chiffrées &gt; 30 jours</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className={stats.anomalies.frequentRejections > 5 ? 'border-warning' : ''}>
                  <CardContent className="flex items-center gap-4 py-6">
                    <XCircle className={`h-8 w-8 ${stats.anomalies.frequentRejections > 5 ? 'text-warning' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="text-2xl font-bold">{stats.anomalies.frequentRejections}</p>
                      <p className="text-sm text-muted-foreground">Rejets cumulés</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 py-6">
                    <Package className={`h-8 w-8 ${stats.anomalies.daWithoutBL > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="text-2xl font-bold">{stats.anomalies.daWithoutBL}</p>
                      <p className="text-sm text-muted-foreground">DA validées sans BL</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {(stats.anomalies.longPendingDA > 0 || stats.anomalies.frequentRejections > 5) && (
                <Card className="border-warning bg-warning/5">
                  <CardContent className="py-6">
                    <h3 className="font-semibold flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-5 w-5 text-warning" />
                      Recommandations
                    </h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {stats.anomalies.longPendingDA > 0 && (
                        <li>• {stats.anomalies.longPendingDA} DA chiffrée(s) en attente depuis plus de 30 jours. Vérifiez le circuit de validation.</li>
                      )}
                      {stats.anomalies.frequentRejections > 5 && (
                        <li>• Taux de rejet élevé ({stats.anomalies.frequentRejections} rejets). Analysez les motifs de rejet récurrents.</li>
                      )}
                      {stats.anomalies.daWithoutBL > 0 && (
                        <li>• {stats.anomalies.daWithoutBL} DA validée(s) finance sans bon de livraison associé.</li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
