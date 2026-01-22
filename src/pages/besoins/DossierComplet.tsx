import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, FileText, ShoppingCart, Truck, CreditCard,
  CheckCircle, Clock, XCircle, AlertTriangle, ExternalLink,
  User, Building2, Calendar, Package
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TimelineStep {
  id: string;
  type: 'besoin' | 'da' | 'bl' | 'paiement';
  title: string;
  status: 'completed' | 'current' | 'pending' | 'rejected';
  date?: string;
  reference?: string;
  link?: string;
  details?: Record<string, any>;
}

interface DossierData {
  besoin: any;
  da: any | null;
  bl: any | null;
  ecritures: any[];
}

const STATUS_CONFIG = {
  completed: {
    icon: CheckCircle,
    color: 'text-success',
    bgColor: 'bg-success',
    borderColor: 'border-success',
  },
  current: {
    icon: Clock,
    color: 'text-primary',
    bgColor: 'bg-primary',
    borderColor: 'border-primary',
  },
  pending: {
    icon: Clock,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    borderColor: 'border-muted',
  },
  rejected: {
    icon: XCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive',
    borderColor: 'border-destructive',
  },
};

export default function DossierComplet() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DossierData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDossier = async () => {
      if (!id) return;

      setIsLoading(true);
      setError(null);

      try {
        // Fetch besoin
        const { data: besoin, error: besoinError } = await supabase
          .from('besoins')
          .select(`
            *,
            user:profiles!besoins_user_id_fkey(first_name, last_name, email),
            department:departments(name),
            taken_by_user:profiles!besoins_taken_by_fkey(first_name, last_name),
            decided_by_user:profiles!besoins_decided_by_fkey(first_name, last_name)
          `)
          .eq('id', id)
          .maybeSingle();

        if (besoinError) throw besoinError;
        if (!besoin) {
          setError('Dossier non trouvé');
          setIsLoading(false);
          return;
        }

        // Fetch related DA
        const { data: da } = await supabase
          .from('demandes_achat')
          .select(`
            *,
            created_by_user:profiles!demandes_achat_created_by_fkey(first_name, last_name),
            fournisseur:fournisseurs(name)
          `)
          .eq('besoin_id', id)
          .maybeSingle();

        // Fetch related BL
        const { data: bl } = await supabase
          .from('bons_livraison')
          .select(`
            *,
            created_by_user:profiles!bons_livraison_created_by_fkey(first_name, last_name),
            delivered_by_user:profiles!bons_livraison_delivered_by_fkey(first_name, last_name)
          `)
          .eq('besoin_id', id)
          .maybeSingle();

        // Fetch related ecritures if DA exists
        let ecritures: any[] = [];
        if (da) {
          const { data: ecrituresData } = await supabase
            .from('ecritures_comptables')
            .select('*')
            .eq('da_id', da.id)
            .order('created_at', { ascending: true });
          ecritures = ecrituresData || [];
        }

        setData({ besoin, da, bl, ecritures });
      } catch (err) {
        console.error('Error fetching dossier:', err);
        setError('Erreur lors du chargement du dossier');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDossier();
  }, [id]);

  const buildTimeline = (): TimelineStep[] => {
    if (!data) return [];

    const steps: TimelineStep[] = [];
    const { besoin, da, bl, ecritures } = data;

    // Step 1: Besoin
    const besoinStatus = besoin.status === 'refuse' ? 'rejected' 
      : besoin.status === 'accepte' ? 'completed'
      : 'current';
    
    steps.push({
      id: 'besoin',
      type: 'besoin',
      title: 'Besoin interne',
      status: besoinStatus,
      date: besoin.created_at,
      reference: besoin.title,
      link: `/besoins/${besoin.id}`,
      details: {
        demandeur: `${besoin.user?.first_name || ''} ${besoin.user?.last_name || ''}`.trim(),
        departement: besoin.department?.name,
        categorie: besoin.category,
        urgence: besoin.urgency,
        statut: besoin.status,
      },
    });

    // Step 2: DA (if exists)
    if (da) {
      const daStatus = da.status === 'payee' ? 'completed'
        : ['rejetee', 'refusee_finance', 'rejetee_comptabilite'].includes(da.status) ? 'rejected'
        : ['validee_finance', 'soumise_validation', 'chiffree'].includes(da.status) ? 'current'
        : da.status === 'brouillon' ? 'pending'
        : 'current';

      steps.push({
        id: 'da',
        type: 'da',
        title: 'Demande d\'achat',
        status: daStatus,
        date: da.created_at,
        reference: da.reference,
        link: `/demandes-achat/${da.id}`,
        details: {
          createur: `${da.created_by_user?.first_name || ''} ${da.created_by_user?.last_name || ''}`.trim(),
          fournisseur: da.fournisseur?.name || 'Non sélectionné',
          montant: da.total_amount ? `${da.total_amount.toLocaleString('fr-FR')} ${da.currency || 'XOF'}` : '-',
          statut: da.status,
        },
      });
    } else if (besoin.status === 'accepte') {
      steps.push({
        id: 'da',
        type: 'da',
        title: 'Demande d\'achat',
        status: 'pending',
        details: { message: 'En attente de création' },
      });
    }

    // Step 3: BL (if exists)
    if (bl) {
      const blStatus = bl.status === 'livre' ? 'completed'
        : bl.status === 'refusee' ? 'rejected'
        : bl.status === 'livree_partiellement' ? 'current'
        : 'current';

      steps.push({
        id: 'bl',
        type: 'bl',
        title: 'Bon de livraison',
        status: blStatus,
        date: bl.created_at,
        reference: bl.reference,
        link: `/bons-livraison/${bl.id}`,
        details: {
          type: bl.bl_type === 'interne' ? 'Stock interne' : 'Fournisseur',
          livreur: bl.delivered_by_user 
            ? `${bl.delivered_by_user.first_name || ''} ${bl.delivered_by_user.last_name || ''}`.trim()
            : '-',
          dateLivraison: bl.delivered_at ? format(new Date(bl.delivered_at), 'dd MMM yyyy', { locale: fr }) : '-',
          statut: bl.status,
        },
      });
    } else if (da && ['validee_finance', 'payee'].includes(da.status)) {
      steps.push({
        id: 'bl',
        type: 'bl',
        title: 'Bon de livraison',
        status: 'pending',
        details: { message: 'En attente de réception' },
      });
    }

    // Step 4: Paiement (if DA payée)
    if (da?.status === 'payee') {
      const lastEcriture = ecritures[ecritures.length - 1];
      steps.push({
        id: 'paiement',
        type: 'paiement',
        title: 'Paiement',
        status: 'completed',
        date: da.comptabilise_at || lastEcriture?.created_at,
        reference: lastEcriture?.reference,
        link: da ? `/comptabilite/${da.id}` : undefined,
        details: {
          montant: `${da.total_amount?.toLocaleString('fr-FR')} ${da.currency || 'XOF'}`,
          modePaiement: da.mode_paiement || '-',
          reference: da.reference_paiement || '-',
          ecritures: ecritures.length,
        },
      });
    } else if (da?.status === 'validee_finance') {
      steps.push({
        id: 'paiement',
        type: 'paiement',
        title: 'Paiement',
        status: 'current',
        details: { message: 'En attente de paiement' },
      });
    }

    return steps;
  };

  const getStepIcon = (type: TimelineStep['type']) => {
    switch (type) {
      case 'besoin': return FileText;
      case 'da': return ShoppingCart;
      case 'bl': return Truck;
      case 'paiement': return CreditCard;
      default: return FileText;
    }
  };

  // ARRONDI COMPTABLE DAF: arrondi au supérieur pour les montants
  const formatMontant = (value: number | null | undefined, currency = 'XOF') => {
    if (!value) return '-';
    const rounded = Math.ceil(value);
    return new Intl.NumberFormat('fr-FR').format(rounded) + ' ' + currency;
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout>
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <p className="text-lg font-medium">{error || 'Dossier non trouvé'}</p>
          <Button asChild variant="outline">
            <Link to="/besoins">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux besoins
            </Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const timeline = buildTimeline();
  const { besoin, da, bl, ecritures } = data;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Link to="/besoins" className="hover:text-foreground">Besoins</Link>
              <span>/</span>
              <span>Dossier complet</span>
            </div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              {besoin.title}
            </h1>
            <p className="text-muted-foreground">
              Suivi complet du dossier : Besoin → DA → Livraison → Paiement
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to={`/besoins/${id}`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Voir le besoin
            </Link>
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Demandeur</p>
                  <p className="font-medium">
                    {besoin.user?.first_name} {besoin.user?.last_name}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Département</p>
                  <p className="font-medium">{besoin.department?.name || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Montant total</p>
                  <p className="font-medium">
                    {formatMontant(da?.total_amount, da?.currency)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10 text-warning">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date création</p>
                  <p className="font-medium">
                    {format(new Date(besoin.created_at), 'dd MMM yyyy', { locale: fr })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Progression du dossier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {timeline.map((step, index) => {
                const Icon = getStepIcon(step.type);
                const StatusIcon = STATUS_CONFIG[step.status].icon;
                const isLast = index === timeline.length - 1;

                return (
                  <div key={step.id} className="relative flex gap-4 pb-8">
                    {/* Vertical line */}
                    {!isLast && (
                      <div
                        className={cn(
                          'absolute left-5 top-10 h-full w-0.5',
                          step.status === 'completed' ? 'bg-success' : 'bg-border'
                        )}
                      />
                    )}

                    {/* Step icon */}
                    <div
                      className={cn(
                        'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2',
                        STATUS_CONFIG[step.status].borderColor,
                        step.status === 'pending' ? 'bg-background' : STATUS_CONFIG[step.status].bgColor
                      )}
                    >
                      <Icon className={cn(
                        'h-5 w-5',
                        step.status === 'pending' ? 'text-muted-foreground' : 'text-white'
                      )} />
                    </div>

                    {/* Step content */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{step.title}</h4>
                            <StatusIcon className={cn('h-4 w-4', STATUS_CONFIG[step.status].color)} />
                          </div>
                          {step.reference && (
                            <p className="text-sm text-muted-foreground">{step.reference}</p>
                          )}
                        </div>
                        {step.date && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(step.date), 'dd MMM yyyy HH:mm', { locale: fr })}
                          </span>
                        )}
                      </div>

                      {/* Step details */}
                      {step.details && (
                        <div className="rounded-md border bg-muted/30 p-3">
                          {step.details.message ? (
                            <p className="text-sm text-muted-foreground italic">
                              {step.details.message}
                            </p>
                          ) : (
                            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                              {Object.entries(step.details).map(([key, value]) => (
                                <div key={key}>
                                  <span className="text-muted-foreground capitalize">
                                    {key.replace(/([A-Z])/g, ' $1').trim()}:
                                  </span>{' '}
                                  <span className="font-medium">{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action link */}
                      {step.link && (
                        <Link
                          to={step.link}
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          Voir le détail
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Detailed sections */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* DA Details */}
          {da && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Demande d'achat
                </CardTitle>
                <Badge variant={da.status === 'payee' ? 'default' : 'secondary'}>
                  {da.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Référence</span>
                    <span className="font-medium">{da.reference}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fournisseur</span>
                    <span className="font-medium">{da.fournisseur?.name || '-'}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Montant</span>
                    <span className="font-medium text-primary">
                      {formatMontant(da.total_amount, da.currency)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mode paiement</span>
                    <span className="font-medium">{da.mode_paiement || '-'}</span>
                  </div>
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link to={`/demandes-achat/${da.id}`}>
                    Voir la DA complète
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* BL Details */}
          {bl && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Bon de livraison
                </CardTitle>
                <Badge variant={bl.status === 'livre' ? 'default' : 'secondary'}>
                  {bl.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Référence</span>
                    <span className="font-medium">{bl.reference}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">
                      {bl.bl_type === 'interne' ? 'Stock interne' : 'Fournisseur'}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date livraison</span>
                    <span className="font-medium">
                      {bl.delivered_at 
                        ? format(new Date(bl.delivered_at), 'dd MMM yyyy', { locale: fr })
                        : '-'
                      }
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Entrepôt</span>
                    <span className="font-medium">{bl.warehouse || '-'}</span>
                  </div>
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link to={`/bons-livraison/${bl.id}`}>
                    Voir le BL complet
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Écritures comptables */}
        {ecritures.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Écritures comptables ({ecritures.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-2 text-left font-medium">Référence</th>
                      <th className="pb-2 text-left font-medium">Compte</th>
                      <th className="pb-2 text-left font-medium">Libellé</th>
                      <th className="pb-2 text-right font-medium">Débit</th>
                      <th className="pb-2 text-right font-medium">Crédit</th>
                      <th className="pb-2 text-left font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ecritures.map((ecriture) => (
                      <tr key={ecriture.id} className="border-b last:border-0">
                        <td className="py-2 font-mono text-xs">{ecriture.reference}</td>
                        <td className="py-2">{ecriture.compte_comptable}</td>
                        <td className="py-2">{ecriture.libelle}</td>
                        <td className="py-2 text-right">
                          {ecriture.debit > 0 ? formatMontant(ecriture.debit, ecriture.devise) : '-'}
                        </td>
                        <td className="py-2 text-right">
                          {ecriture.credit > 0 ? formatMontant(ecriture.credit, ecriture.devise) : '-'}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {format(new Date(ecriture.date_ecriture), 'dd/MM/yyyy', { locale: fr })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
