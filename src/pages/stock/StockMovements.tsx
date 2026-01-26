import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
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
import {
  StockMovement,
  StockMovementType,
  STOCK_MOVEMENT_TYPE_LABELS,
} from '@/types/kpm';
import { EntrepotSelector } from '@/components/stock/EntrepotSelector';
import {
  ArrowLeft,
  Search,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Lock,
  Unlock,
  Warehouse,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const typeColors: Record<StockMovementType, string> = {
  entree: 'bg-success/10 text-success border-success/20',
  sortie: 'bg-destructive/10 text-destructive border-destructive/20',
  ajustement: 'bg-primary/10 text-primary border-primary/20',
  reservation: 'bg-warning/10 text-warning border-warning/20',
  liberation: 'bg-muted text-muted-foreground',
};

const typeIcons: Record<StockMovementType, React.ElementType> = {
  entree: ArrowUpCircle,
  sortie: ArrowDownCircle,
  ajustement: RefreshCw,
  reservation: Lock,
  liberation: Unlock,
};

export default function StockMovements() {
  const { toast } = useToast();

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [entrepotFilter, setEntrepotFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchMovements();
  }, [entrepotFilter]);

  const fetchMovements = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('stock_movements')
        .select(`
          *,
          article_stock:articles_stock(id, designation),
          entrepot:entrepots(id, nom, type),
          created_by_profile:profiles!stock_movements_created_by_fkey(id, first_name, last_name)
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (entrepotFilter) {
        query = query.eq('entrepot_id', entrepotFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setMovements((data as any[]) || []);
    } catch (error: any) {
      console.error('Error fetching movements:', error);
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMovements = movements.filter((mv) => {
    const matchesSearch =
      (mv.article_stock?.designation || '').toLowerCase().includes(search.toLowerCase()) ||
      (mv.reference || '').toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || mv.movement_type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/stock">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Mouvements de Stock
            </h1>
            <p className="text-muted-foreground">
              Historique de tous les mouvements d'inventaire
            </p>
          </div>
        </div>

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
                  placeholder="Rechercher par article ou référence..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Tous les types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {(Object.keys(STOCK_MOVEMENT_TYPE_LABELS) as StockMovementType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {STOCK_MOVEMENT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <EntrepotSelector
                value={entrepotFilter}
                onChange={setEntrepotFilter}
                showAll={true}
                className="w-full sm:w-52"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              {filteredMovements.length} mouvement{filteredMovements.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredMovements.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Aucun mouvement trouvé.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Entrepôt</TableHead>
                      <TableHead>Article</TableHead>
                      <TableHead className="text-right">Quantité</TableHead>
                      <TableHead className="text-right">Avant</TableHead>
                      <TableHead className="text-right">Après</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead>Par</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMovements.map((mv: any) => {
                      const TypeIcon = typeIcons[mv.movement_type as StockMovementType];
                      return (
                        <TableRow key={mv.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(mv.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                          </TableCell>
                          <TableCell>
                            <Badge className={typeColors[mv.movement_type as StockMovementType]}>
                              <TypeIcon className="mr-1 h-3 w-3" />
                              {STOCK_MOVEMENT_TYPE_LABELS[mv.movement_type as StockMovementType]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {mv.entrepot ? (
                              <div className="flex items-center gap-1">
                                <Warehouse className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">{mv.entrepot.nom}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {mv.article_stock?.designation || 'N/A'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {mv.movement_type === 'sortie' ? '-' : '+'}
                            {mv.quantity}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {mv.quantity_before}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {mv.quantity_after}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {mv.reference || '-'}
                          </TableCell>
                          <TableCell>
                            {mv.created_by_profile?.first_name} {mv.created_by_profile?.last_name}
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
