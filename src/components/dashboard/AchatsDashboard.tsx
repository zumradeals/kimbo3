import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ShoppingCart, Users, Clock, ArrowRight, 
  CheckCircle, AlertCircle, TrendingUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DAaTraiter {
  id: string;
  reference: string;
  status: string;
  priority: string;
  created_at: string;
  total_amount: number | null;
  currency: string | null;
  department: { name: string } | null;
}

interface FournisseurActif {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  da_count: number;
}

export function AchatsDashboard() {
  const navigate = useNavigate();
  const [daATraiter, setDaATraiter] = useState<DAaTraiter[]>([]);
  const [fournisseurs, setFournisseurs] = useState<FournisseurActif[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch DA à traiter (soumise, en_analyse, chiffree, en_revision_achats)
        const { data: daData } = await supabase
          .from('demandes_achat')
          .select(`
            id,
            reference,
            status,
            priority,
            created_at,
            total_amount,
            currency,
            department:departments(name)
          `)
          .in('status', ['soumise', 'en_analyse', 'chiffree', 'en_revision_achats'])
          .order('created_at', { ascending: false })
          .limit(10);

        setDaATraiter(daData || []);

        // Fetch fournisseurs actifs with DA count
        const { data: fournisseursData } = await supabase
          .from('fournisseurs')
          .select('id, name, contact_name, email, phone')
          .eq('is_active', true)
          .order('name')
          .limit(10);

        // Count DA per fournisseur
        const fournisseursWithCount = await Promise.all(
          (fournisseursData || []).map(async (f) => {
            const { count } = await supabase
              .from('demandes_achat')
              .select('*', { count: 'exact', head: true })
              .eq('selected_fournisseur_id', f.id);
            return { ...f, da_count: count || 0 };
          })
        );

        // Sort by DA count
        fournisseursWithCount.sort((a, b) => b.da_count - a.da_count);
        setFournisseurs(fournisseursWithCount);

      } catch (error) {
        console.error('Error fetching achats data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const getDaStatusBadge = (status: string) => {
    switch (status) {
      case 'soumise':
        return <Badge variant="secondary" className="bg-primary/10 text-primary">Soumise</Badge>;
      case 'en_analyse':
        return <Badge variant="secondary" className="bg-warning/10 text-warning">En analyse</Badge>;
      case 'chiffree':
        return <Badge variant="secondary" className="bg-success/10 text-success">Chiffrée</Badge>;
      case 'en_revision_achats':
        return <Badge variant="secondary" className="bg-destructive/10 text-destructive">En révision</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgente':
        return <Badge variant="destructive" className="text-xs">Urgent</Badge>;
      case 'haute':
        return <Badge variant="secondary" className="bg-warning/10 text-warning text-xs">Haute</Badge>;
      default:
        return null;
    }
  };

  // ARRONDI COMPTABLE DAF: arrondi au supérieur pour les montants
  const formatMontant = (value: number | null, currency: string | null) => {
    if (!value) return 'Non chiffré';
    const rounded = Math.ceil(value);
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(rounded) + ' ' + (currency || 'XOF');
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="animate-pulse">
          <CardHeader><div className="h-5 bg-muted rounded w-1/2" /></CardHeader>
          <CardContent><div className="h-32 bg-muted rounded" /></CardContent>
        </Card>
        <Card className="animate-pulse">
          <CardHeader><div className="h-5 bg-muted rounded w-1/2" /></CardHeader>
          <CardContent><div className="h-32 bg-muted rounded" /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <ShoppingCart className="h-5 w-5 text-primary" />
        Tableau de bord Achats
      </h2>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* DA à traiter */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              DA à traiter ({daATraiter.length})
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/demandes-achat')}
              className="text-xs"
            >
              Voir tout <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {daATraiter.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle className="mx-auto h-8 w-8 mb-2 text-success" />
                <p className="text-sm">Aucune DA en attente</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {daATraiter.map((da) => (
                  <div 
                    key={da.id} 
                    className="flex items-center justify-between p-2 rounded-md border bg-card hover:bg-accent/5 cursor-pointer transition-colors"
                    onClick={() => navigate(`/demandes-achat/${da.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{da.reference}</p>
                        {getPriorityBadge(da.priority)}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {da.department?.name || 'N/A'} • {formatMontant(da.total_amount, da.currency)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {format(new Date(da.created_at), 'dd MMM', { locale: fr })}
                      </span>
                      {getDaStatusBadge(da.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fournisseurs actifs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Fournisseurs actifs ({fournisseurs.length})
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/fournisseurs')}
              className="text-xs"
            >
              Voir tout <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {fournisseurs.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <AlertCircle className="mx-auto h-8 w-8 mb-2" />
                <p className="text-sm">Aucun fournisseur actif</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {fournisseurs.map((f) => (
                  <div 
                    key={f.id} 
                    className="flex items-center justify-between p-2 rounded-md border bg-card hover:bg-accent/5 cursor-pointer transition-colors"
                    onClick={() => navigate('/fournisseurs')}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {f.contact_name || f.email || f.phone || 'Pas de contact'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {f.da_count > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <TrendingUp className="mr-1 h-3 w-3" />
                          {f.da_count} DA
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
