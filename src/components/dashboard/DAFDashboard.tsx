import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CreditCard, Clock, CheckCircle, TrendingUp, TrendingDown,
  AlertCircle, FileText, ArrowUpRight, BarChart3, Wallet
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, startOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DAFStats {
  montantEnAttente: number;
  nombreEnAttente: number;
  daValidesMois: number;
  montantValidesMois: number;
  daPayeesMois: number;
  montantPayesMois: number;
  daRefuseesMois: number;
  tauxValidation: number;
  evolutionMensuelle: Array<{
    mois: string;
    valide: number;
    refuse: number;
    montant: number;
  }>;
  repartitionCategorie: Array<{
    categorie: string;
    montant: number;
    count: number;
  }>;
}

const CHART_COLORS = {
  primary: 'hsl(32, 93%, 54%)',
  success: 'hsl(142, 71%, 35%)',
  danger: 'hsl(0, 65%, 51%)',
  warning: 'hsl(32, 93%, 45%)',
};

const CATEGORY_LABELS: Record<string, string> = {
  fournitures: 'Fournitures',
  equipement: 'Équipement',
  service: 'Service',
  maintenance: 'Maintenance',
  informatique: 'Informatique',
  autre: 'Autre',
};

export function DAFDashboard() {
  const [stats, setStats] = useState<DAFStats>({
    montantEnAttente: 0,
    nombreEnAttente: 0,
    daValidesMois: 0,
    montantValidesMois: 0,
    daPayeesMois: 0,
    montantPayesMois: 0,
    daRefuseesMois: 0,
    tauxValidation: 0,
    evolutionMensuelle: [],
    repartitionCategorie: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDAFStats = async () => {
      try {
        const now = new Date();
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        const yearStart = startOfYear(now);

        // Fetch DA en attente de validation
        const { data: daEnAttente } = await supabase
          .from('demandes_achat')
          .select('id, total_amount, category')
          .eq('status', 'soumise_validation');

        const montantEnAttente = daEnAttente?.reduce((sum, d) => sum + (d.total_amount || 0), 0) || 0;
        const nombreEnAttente = daEnAttente?.length || 0;

        // Fetch DA validées ce mois
        const { data: daValideesMois } = await supabase
          .from('demandes_achat')
          .select('id, total_amount, validated_finance_at')
          .eq('status', 'validee_finance')
          .gte('validated_finance_at', monthStart.toISOString())
          .lte('validated_finance_at', monthEnd.toISOString());

        // Also include paid ones validated this month
        const { data: daPayeesMois } = await supabase
          .from('demandes_achat')
          .select('id, total_amount, validated_finance_at')
          .eq('status', 'payee')
          .gte('validated_finance_at', monthStart.toISOString())
          .lte('validated_finance_at', monthEnd.toISOString());

        const allValideesMois = [...(daValideesMois || []), ...(daPayeesMois || [])];
        const montantValidesMois = allValideesMois.reduce((sum, d) => sum + (d.total_amount || 0), 0);

        // Fetch DA payées ce mois
        const { data: payeesMois } = await supabase
          .from('demandes_achat')
          .select('id, total_amount, comptabilise_at')
          .eq('status', 'payee')
          .gte('comptabilise_at', monthStart.toISOString())
          .lte('comptabilise_at', monthEnd.toISOString());

        const montantPayesMois = payeesMois?.reduce((sum, d) => sum + (d.total_amount || 0), 0) || 0;

        // Fetch DA refusées ce mois
        const { count: refuseesMois } = await supabase
          .from('demandes_achat')
          .select('*', { count: 'exact', head: true })
          .in('status', ['refusee_finance', 'rejetee_comptabilite'])
          .gte('updated_at', monthStart.toISOString())
          .lte('updated_at', monthEnd.toISOString());

        // Calculate validation rate
        const totalTraitesMois = allValideesMois.length + (refuseesMois || 0);
        const tauxValidation = totalTraitesMois > 0 
          ? Math.round((allValideesMois.length / totalTraitesMois) * 100) 
          : 100;

        // Fetch monthly evolution (last 6 months)
        const evolutionMensuelle: DAFStats['evolutionMensuelle'] = [];
        for (let i = 5; i >= 0; i--) {
          const monthDate = subMonths(now, i);
          const mStart = startOfMonth(monthDate);
          const mEnd = endOfMonth(monthDate);
          const moisLabel = format(monthDate, 'MMM', { locale: fr });

          const { data: validesMois } = await supabase
            .from('demandes_achat')
            .select('id, total_amount')
            .in('status', ['validee_finance', 'payee'])
            .gte('validated_finance_at', mStart.toISOString())
            .lte('validated_finance_at', mEnd.toISOString());

          const { count: refusesMois } = await supabase
            .from('demandes_achat')
            .select('*', { count: 'exact', head: true })
            .in('status', ['refusee_finance', 'rejetee_comptabilite'])
            .gte('updated_at', mStart.toISOString())
            .lte('updated_at', mEnd.toISOString());

          evolutionMensuelle.push({
            mois: moisLabel,
            valide: validesMois?.length || 0,
            refuse: refusesMois || 0,
            montant: validesMois?.reduce((sum, d) => sum + (d.total_amount || 0), 0) || 0,
          });
        }

        // Fetch category breakdown (this year)
        const { data: daCategories } = await supabase
          .from('demandes_achat')
          .select('category, total_amount')
          .in('status', ['validee_finance', 'payee'])
          .gte('validated_finance_at', yearStart.toISOString());

        const categoryMap = new Map<string, { montant: number; count: number }>();
        daCategories?.forEach(da => {
          const cat = da.category;
          const existing = categoryMap.get(cat) || { montant: 0, count: 0 };
          categoryMap.set(cat, {
            montant: existing.montant + (da.total_amount || 0),
            count: existing.count + 1,
          });
        });

        const repartitionCategorie = Array.from(categoryMap.entries()).map(([cat, data]) => ({
          categorie: CATEGORY_LABELS[cat] || cat,
          montant: data.montant,
          count: data.count,
        })).sort((a, b) => b.montant - a.montant);

        setStats({
          montantEnAttente,
          nombreEnAttente,
          daValidesMois: allValideesMois.length,
          montantValidesMois,
          daPayeesMois: payeesMois?.length || 0,
          montantPayesMois,
          daRefuseesMois: refuseesMois || 0,
          tauxValidation,
          evolutionMensuelle,
          repartitionCategorie,
        });
      } catch (error) {
        console.error('Error fetching DAF stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDAFStats();
  }, []);

  // ARRONDI COMPTABLE DAF: arrondi au supérieur pour les montants
  const formatMontant = (value: number) => {
    const rounded = Math.ceil(value);
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(rounded) + ' XOF';
  };

  const formatMontantShort = (value: number) => {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(0) + 'K';
    }
    return value.toString();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-md border bg-card p-3 shadow-md">
          <p className="font-medium text-sm mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name === 'Montant' ? formatMontant(entry.value) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
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
            <BarChart3 className="h-5 w-5 text-primary" />
            Tableau de bord DAF
          </h2>
          <p className="text-sm text-muted-foreground">
            Vue financière et suivi des validations
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/demandes-achat">
            Voir toutes les DA
            <ArrowUpRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* KPI Cards - Row 1: Urgent/Action */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* DA en attente de validation */}
        <Card className="border-l-4 border-l-warning bg-warning/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En attente de validation</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{stats.nombreEnAttente}</span>
              <span className="text-sm text-muted-foreground">DA</span>
            </div>
            <div className="mt-1 text-lg font-semibold text-warning">
              {formatMontant(stats.montantEnAttente)}
            </div>
            {stats.nombreEnAttente > 0 && (
              <Button asChild variant="link" className="mt-2 h-auto p-0 text-xs text-warning">
                <Link to="/demandes-achat?status=soumise_validation">
                  Traiter maintenant →
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* DA validées ce mois */}
        <Card className="border-l-4 border-l-success">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Validées ce mois</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{stats.daValidesMois}</span>
              <span className="text-sm text-muted-foreground">DA</span>
            </div>
            <div className="mt-1 text-lg font-semibold text-success">
              {formatMontant(stats.montantValidesMois)}
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-success border-success/30">
                {stats.tauxValidation}% taux de validation
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* DA payées ce mois */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payées ce mois</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{stats.daPayeesMois}</span>
              <span className="text-sm text-muted-foreground">DA</span>
            </div>
            <div className="mt-1 text-lg font-semibold text-primary">
              {formatMontant(stats.montantPayesMois)}
            </div>
            <Button asChild variant="link" className="mt-2 h-auto p-0 text-xs">
              <Link to="/comptabilite">
                Voir comptabilité →
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* DA refusées ce mois */}
        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Refusées ce mois</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{stats.daRefuseesMois}</span>
              <span className="text-sm text-muted-foreground">DA</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.daRefuseesMois === 0 
                ? 'Aucun refus ce mois'
                : 'Demandes non conformes ou hors budget'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Evolution mensuelle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Évolution des dépenses (6 mois)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.evolutionMensuelle}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mois" className="text-xs" />
                  <YAxis 
                    tickFormatter={formatMontantShort}
                    className="text-xs"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="montant"
                    name="Montant"
                    stroke={CHART_COLORS.primary}
                    fill={CHART_COLORS.primary}
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Validations vs Refus */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Décisions par mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.evolutionMensuelle}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mois" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    dataKey="valide" 
                    name="Validées" 
                    fill={CHART_COLORS.success}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="refuse" 
                    name="Refusées" 
                    fill={CHART_COLORS.danger}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      {stats.repartitionCategorie.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Répartition par catégorie (année en cours)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stats.repartitionCategorie.map((cat, index) => (
                <div
                  key={cat.categorie}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{cat.categorie}</p>
                    <p className="text-xs text-muted-foreground">{cat.count} DA</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">
                      {formatMontantShort(cat.montant)} XOF
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
