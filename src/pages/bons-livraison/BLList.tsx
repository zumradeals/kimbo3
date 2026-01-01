import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { BonLivraison, BL_STATUS_LABELS, BLStatus } from '@/types/kpm';
import { Package, Search, Clock, CheckCircle, Truck, FileCheck, AlertTriangle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { useDebounce } from '@/hooks/use-debounce';

const statusColors: Record<BLStatus, string> = {
  prepare: 'bg-muted text-muted-foreground',
  en_attente_validation: 'bg-warning/10 text-warning border-warning/20',
  valide: 'bg-primary/10 text-primary border-primary/20',
  livre: 'bg-success/10 text-success border-success/20',
  livree_partiellement: 'bg-warning/10 text-warning border-warning/20',
  refusee: 'bg-destructive/10 text-destructive border-destructive/20',
  annulee: 'bg-muted text-muted-foreground line-through',
};

const statusIcons: Record<BLStatus, React.ElementType> = {
  prepare: Clock,
  en_attente_validation: FileCheck,
  valide: CheckCircle,
  livre: Truck,
  livree_partiellement: AlertTriangle,
  refusee: XCircle,
  annulee: XCircle,
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function BLList() {
  const { roles, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  const debouncedSearch = useDebounce(search, 300);

  // Fetch function with pagination
  const fetchBons = useCallback(async () => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('bons_livraison')
      .select(`
        *,
        department:departments(id, name),
        created_by_profile:profiles!bons_livraison_created_by_fkey(id, first_name, last_name),
        besoin:besoins(id, title)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    // Apply status filter
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter as BLStatus);
    }

    // Apply search filter
    if (debouncedSearch) {
      query = query.or(`reference.ilike.%${debouncedSearch}%,warehouse.ilike.%${debouncedSearch}%`);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      bons: (data as BonLivraison[]) || [],
      totalCount: count || 0,
    };
  }, [page, pageSize, statusFilter, debouncedSearch]);

  // React Query with cache
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['bons-livraison', page, pageSize, statusFilter, debouncedSearch],
    queryFn: fetchBons,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    placeholderData: (previousData) => previousData,
  });

  // Prefetch next page
  useEffect(() => {
    if (data && page < Math.ceil(data.totalCount / pageSize)) {
      queryClient.prefetchQuery({
        queryKey: ['bons-livraison', page + 1, pageSize, statusFilter, debouncedSearch],
        queryFn: fetchBons,
        staleTime: 5 * 60 * 1000,
      });
    }
  }, [data, page, pageSize, statusFilter, debouncedSearch, queryClient, fetchBons]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch]);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.totalCount / pageSize) : 0;

  if (isLoading) {
    return (
      <AppLayout>
        <ListSkeleton rows={8} columns={7} />
      </AppLayout>
    );
  }

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
              {data?.totalCount || 0} bon{(data?.totalCount || 0) !== 1 ? 's' : ''} de livraison
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.bons.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Aucun bon de livraison trouvé.
              </div>
            ) : (
              <>
                <div className={`overflow-x-auto ${isFetching ? 'opacity-70' : ''}`}>
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
                      {data?.bons.map((bl) => {
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

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="border-t p-4 mt-4">
                    <PaginationControls
                      page={page}
                      totalPages={totalPages}
                      totalCount={data?.totalCount || 0}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={handlePageSizeChange}
                      isLoading={isFetching}
                      pageSizeOptions={PAGE_SIZE_OPTIONS}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
