import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { BonLivraison, BL_STATUS_LABELS, BLStatus } from '@/types/kpm';
import { Package, Search, Clock, CheckCircle, Truck, FileCheck, AlertTriangle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const statusColors: Record<BLStatus, string> = {
  prepare: 'bg-muted text-muted-foreground',
  en_attente_validation: 'bg-warning/10 text-warning border-warning/20',
  valide: 'bg-primary/10 text-primary border-primary/20',
  livre: 'bg-success/10 text-success border-success/20',
  livree_partiellement: 'bg-warning/10 text-warning border-warning/20',
  refusee: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusIcons: Record<BLStatus, React.ElementType> = {
  prepare: Clock,
  en_attente_validation: FileCheck,
  valide: CheckCircle,
  livre: Truck,
  livree_partiellement: AlertTriangle,
  refusee: XCircle,
};

export default function BLList() {
  const { roles, isAdmin } = useAuth();
  const { toast } = useToast();

  const [bons, setBons] = useState<BonLivraison[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const isLogistics = roles.some((r) => ['responsable_logistique', 'agent_logistique'].includes(r));
  const isDG = roles.includes('dg');

  useEffect(() => {
    fetchBons();
  }, []);

  const fetchBons = async () => {
    try {
      const { data, error } = await supabase
        .from('bons_livraison')
        .select(`
          *,
          department:departments(id, name),
          created_by_profile:profiles!bons_livraison_created_by_fkey(id, first_name, last_name),
          besoin:besoins(id, title)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBons((data as BonLivraison[]) || []);
    } catch (error: any) {
      console.error('Error fetching BL:', error);
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredBons = bons.filter((bl) => {
    const matchesSearch =
      bl.reference.toLowerCase().includes(search.toLowerCase()) ||
      (bl.warehouse || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || bl.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Bons de Livraison
            </h1>
            <p className="text-muted-foreground">
              Gérez les livraisons depuis le stock existant
            </p>
          </div>
        </div>

        {/* Info banner */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 py-4">
            <Package className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">Livraison interne</p>
              <p className="text-sm text-muted-foreground">
                Un BL est créé lorsqu'un Besoin peut être satisfait depuis le stock existant, sans achat externe.
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
                  placeholder="Rechercher par référence ou magasin..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {(Object.keys(BL_STATUS_LABELS) as BLStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {BL_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              {filteredBons.length} bon{filteredBons.length !== 1 ? 's' : ''} de livraison
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredBons.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Aucun bon de livraison trouvé.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Référence</TableHead>
                      <TableHead>Besoin source</TableHead>
                      <TableHead>Département</TableHead>
                      <TableHead>Magasin</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBons.map((bl) => {
                      const StatusIcon = statusIcons[bl.status];
                      return (
                        <TableRow key={bl.id}>
                          <TableCell className="font-medium">{bl.reference}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {(bl.besoin as any)?.title || 'N/A'}
                          </TableCell>
                          <TableCell>{bl.department?.name || 'N/A'}</TableCell>
                          <TableCell>{bl.warehouse || '-'}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[bl.status]}>
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {BL_STATUS_LABELS[bl.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(bl.created_at), 'dd MMM yyyy', { locale: fr })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link to={`/bons-livraison/${bl.id}`}>
                              <Button variant="ghost" size="sm">
                                Voir
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
