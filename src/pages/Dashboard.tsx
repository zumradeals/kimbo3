import { useEffect, useState } from 'react';
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
  primary: 'hsl(32, 93%, 54%)',      // Orange KIMBO
  secondary: 'hsl(24, 58%, 27%)',     // Marron profond
  success: 'hsl(142, 71%, 35%)',      // Vert
  warning: 'hsl(32, 93%, 45%)',       // Orange foncé
  danger: 'hsl(0, 65%, 51%)',         // Rouge
  muted: 'hsl(40, 24%, 70%)',         // Gris sable
  accent: 'hsl(32, 93%, 70%)',        // Orange clair
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

export default function Dashboard() {
  const { profile, roles, isAdmin, hasAnyRole } = useAuth();
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

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch departments count
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

        // Fetch besoins stats
        const { data: besoinsData } = await supabase
          .from('besoins')
          .select('status');

        const besoinsStats = {
          total: besoinsData?.length || 0,
          cree: besoinsData?.filter(b => b.status === 'cree').length || 0,
          pris_en_charge: besoinsData?.filter(b => b.status === 'pris_en_charge').length || 0,
          accepte: besoinsData?.filter(b => b.status === 'accepte').length || 0,
          refuse: besoinsData?.filter(b => b.status === 'refuse').length || 0,
        };

        // Fetch DA stats
        const { data: daData } = await supabase
          .from('demandes_achat')
          .select('status, total_amount, currency');

        const daStats = {
          total: daData?.length || 0,
          brouillon: daData?.filter(d => d.status === 'brouillon').length || 0,
          soumise: daData?.filter(d => d.status === 'soumise').length || 0,
          en_analyse: daData?.filter(d => d.status === 'en_analyse').length || 0,
          chiffree: daData?.filter(d => d.status === 'chiffree').length || 0,
          soumise_validation: daData?.filter(d => d.status === 'soumise_validation').length || 0,
          validee_finance: daData?.filter(d => d.status === 'validee_finance').length || 0,
          payee: daData?.filter(d => d.status === 'payee').length || 0,
          rejetee: daData?.filter(d => ['rejetee', 'refusee_finance', 'rejetee_comptabilite'].includes(d.status)).length || 0,
        };

        // Calculate amounts
        const engage = daData?.filter(d => ['soumise_validation', 'validee_finance', 'payee'].includes(d.status))
          .reduce((sum, d) => sum + (d.total_amount || 0), 0) || 0;
        const paye = daData?.filter(d => d.status === 'payee')
          .reduce((sum, d) => sum + (d.total_amount || 0), 0) || 0;
        const enAttente = daData?.filter(d => d.status === 'validee_finance')
          .reduce((sum, d) => sum + (d.total_amount || 0), 0) || 0;

        // Fetch BL stats
        const { data: blData } = await supabase
          .from('bons_livraison')
          .select('status');

        const blStats = {
          total: blData?.length || 0,
          prepare: blData?.filter(b => b.status === 'prepare').length || 0,
          valide: blData?.filter(b => ['valide', 'en_attente_validation'].includes(b.status)).length || 0,
          livre: blData?.filter(b => b.status === 'livre').length || 0,
          livree_partiellement: blData?.filter(b => b.status === 'livree_partiellement').length || 0,
        };

        // Fetch stock stats
        const { data: stockData } = await supabase
          .from('articles_stock')
          .select('quantity_available, quantity_min, status');

        const stockStats = {
          total: stockData?.length || 0,
          critique: stockData?.filter(s => s.quantity_available <= (s.quantity_min || 0) && s.quantity_available > 0).length || 0,
          epuise: stockData?.filter(s => s.status === 'epuise' || s.quantity_available <= 0).length || 0,
        };

        // Fetch monthly trends (last 6 months)
        const trends: MonthlyTrend[] = [];
        for (let i = 5; i >= 0; i--) {
          const monthDate = subMonths(new Date(), i);
          const monthStart = startOfMonth(monthDate);
          const monthEnd = endOfMonth(monthDate);
          const monthLabel = format(monthDate, 'MMM', { locale: fr });

          const { count: besoinsCount } = await supabase
            .from('besoins')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', monthStart.toISOString())
            .lte('created_at', monthEnd.toISOString());

          const { count: daCount } = await supabase
            .from('demandes_achat')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', monthStart.toISOString())
            .lte('created_at', monthEnd.toISOString());

          const { count: blCount } = await supabase
            .from('bons_livraison')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', monthStart.toISOString())
            .lte('created_at', monthEnd.toISOString());

          trends.push({
            month: monthLabel,
            besoins: besoinsCount || 0,
            da: daCount || 0,
            bl: blCount || 0,
          });
        }
        setMonthlyTrends(trends);

        setStats({
          totalUsers: userCount,
          totalDepartments: deptCount || 0,
          activeDepartments: activeDeptCount || 0,
          besoins: besoinsStats,
          da: daStats,
          bl: blStats,
          montants: { engage, paye, en_attente: enAttente },
          stock: stockStats,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [isAdmin]);

  const formatMontant = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + ' XOF';
  };

  const besoinsChartData = [
    { name: 'Créés', value: stats.besoins.cree, color: CHART_COLORS.primary },
    { name: 'Pris en charge', value: stats.besoins.pris_en_charge, color: CHART_COLORS.warning },
    { name: 'Acceptés', value: stats.besoins.accepte, color: CHART_COLORS.success },
    { name: 'Refusés', value: stats.besoins.refuse, color: CHART_COLORS.danger },
  ].filter(d => d.value > 0);

  const daChartData = [
    { name: 'Brouillon', value: stats.da.brouillon },
    { name: 'Soumises', value: stats.da.soumise },
    { name: 'En analyse', value: stats.da.en_analyse },
    { name: 'Chiffrées', value: stats.da.chiffree },
    { name: 'En validation', value: stats.da.soumise_validation },
    { name: 'Validées', value: stats.da.validee_finance },
    { name: 'Payées', value: stats.da.payee },
    { name: 'Rejetées', value: stats.da.rejetee },
  ];

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

        {/* Role-Specific Dashboards */}
        {hasAnyRole(['responsable_logistique', 'agent_logistique']) && (
          <LogistiqueDashboard />
        )}

        {hasAnyRole(['responsable_achats', 'agent_achats']) && (
          <AchatsDashboard />
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
