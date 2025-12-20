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
import { useToast } from '@/hooks/use-toast';
import { DemandeAchat, DA_STATUS_LABELS, DAStatus } from '@/types/kpm';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { BookOpen, Search, ShieldCheck, Banknote, BookX, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const statusColors: Record<string, string> = {
  validee_finance: 'bg-success text-success-foreground',
  payee: 'bg-success text-success-foreground',
  rejetee_comptabilite: 'bg-destructive text-destructive-foreground',
};

const statusIcons: Record<string, React.ElementType> = {
  validee_finance: ShieldCheck,
  payee: Banknote,
  rejetee_comptabilite: BookX,
};

export default function Comptabilite() {
  const { roles, isAdmin } = useAuth();
  const { toast } = useToast();

  const [demandes, setDemandes] = useState<DemandeAchat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('validee_finance');

  const isComptable = roles.includes('comptable');
  const isDG = roles.includes('dg');
  const isDAF = roles.includes('daf');
  const canAccess = isComptable || isAdmin || isDG || isDAF;

  useEffect(() => {
    if (canAccess) {
      fetchDemandes();
    } else {
      setIsLoading(false);
    }
  }, [canAccess]);

  const fetchDemandes = async () => {
    try {
      const { data, error } = await supabase
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

      if (error) throw error;
      setDemandes((data as DemandeAchat[]) || []);
    } catch (error: any) {
      console.error('Error fetching DA:', error);
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

  const filteredDemandes = demandes.filter((da) => {
    const matchesSearch =
      da.reference.toLowerCase().includes(search.toLowerCase()) ||
      da.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || da.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = demandes.filter((da) => da.status === 'validee_finance').length;
  const paidCount = demandes.filter((da) => da.status === 'payee').length;
  const totalPending = demandes
    .filter((da) => da.status === 'validee_finance')
    .reduce((sum, da) => sum + (da.total_amount || 0), 0);

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
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="rounded-full bg-warning/10 p-3">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">DA à traiter</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-success/50 bg-success/5">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="rounded-full bg-success/10 p-3">
                <Banknote className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{paidCount}</p>
                <p className="text-sm text-muted-foreground">DA payées</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="rounded-full bg-primary/10 p-3">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalPending.toLocaleString()} XOF</p>
                <p className="text-sm text-muted-foreground">Montant en attente</p>
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
                Rattachez les DA au plan comptable SYSCOHADA avant de déclencher le paiement. 
                Toute écriture validée est irréversible.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Filtres</CardTitle>
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
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

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              {filteredDemandes.length} demande{filteredDemandes.length !== 1 ? 's' : ''}
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
                      const StatusIcon = statusIcons[da.status] || ShieldCheck;
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
                            <Badge className={statusColors[da.status] || 'bg-muted'}>
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
      </div>
    </AppLayout>
  );
}
