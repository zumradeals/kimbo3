import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calculator, CreditCard, ArrowRight, 
  CheckCircle, FileText, AlertCircle, Wallet, TrendingUp, TrendingDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface EcritureAValider {
  id: string;
  reference: string;
  libelle: string;
  debit: number;
  credit: number;
  devise: string;
  date_ecriture: string;
  is_validated: boolean;
}

interface DAenAttentePaiement {
  id: string;
  reference: string;
  total_amount: number | null;
  currency: string | null;
  validated_finance_at: string | null;
  department: { name: string } | null;
}

interface Caisse {
  id: string;
  code: string;
  name: string;
  solde_actuel: number;
  solde_initial: number;
  devise: string;
  type: string;
  is_active: boolean;
}

export function ComptabiliteDashboard() {
  const navigate = useNavigate();
  const [ecrituresAValider, setEcrituresAValider] = useState<EcritureAValider[]>([]);
  const [daEnAttente, setDaEnAttente] = useState<DAenAttentePaiement[]>([]);
  const [caisses, setCaisses] = useState<Caisse[]>([]);
  const [totaux, setTotaux] = useState({ debit: 0, credit: 0, enAttente: 0, soldeTotalCaisses: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch écritures non validées
        const { data: ecrituresData } = await supabase
          .from('ecritures_comptables')
          .select('id, reference, libelle, debit, credit, devise, date_ecriture, is_validated')
          .eq('is_validated', false)
          .order('date_ecriture', { ascending: false })
          .limit(10);

        setEcrituresAValider(ecrituresData || []);

        // Calculate totals for non-validated entries
        const totalDebit = (ecrituresData || []).reduce((sum, e) => sum + (e.debit || 0), 0);
        const totalCredit = (ecrituresData || []).reduce((sum, e) => sum + (e.credit || 0), 0);

        // Fetch DA en attente de paiement (validee_finance)
        const { data: daData } = await supabase
          .from('demandes_achat')
          .select(`
            id,
            reference,
            total_amount,
            currency,
            validated_finance_at,
            department:departments(name)
          `)
          .eq('status', 'validee_finance')
          .order('validated_finance_at', { ascending: true })
          .limit(10);

        setDaEnAttente(daData || []);

        // Calculate total en attente
        const totalEnAttente = (daData || []).reduce((sum, d) => sum + (d.total_amount || 0), 0);

        // Fetch caisses
        const { data: caissesData } = await supabase
          .from('caisses')
          .select('id, code, name, solde_actuel, solde_initial, devise, type, is_active')
          .eq('is_active', true)
          .order('code');

        setCaisses(caissesData || []);

        // Calculate total solde caisses
        const soldeTotalCaisses = (caissesData || []).reduce((sum, c) => sum + (c.solde_actuel || 0), 0);

        setTotaux({ debit: totalDebit, credit: totalCredit, enAttente: totalEnAttente, soldeTotalCaisses });

      } catch (error) {
        console.error('Error fetching comptabilite data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatMontant = (value: number, currency?: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + ' ' + (currency || 'XOF');
  };

  const getDaysSinceValidation = (date: string | null) => {
    if (!date) return 0;
    const diffTime = Math.abs(new Date().getTime() - new Date(date).getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

  const getSoldeVariation = (caisse: Caisse) => {
    return caisse.solde_actuel - caisse.solde_initial;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Calculator className="h-5 w-5 text-primary" />
        Tableau de bord Comptabilité
      </h2>

      {/* Totaux */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Solde total caisses</p>
                <p className="text-xl font-bold text-emerald-600">{formatMontant(totaux.soldeTotalCaisses)}</p>
              </div>
              <Wallet className="h-8 w-8 text-emerald-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-warning">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">En attente paiement</p>
                <p className="text-xl font-bold text-warning">{formatMontant(totaux.enAttente)}</p>
              </div>
              <CreditCard className="h-8 w-8 text-warning/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total débits (non validés)</p>
                <p className="text-xl font-bold text-primary">{formatMontant(totaux.debit)}</p>
              </div>
              <FileText className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-success">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total crédits (non validés)</p>
                <p className="text-xl font-bold text-success">{formatMontant(totaux.credit)}</p>
              </div>
              <FileText className="h-8 w-8 text-success/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vue consolidée des caisses */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-500" />
            Soldes des caisses ({caisses.length})
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/caisse')}
            className="text-xs"
          >
            Gérer <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent>
          {caisses.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Wallet className="mx-auto h-8 w-8 mb-2 text-muted-foreground/50" />
              <p className="text-sm">Aucune caisse configurée</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {caisses.map((caisse) => {
                const variation = getSoldeVariation(caisse);
                return (
                  <div 
                    key={caisse.id} 
                    className="p-3 rounded-lg border bg-card hover:bg-accent/5 cursor-pointer transition-colors"
                    onClick={() => navigate('/caisse')}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">
                          {caisse.code}
                        </Badge>
                        <span className="text-xs text-muted-foreground capitalize">{caisse.type}</span>
                      </div>
                      {variation !== 0 && (
                        <div className={`flex items-center text-xs ${variation > 0 ? 'text-success' : 'text-destructive'}`}>
                          {variation > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                          {variation > 0 ? '+' : ''}{formatMontant(variation, caisse.devise)}
                        </div>
                      )}
                    </div>
                    <p className="font-medium text-sm truncate">{caisse.name}</p>
                    <p className="text-lg font-bold text-foreground mt-1">
                      {formatMontant(caisse.solde_actuel, caisse.devise)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Écritures à valider */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-warning" />
              Écritures à valider ({ecrituresAValider.length})
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/comptabilite')}
              className="text-xs"
            >
              Voir tout <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {ecrituresAValider.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle className="mx-auto h-8 w-8 mb-2 text-success" />
                <p className="text-sm">Toutes les écritures sont validées</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {ecrituresAValider.map((ecriture) => (
                  <div 
                    key={ecriture.id} 
                    className="flex items-center justify-between p-2 rounded-md border bg-card hover:bg-accent/5 cursor-pointer transition-colors"
                    onClick={() => navigate(`/comptabilite/${ecriture.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{ecriture.reference}</p>
                      <p className="text-xs text-muted-foreground truncate">{ecriture.libelle}</p>
                    </div>
                    <div className="text-right">
                      {ecriture.debit > 0 && (
                        <p className="text-sm font-medium text-primary">D: {formatMontant(ecriture.debit, ecriture.devise)}</p>
                      )}
                      {ecriture.credit > 0 && (
                        <p className="text-sm font-medium text-success">C: {formatMontant(ecriture.credit, ecriture.devise)}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(ecriture.date_ecriture), 'dd/MM/yyyy')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* DA en attente de paiement */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-warning" />
              Paiements en attente ({daEnAttente.length})
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
            {daEnAttente.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle className="mx-auto h-8 w-8 mb-2 text-success" />
                <p className="text-sm">Aucun paiement en attente</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {daEnAttente.map((da) => {
                  const days = getDaysSinceValidation(da.validated_finance_at);
                  return (
                    <div 
                      key={da.id} 
                      className="flex items-center justify-between p-2 rounded-md border bg-card hover:bg-accent/5 cursor-pointer transition-colors"
                      onClick={() => navigate(`/demandes-achat/${da.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{da.reference}</p>
                          {days > 7 && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="mr-1 h-3 w-3" />
                              {days}j
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {da.department?.name || 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-warning">
                          {formatMontant(da.total_amount || 0, da.currency)}
                        </p>
                        {da.validated_finance_at && (
                          <p className="text-xs text-muted-foreground">
                            Validé le {format(new Date(da.validated_finance_at), 'dd/MM', { locale: fr })}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
