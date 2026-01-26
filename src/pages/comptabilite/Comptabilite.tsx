import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { DemandeAchat, DA_STATUS_LABELS, DAStatus, NoteFrais, NoteFraisStatus, NOTE_FRAIS_STATUS_LABELS } from '@/types/kpm';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { BookOpen, Search, ShieldCheck, Banknote, BookX, AlertTriangle, Receipt, CreditCard, Wallet, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const daStatusColors: Record<string, string> = {
  validee_finance: 'bg-warning/10 text-warning border-warning/20',
  payee: 'bg-success/10 text-success border-success/20',
  rejetee_comptabilite: 'bg-destructive/10 text-destructive border-destructive/20',
};

const daStatusIcons: Record<string, React.ElementType> = {
  validee_finance: ShieldCheck,
  payee: Banknote,
  rejetee_comptabilite: BookX,
};

const ndfStatusColors: Record<NoteFraisStatus, string> = {
  brouillon: 'bg-muted text-muted-foreground',
  soumise: 'bg-warning/10 text-warning border-warning/20',
  validee_daf: 'bg-primary/10 text-primary border-primary/20',
  payee: 'bg-success/10 text-success border-success/20',
  rejetee: 'bg-destructive/10 text-destructive border-destructive/20',
};

const ndfStatusIcons: Record<NoteFraisStatus, React.ElementType> = {
  brouillon: AlertTriangle,
  soumise: ShieldCheck,
  validee_daf: CheckCircle,
  payee: Wallet,
  rejetee: BookX,
};

export default function Comptabilite() {
  const { roles, isAdmin } = useAuth();
  const { toast } = useToast();

  const [demandes, setDemandes] = useState<DemandeAchat[]>([]);
  const [notesFrais, setNotesFrais] = useState<NoteFrais[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [daStatusFilter, setDaStatusFilter] = useState<string>('validee_finance');
  const [ndfStatusFilter, setNdfStatusFilter] = useState<string>('validee_daf');
  const [activeTab, setActiveTab] = useState<string>('da');

  const isComptable = roles.includes('comptable');
  const isDG = roles.includes('dg');
  const isDAF = roles.includes('daf');
  const canAccess = isComptable || isAdmin || isDG || isDAF;

  useEffect(() => {
    if (canAccess) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [canAccess]);

  const fetchData = async () => {
    try {
      // Fetch DA
      const { data: daData, error: daError } = await supabase
        .from('demandes_achat')
        .select(`
          *,
          department:departments(id, name),
          created_by_profile:profiles!demandes_achat_created_by_fkey(id, first_name, last_name),
          selected_fournisseur:fournisseurs(id, name),
          besoin:besoins(id, title)
        `)
        .in('status', ['validee_finance', 'payee', 'rejetee_comptabilite'])
        .order('created_at', { ascending: false });

      if (daError) throw daError;
      setDemandes((daData as unknown as DemandeAchat[]) || []);

      // Fetch Notes de Frais (validee_daf and payee)
      const { data: ndfData, error: ndfError } = await supabase
        .from('notes_frais')
        .select(`
          *,
          user:profiles!notes_frais_user_id_fkey(id, first_name, last_name, email),
          department:departments(id, name),
          projet:projets(id, code, name)
        `)
        .in('status', ['validee_daf', 'payee'])
        .order('created_at', { ascending: false });

      if (ndfError) throw ndfError;
      setNotesFrais((ndfData as unknown as NoteFrais[]) || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!canAccess) {
    return (
      <AppLayout>
        <AccessDenied />
      </AppLayout>
    );
  }

  // DA filtering
  const filteredDemandes = demandes.filter((da) => {
    const matchesSearch =
      da.reference.toLowerCase().includes(search.toLowerCase()) ||
      da.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = daStatusFilter === 'all' || da.status === daStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // NDF filtering
  const filteredNotesFrais = notesFrais.filter((ndf) => {
    const matchesSearch =
      ndf.reference.toLowerCase().includes(search.toLowerCase()) ||
      ndf.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = ndfStatusFilter === 'all' || ndf.status === ndfStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Statistics
  const daPendingCount = demandes.filter((da) => da.status === 'validee_finance').length;
  const daPaidCount = demandes.filter((da) => da.status === 'payee').length;
  const daTotalPending = demandes
    .filter((da) => da.status === 'validee_finance')
    .reduce((sum, da) => sum + (da.total_amount || 0), 0);

  const ndfPendingCount = notesFrais.filter((ndf) => ndf.status === 'validee_daf').length;
  const ndfPaidCount = notesFrais.filter((ndf) => ndf.status === 'payee').length;
  const ndfTotalPending = notesFrais
    .filter((ndf) => ndf.status === 'validee_daf')
    .reduce((sum, ndf) => sum + (ndf.total_amount || 0), 0);

  const totalPending = daTotalPending + ndfTotalPending;
  const totalPendingCount = daPendingCount + ndfPendingCount;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Comptabilité & SYSCOHADA
            </h1>
            <p className="text-muted-foreground">
              Rattachement comptable et exécution des paiements
            </p>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="rounded-full bg-warning/10 p-3">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalPendingCount}</p>
                <p className="text-sm text-muted-foreground">À traiter</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="rounded-full bg-primary/10 p-3">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{daPendingCount}</p>
                <p className="text-sm text-muted-foreground">DA à payer</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-purple-500/50 bg-purple-500/5">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="rounded-full bg-purple-500/10 p-3">
                <Receipt className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{ndfPendingCount}</p>
                <p className="text-sm text-muted-foreground">Notes à payer</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-success/50 bg-success/5">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="rounded-full bg-success/10 p-3">
                <BookOpen className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.ceil(totalPending).toLocaleString()} XOF</p>
                <p className="text-sm text-muted-foreground">Montant total</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info banner */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 py-4">
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">Module d'exécution comptable</p>
              <p className="text-sm text-muted-foreground">
                Rattachez les DA et Notes de Frais au plan comptable SYSCOHADA avant de déclencher le paiement. 
                Toute écriture validée est irréversible.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for DA and Notes de Frais */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
            <TabsTrigger value="da" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Demandes d'Achat
              {daPendingCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {daPendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ndf" className="gap-2">
              <Receipt className="h-4 w-4" />
              Notes de Frais
              {ndfPendingCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {ndfPendingCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* DA Tab */}
          <TabsContent value="da" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Filtres DA</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher par référence..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={daStatusFilter} onValueChange={setDaStatusFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="validee_finance">À traiter</SelectItem>
                      <SelectItem value="payee">Payées</SelectItem>
                      <SelectItem value="rejetee_comptabilite">Rejetées</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* DA Table */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {filteredDemandes.length} demande{filteredDemandes.length !== 1 ? 's' : ''} d'achat
                </CardTitle>
                <CardDescription>
                  {isComptable 
                    ? 'Cliquez sur une DA pour procéder au rattachement comptable et au paiement.' 
                    : 'Vue en lecture seule des opérations comptables.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                ) : filteredDemandes.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    Aucune demande à afficher.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Référence</TableHead>
                          <TableHead>Fournisseur</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Validée le</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDemandes.map((da) => {
                          const StatusIcon = daStatusIcons[da.status] || ShieldCheck;
                          return (
                            <TableRow key={da.id}>
                              <TableCell className="font-medium">{da.reference}</TableCell>
                              <TableCell>
                                {(da.selected_fournisseur as any)?.name || 'N/A'}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {da.total_amount?.toLocaleString()} {da.currency}
                              </TableCell>
                              <TableCell>
                                <Badge className={daStatusColors[da.status] || 'bg-muted'}>
                                  <StatusIcon className="mr-1 h-3 w-3" />
                                  {DA_STATUS_LABELS[da.status as DAStatus]}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {da.validated_finance_at 
                                  ? format(new Date(da.validated_finance_at), 'dd MMM yyyy', { locale: fr })
                                  : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                <Link to={`/comptabilite/${da.id}`}>
                                  <Button variant={da.status === 'validee_finance' ? 'default' : 'ghost'} size="sm">
                                    {da.status === 'validee_finance' ? 'Traiter' : 'Voir'}
                                  </Button>
                                </Link>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notes de Frais Tab */}
          <TabsContent value="ndf" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Filtres Notes de Frais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher par référence ou titre..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={ndfStatusFilter} onValueChange={setNdfStatusFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="validee_daf">À payer</SelectItem>
                      <SelectItem value="payee">Payées</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* NDF Table */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {filteredNotesFrais.length} note{filteredNotesFrais.length !== 1 ? 's' : ''} de frais
                </CardTitle>
                <CardDescription>
                  {isComptable 
                    ? 'Cliquez sur une note pour procéder au paiement.' 
                    : 'Vue en lecture seule des notes de frais.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                ) : filteredNotesFrais.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    Aucune note de frais à afficher.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Référence</TableHead>
                          <TableHead>Titre</TableHead>
                          <TableHead>Demandeur</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Validée le</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredNotesFrais.map((ndf) => {
                          const StatusIcon = ndfStatusIcons[ndf.status] || CheckCircle;
                          return (
                            <TableRow key={ndf.id}>
                              <TableCell className="font-mono font-medium">{ndf.reference}</TableCell>
                              <TableCell>{ndf.title}</TableCell>
                              <TableCell>
                                {ndf.user?.first_name} {ndf.user?.last_name}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {Math.ceil(ndf.total_amount).toLocaleString()} {ndf.currency}
                              </TableCell>
                              <TableCell>
                                <Badge className={ndfStatusColors[ndf.status] || 'bg-muted'}>
                                  <StatusIcon className="mr-1 h-3 w-3" />
                                  {NOTE_FRAIS_STATUS_LABELS[ndf.status]}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {ndf.validated_daf_at 
                                  ? format(new Date(ndf.validated_daf_at), 'dd MMM yyyy', { locale: fr })
                                  : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                <Link to={`/notes-frais/${ndf.id}`}>
                                  <Button variant={ndf.status === 'validee_daf' ? 'default' : 'ghost'} size="sm">
                                    {ndf.status === 'validee_daf' ? 'Payer' : 'Voir'}
                                  </Button>
                                </Link>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
