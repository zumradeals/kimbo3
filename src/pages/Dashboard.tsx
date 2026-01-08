import { useEffect, useState, useCallback, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROLE_LABELS } from '@/types/kpm';
import { 
  Users, Building2, FileText, TrendingUp, Package, 
  ShoppingCart, Truck, CreditCard, AlertTriangle, Clock,
  CheckCircle, XCircle, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { DashboardStatsSkeleton, DashboardFinancialSkeleton, DashboardChartSkeleton } from '@/components/ui/DashboardSkeleton';
import { LogistiqueDashboard } from '@/components/dashboard/LogistiqueDashboard';
import { AchatsDashboard } from '@/components/dashboard/AchatsDashboard';
import { ComptabiliteDashboard } from '@/components/dashboard/ComptabiliteDashboard';
import { DAFDashboard } from '@/components/dashboard/DAFDashboard';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DashboardStats {
  totalUsers: number;
  totalDepartments: number;
  activeDepartments: number;
  besoins: {
    total: number;
    cree: number;
    pris_en_charge: number;
    accepte: number;
    refuse: number;
  };
  da: {
    total: number;
    brouillon: number;
    soumise: number;
    en_analyse: number;
    chiffree: number;
    soumise_validation: number;
    validee_finance: number;
    payee: number;
    rejetee: number;
  };
  bl: {
    total: number;
    prepare: number;
    valide: number;
    livre: number;
    livree_partiellement: number;
  };
  montants: {
    engage: number;
    paye: number;
    en_attente: number;
  };
  stock: {
    total: number;
    critique: number;
    epuise: number;
  };
}

interface MonthlyTrend {
  month: string;
  besoins: number;
  da: number;
  bl: number;
}

const CHART_COLORS = {
  primary: 'hsl(32, 93%, 54%)',
  secondary: 'hsl(24, 58%, 27%)',
  success: 'hsl(142, 71%, 35%)',
  warning: 'hsl(32, 93%, 45%)',
  danger: 'hsl(0, 65%, 51%)',
  muted: 'hsl(40, 24%, 70%)',
  accent: 'hsl(32, 93%, 70%)',
};

const BESOIN_STATUS_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.warning,
  CHART_COLORS.success,
  CHART_COLORS.danger,
];

const DA_STATUS_COLORS = [
  CHART_COLORS.muted,
  CHART_COLORS.primary,
  CHART_COLORS.warning,
  CHART_COLORS.accent,
  CHART_COLORS.secondary,
  CHART_COLORS.success,
  CHART_COLORS.success,
  CHART_COLORS.danger,
];

// Cache for dashboard data (5 minutes TTL)
const CACHE_TTL = 5 * 60 * 1000;
let dashboardCache: { data: any; timestamp: number } | null = null;

export default function Dashboard() {
  const { user, profile, roles, isAdmin, hasAnyRole } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalDepartments: 0,
    activeDepartments: 0,
    besoins: { total: 0, cree: 0, pris_en_charge: 0, accepte: 0, refuse: 0 },
    da: { total: 0, brouillon: 0, soumise: 0, en_analyse: 0, chiffree: 0, soumise_validation: 0, validee_finance: 0, payee: 0, rejetee: 0 },
    bl: { total: 0, prepare: 0, valide: 0, livre: 0, livree_partiellement: 0 },
    montants: { engage: 0, paye: 0, en_attente: 0 },
    stock: { total: 0, critique: 0, epuise: 0 },
  });
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const canViewFullDashboard = hasAnyRole(['admin', 'dg', 'daf', 'responsable_logistique', 'responsable_achats', 'comptable']);

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;
    
    // Check cache first
    if (dashboardCache && Date.now() - dashboardCache.timestamp < CACHE_TTL) {
      const cached = dashboardCache.data;
      setStats(cached.stats);
      setMonthlyTrends(cached.trends);
      setIsLoading(false);
      return;
    }

    try {
      // Use optimized RPC function + parallel queries
      const [
        summaryResult,
        deptResult,
        activeDeptResult,
        userResult,
        daAmountsResult,
      ] = await Promise.all([
        // Main dashboard summary from optimized RPC
        supabase.rpc('dashboard_summary_by_role', { _user_id: user.id }),
        // Department counts
        supabase.from('departments').select('*', { count: 'exact', head: true }),
        supabase.from('departments').select('*', { count: 'exact', head: true }).eq('is_active', true),
        // User count (admin only)
        isAdmin 
          ? supabase.from('profiles').select('*', { count: 'exact', head: true })
          : Promise.resolve({ count: 0 }),
        // DA amounts for financial KPIs
        supabase.from('demandes_achat').select('status, total_amount'),
      ]);

      const summary = summaryResult.data as any || {};
      
      // Extract stats from RPC response
      const besoinsStats = summary.besoins || {};
      const daStats = summary.demandes_achat || {};
      const blStats = summary.bons_livraison || {};
      const stockStats = summary.stock || {};

      // Calculate amounts from DA data
      const daData = daAmountsResult.data || [];
      const engage = daData
        .filter((d: any) => ['soumise_validation', 'validee_finance', 'payee'].includes(d.status))
        .reduce((sum: number, d: any) => sum + (d.total_amount || 0), 0);
      const paye = daData
        .filter((d: any) => d.status === 'payee')
        .reduce((sum: number, d: any) => sum + (d.total_amount || 0), 0);
      const enAttente = daData
        .filter((d: any) => d.status === 'validee_finance')
        .reduce((sum: number, d: any) => sum + (d.total_amount || 0), 0);

      const newStats: DashboardStats = {
        totalUsers: (userResult as any).count || 0,
        totalDepartments: deptResult.count || 0,
        activeDepartments: activeDeptResult.count || 0,
        besoins: {
          total: besoinsStats.total || 0,
          cree: besoinsStats.cree || 0,
          pris_en_charge: besoinsStats.pris_en_charge || 0,
          accepte: besoinsStats.accepte || 0,
          refuse: besoinsStats.refuse || 0,
        },
        da: {
          total: daStats.total || 0,
          brouillon: daStats.brouillon || 0,
          soumise: daStats.soumise || 0,
          en_analyse: daStats.en_analyse || 0,
          chiffree: daStats.chiffree || 0,
          soumise_validation: daStats.soumise_validation || 0,
          validee_finance: daStats.validee_finance || 0,
          payee: daStats.payee || 0,
          rejetee: 0,
        },
        bl: {
          total: blStats.total || 0,
          prepare: blStats.prepare || 0,
          valide: blStats.valide || blStats.en_attente_validation || 0,
          livre: blStats.livre || 0,
          livree_partiellement: 0,
        },
        montants: { engage, paye, en_attente: enAttente },
        stock: {
          total: stockStats.total_articles || 0,
          critique: stockStats.low_stock || 0,
          epuise: stockStats.epuise || 0,
        },
      };

      setStats(newStats);

      // Fetch monthly trends in parallel (optimized batch)
      const now = new Date();
      const monthPromises = Array.from({ length: 6 }, (_, i) => {
        const monthDate = subMonths(now, 5 - i);
        const monthStart = startOfMonth(monthDate).toISOString();
        const monthEnd = endOfMonth(monthDate).toISOString();
        const monthLabel = format(monthDate, 'MMM', { locale: fr });
        
        return Promise.all([
          supabase.from('besoins').select('*', { count: 'exact', head: true })
            .gte('created_at', monthStart).lte('created_at', monthEnd),
          supabase.from('demandes_achat').select('*', { count: 'exact', head: true })
            .gte('created_at', monthStart).lte('created_at', monthEnd),
          supabase.from('bons_livraison').select('*', { count: 'exact', head: true })
            .gte('created_at', monthStart).lte('created_at', monthEnd),
        ]).then(([b, d, bl]) => ({
          month: monthLabel,
          besoins: b.count || 0,
          da: d.count || 0,
          bl: bl.count || 0,
        }));
      });

      const trends = await Promise.all(monthPromises);
      setMonthlyTrends(trends);

      // Update cache
      dashboardCache = {
        data: { stats: newStats, trends },
        timestamp: Date.now(),
      };

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, isAdmin]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatMontant = useCallback((value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + ' XOF';
  }, []);

  const besoinsChartData = useMemo(() => [
    { name: 'Créés', value: stats.besoins.cree, color: CHART_COLORS.primary },
    { name: 'Pris en charge', value: stats.besoins.pris_en_charge, color: CHART_COLORS.warning },
    { name: 'Acceptés', value: stats.besoins.accepte, color: CHART_COLORS.success },
    { name: 'Refusés', value: stats.besoins.refuse, color: CHART_COLORS.danger },
  ].filter(d => d.value > 0), [stats.besoins]);

  const daChartData = useMemo(() => [
    { name: 'Brouillon', value: stats.da.brouillon },
    { name: 'Soumises', value: stats.da.soumise },
    { name: 'En analyse', value: stats.da.en_analyse },
    { name: 'Chiffrées', value: stats.da.chiffree },
    { name: 'En validation', value: stats.da.soumise_validation },
    { name: 'Validées', value: stats.da.validee_finance },
    { name: 'Payées', value: stats.da.payee },
    { name: 'Rejetées', value: stats.da.rejetee },
  ], [stats.da]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-md border bg-card p-2 shadow-md">
          <p className="font-medium text-sm">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Tableau de bord
            </h1>
            <p className="text-muted-foreground">
              Bienvenue, {profile?.first_name || 'Utilisateur'}
            </p>
          </div>
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

        {/* KPI Cards Row */}
        {isLoading ? (
          <DashboardStatsSkeleton />
        ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Besoins internes</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : stats.besoins.total}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center text-success">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  {stats.besoins.accepte} acceptés
                </span>
                <span className="flex items-center text-warning">
                  <Clock className="mr-1 h-3 w-3" />
                  {stats.besoins.cree + stats.besoins.pris_en_charge} en cours
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Demandes d'achat</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : stats.da.total}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center text-primary">
                  <TrendingUp className="mr-1 h-3 w-3" />
                  {stats.da.soumise + stats.da.en_analyse + stats.da.chiffree + stats.da.soumise_validation} en traitement
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bons de livraison</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : stats.bl.total}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center text-success">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  {stats.bl.livre} livrés
                </span>
                <span className="flex items-center text-warning">
                  <Clock className="mr-1 h-3 w-3" />
                  {stats.bl.prepare + stats.bl.valide} en attente
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Articles en stock</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : stats.stock.total}
              </div>
              <div className="flex items-center gap-2 text-xs">
                {stats.stock.critique > 0 && (
                  <span className="flex items-center text-warning">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    {stats.stock.critique} critique
                  </span>
                )}
                {stats.stock.epuise > 0 && (
                  <span className="flex items-center text-destructive">
                    <XCircle className="mr-1 h-3 w-3" />
                    {stats.stock.epuise} épuisé
                  </span>
                )}
                {stats.stock.critique === 0 && stats.stock.epuise === 0 && (
                  <span className="text-muted-foreground">Stock normal</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Financial KPIs */}
        {canViewFullDashboard && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <CreditCard className="h-4 w-4" />
                  Montants engagés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {isLoading ? '...' : formatMontant(stats.montants.engage)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total des DA validées et payées
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-success">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle className="h-4 w-4" />
                  Montants payés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">
                  {isLoading ? '...' : formatMontant(stats.montants.paye)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Paiements effectués
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-warning">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4" />
                  En attente de paiement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">
                  {isLoading ? '...' : formatMontant(stats.montants.en_attente)}
                </div>
                <p className="text-xs text-muted-foreground">
                  DA validées non payées
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts Row */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Besoins Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Répartition des besoins</CardTitle>
            </CardHeader>
            <CardContent>
              {besoinsChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={besoinsChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {besoinsChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                  Aucune donnée disponible
                </div>
              )}
            </CardContent>
          </Card>

          {/* DA Status Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">État des demandes d'achat</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={daChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={100}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="value" 
                    fill={CHART_COLORS.primary}
                    radius={[0, 4, 4, 0]}
                  >
                    {daChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={DA_STATUS_COLORS[index % DA_STATUS_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tendances mensuelles (6 derniers mois)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="besoins" 
                  name="Besoins"
                  stroke={CHART_COLORS.primary} 
                  fill={CHART_COLORS.primary}
                  fillOpacity={0.3}
                />
                <Area 
                  type="monotone" 
                  dataKey="da" 
                  name="DA"
                  stroke={CHART_COLORS.secondary} 
                  fill={CHART_COLORS.secondary}
                  fillOpacity={0.3}
                />
                <Area 
                  type="monotone" 
                  dataKey="bl" 
                  name="BL"
                  stroke={CHART_COLORS.success} 
                  fill={CHART_COLORS.success}
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Role-Specific Dashboards - Mutualisés: Les deux voient les deux */}
        {hasAnyRole(['responsable_logistique', 'agent_logistique', 'responsable_achats', 'agent_achats']) && (
          <>
            <LogistiqueDashboard />
            <AchatsDashboard />
          </>
        )}

        {hasAnyRole(['comptable']) && (
          <ComptabiliteDashboard />
        )}

        {hasAnyRole(['daf']) && !isAdmin && (
          <DAFDashboard />
        )}

        {/* Admin Stats */}
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
                <CardTitle className="text-sm font-medium">Taux de rejet DA</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? '...' : stats.da.total > 0 
                    ? `${Math.round((stats.da.rejetee / stats.da.total) * 100)}%`
                    : '0%'
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.da.rejetee} sur {stats.da.total} DA
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
