import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Wallet, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, Minus, Calendar, User, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Caisse {
  id: string;
  code: string;
  name: string;
  type: string;
  responsable_id: string | null;
  solde_initial: number;
  solde_actuel: number;
  devise: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  responsable?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

interface CaisseMouvement {
  id: string;
  caisse_id: string;
  type: string;
  montant: number;
  solde_avant: number;
  solde_apres: number;
  reference: string;
  motif: string;
  observations: string | null;
  da_id: string | null;
  note_frais_id: string | null;
  payment_class: 'REGLEMENT' | 'DEPENSE' | null;
  created_at: string;
  created_by: string;
  created_by_profile?: {
    first_name: string | null;
    last_name: string | null;
  };
}

const PAYMENT_CLASS_COLORS: Record<string, string> = {
  REGLEMENT: 'bg-blue-100 text-blue-700',
  DEPENSE: 'bg-purple-100 text-purple-700',
};

const PAYMENT_CLASS_LABELS: Record<string, string> = {
  REGLEMENT: 'Règlement',
  DEPENSE: 'Dépenses',
};

const TYPE_LABELS: Record<string, string> = {
  principale: 'Principale',
  logistique: 'Logistique',
  chantier: 'Chantier',
  projet: 'Projet',
};

const TYPE_COLORS: Record<string, string> = {
  principale: 'bg-primary/20 text-primary',
  logistique: 'bg-blue-500/20 text-blue-700',
  chantier: 'bg-orange-500/20 text-orange-700',
  projet: 'bg-green-500/20 text-green-700',
};

const MOUVEMENT_COLORS: Record<string, string> = {
  entree: 'text-green-600 bg-green-50',
  sortie: 'text-red-600 bg-red-50',
  ajustement: 'text-blue-600 bg-blue-50',
};

const MOUVEMENT_ICONS: Record<string, React.ElementType> = {
  entree: ArrowUpCircle,
  sortie: ArrowDownCircle,
  ajustement: Minus,
};

export default function CaisseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { roles, isLoading: authLoading } = useAuth();
  const [caisse, setCaisse] = useState<Caisse | null>(null);
  const [mouvements, setMouvements] = useState<CaisseMouvement[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentClassFilter, setPaymentClassFilter] = useState<string>('all');

  const canView = roles.some(r => ['admin', 'daf', 'dg', 'comptable'].includes(r));

  useEffect(() => {
    if (!authLoading && canView && id) {
      fetchCaisse();
      fetchMouvements();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, canView, id]);

  const fetchCaisse = async () => {
    try {
      const { data, error } = await supabase
        .from('caisses')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        navigate('/caisse');
        return;
      }

      // Fetch responsable info
      let responsable = undefined;
      if (data.responsable_id) {
        const { data: profileData } = await supabase.rpc('get_public_profiles', {
          _user_ids: [data.responsable_id],
        });
        if (profileData && profileData.length > 0) {
          responsable = profileData[0];
        }
      }

      setCaisse({ ...data, responsable } as Caisse);
    } catch (error) {
      console.error('Error fetching caisse:', error);
      navigate('/caisse');
    }
  };

  const fetchMouvements = async () => {
    try {
      const { data, error } = await supabase
        .from('caisse_mouvements')
        .select('*')
        .eq('caisse_id', id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch created_by profiles
      const creatorIds = [...new Set((data || []).map(m => m.created_by).filter(Boolean))];
      if (creatorIds.length > 0) {
        const { data: profilesData } = await supabase.rpc('get_public_profiles', {
          _user_ids: creatorIds,
        });
        const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
        const mouvementsWithProfiles = (data || []).map(m => ({
          ...m,
          created_by_profile: profilesMap.get(m.created_by),
        }));
        setMouvements(mouvementsWithProfiles);
      } else {
        setMouvements(data || []);
      }
    } catch (error) {
      console.error('Error fetching mouvements:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (amount: number, devise: string = 'XOF') => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' ' + devise;
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!canView) {
    return <AppLayout><AccessDenied /></AppLayout>;
  }

  if (!caisse) {
    return (
      <AppLayout>
        <div className="text-center py-12 text-muted-foreground">
          Caisse introuvable
        </div>
      </AppLayout>
    );
  }

  const soldeVariation = caisse.solde_actuel - caisse.solde_initial;
  const variationPercent = caisse.solde_initial !== 0 
    ? ((soldeVariation / caisse.solde_initial) * 100).toFixed(1) 
    : '0';

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/caisse">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Wallet className="h-6 w-6" />
              <h1 className="text-2xl font-bold">{caisse.name}</h1>
              <Badge className={TYPE_COLORS[caisse.type]}>
                {TYPE_LABELS[caisse.type]}
              </Badge>
              <Badge variant={caisse.is_active ? 'default' : 'secondary'}>
                {caisse.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-muted-foreground font-mono">{caisse.code}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Solde Initial</p>
                  <p className="text-xl font-bold font-mono">
                    {formatMoney(caisse.solde_initial, caisse.devise)}
                  </p>
                </div>
                <Wallet className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Solde Actuel</p>
                  <p className={`text-xl font-bold font-mono ${caisse.solde_actuel >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatMoney(caisse.solde_actuel, caisse.devise)}
                  </p>
                </div>
                {caisse.solde_actuel >= caisse.solde_initial ? (
                  <TrendingUp className="h-8 w-8 text-green-500" />
                ) : (
                  <TrendingDown className="h-8 w-8 text-red-500" />
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Variation</p>
                  <p className={`text-xl font-bold font-mono ${soldeVariation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {soldeVariation >= 0 ? '+' : ''}{formatMoney(soldeVariation, caisse.devise)}
                  </p>
                  <p className="text-xs text-muted-foreground">({variationPercent}%)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Mouvements</p>
                  <p className="text-xl font-bold">{mouvements.length}</p>
                </div>
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info */}
        {(caisse.description || caisse.responsable) && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {caisse.responsable && (
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Responsable</p>
                      <p className="font-medium">
                        {caisse.responsable.first_name} {caisse.responsable.last_name}
                      </p>
                    </div>
                  </div>
                )}
                {caisse.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p>{caisse.description}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mouvements */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Historique des Mouvements</CardTitle>
              <CardDescription>Les 100 derniers mouvements de cette caisse</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={paymentClassFilter} onValueChange={setPaymentClassFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filtrer par classe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les classes</SelectItem>
                  <SelectItem value="REGLEMENT">Règlement</SelectItem>
                  <SelectItem value="DEPENSE">Dépenses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right">Solde après</TableHead>
                  <TableHead>Par</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const filteredMouvements = paymentClassFilter === 'all' 
                    ? mouvements 
                    : mouvements.filter(m => m.payment_class === paymentClassFilter);
                  
                  if (filteredMouvements.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          {paymentClassFilter !== 'all' ? 'Aucun mouvement pour cette classe' : 'Aucun mouvement enregistré'}
                        </TableCell>
                      </TableRow>
                    );
                  }
                  
                  return filteredMouvements.map((mouvement) => {
                    const Icon = MOUVEMENT_ICONS[mouvement.type] || Minus;
                    return (
                      <TableRow key={mouvement.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(mouvement.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <Badge className={MOUVEMENT_COLORS[mouvement.type]}>
                            <Icon className="h-3 w-3 mr-1" />
                            {mouvement.type.charAt(0).toUpperCase() + mouvement.type.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {mouvement.payment_class ? (
                            <Badge className={PAYMENT_CLASS_COLORS[mouvement.payment_class]}>
                              {PAYMENT_CLASS_LABELS[mouvement.payment_class]}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {mouvement.reference}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={mouvement.motif}>
                          {mouvement.motif}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${mouvement.type === 'sortie' ? 'text-red-600' : 'text-green-600'}`}>
                          {mouvement.type === 'sortie' ? '-' : '+'}{formatMoney(mouvement.montant, caisse.devise)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(mouvement.solde_apres, caisse.devise)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {mouvement.created_by_profile 
                            ? `${mouvement.created_by_profile.first_name || ''} ${mouvement.created_by_profile.last_name || ''}`.trim()
                            : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
