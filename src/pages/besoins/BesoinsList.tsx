import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Besoin,
  BesoinStatus,
  BESOIN_URGENCY_LABELS,
  BESOIN_STATUS_LABELS,
  ROLES_CAN_CREATE_BESOIN,
} from '@/types/kpm';
import { Plus, Search, Eye, AlertTriangle, Clock, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { useDebounce } from '@/hooks/use-debounce';

const statusIcons: Record<BesoinStatus, React.ElementType> = {
  cree: Clock,
  pris_en_charge: AlertTriangle,
  accepte: CheckCircle,
  refuse: XCircle,
  retourne: RotateCcw,
  annulee: XCircle,
};

const statusColors: Record<BesoinStatus, string> = {
  cree: 'bg-muted text-muted-foreground',
  pris_en_charge: 'bg-warning/10 text-warning',
  accepte: 'bg-success/10 text-success',
  refuse: 'bg-destructive/10 text-destructive',
  retourne: 'bg-orange-500/10 text-orange-600',
  annulee: 'bg-muted text-muted-foreground line-through',
};

const urgencyColors: Record<string, string> = {
  normale: 'bg-muted text-muted-foreground',
  urgente: 'bg-warning/10 text-warning',
  critique: 'bg-destructive/10 text-destructive',
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function BesoinsList() {
  const { roles } = useAuth();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  const debouncedSearch = useDebounce(searchQuery, 300);

  const canCreate = roles.some((r) => ROLES_CAN_CREATE_BESOIN.includes(r));

  // Fetch function with pagination
  const fetchBesoins = useCallback(async () => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('besoins')
      .select(`
        *,
        department:departments(id, name),
        user:profiles!besoins_user_id_fkey(id, first_name, last_name, email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    // Apply status filter
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter as BesoinStatus);
    }

    // Apply search filter
    if (debouncedSearch) {
      query = query.or(`title.ilike.%${debouncedSearch}%,objet_besoin.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      besoins: (data as Besoin[]) || [],
      totalCount: count || 0,
    };
  }, [page, pageSize, statusFilter, debouncedSearch]);

  // React Query with cache
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['besoins', page, pageSize, statusFilter, debouncedSearch],
    queryFn: fetchBesoins,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    placeholderData: (previousData) => previousData,
  });

  // Prefetch next page
  useEffect(() => {
    if (data && page < Math.ceil(data.totalCount / pageSize)) {
      queryClient.prefetchQuery({
        queryKey: ['besoins', page + 1, pageSize, statusFilter, debouncedSearch],
        queryFn: fetchBesoins,
        staleTime: 5 * 60 * 1000,
      });
    }
  }, [data, page, pageSize, statusFilter, debouncedSearch, queryClient, fetchBesoins]);

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
              Besoins internes
            </h1>
            <p className="text-muted-foreground">
              {data?.totalCount || 0} besoin(s) enregistré(s)
            </p>
          </div>
          {canCreate ? (
            <Link to="/besoins/nouveau">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau besoin
              </Button>
            </Link>
          ) : (
            <Button disabled title="Vous n'avez pas les droits pour créer un besoin">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau besoin
            </Button>
          )}
        </div>

        {/* Info banner */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <p className="text-sm text-foreground">
              <strong>Rappel :</strong> Un besoin interne n'engage aucun achat ni paiement. 
              Il s'agit d'une expression formelle transmise à la Logistique.
            </p>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par titre ou description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="cree">Créé</SelectItem>
                <SelectItem value="pris_en_charge">Pris en charge</SelectItem>
                <SelectItem value="accepte">Accepté</SelectItem>
                <SelectItem value="refuse">Refusé</SelectItem>
                <SelectItem value="retourne">Retourné</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {data?.besoins.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {searchQuery || statusFilter !== 'all'
                  ? 'Aucun besoin trouvé avec ces critères.'
                  : 'Aucun besoin enregistré.'}
              </div>
            ) : (
              <>
                <div className={`overflow-x-auto ${isFetching ? 'opacity-70' : ''}`}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Objet</TableHead>
                        <TableHead>Département</TableHead>
                        <TableHead>Site/Projet</TableHead>
                        <TableHead>Urgence</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date création</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.besoins.map((besoin) => {
                        const StatusIcon = statusIcons[besoin.status];
                        return (
                          <TableRow key={besoin.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{besoin.objet_besoin || besoin.title}</p>
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {besoin.site_projet || besoin.description}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {besoin.department?.name || 'N/A'}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {besoin.site_projet || '-'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge className={urgencyColors[besoin.urgency]}>
                                {BESOIN_URGENCY_LABELS[besoin.urgency]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors[besoin.status]}>
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {BESOIN_STATUS_LABELS[besoin.status]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(besoin.created_at), 'dd MMM yyyy', { locale: fr })}
                            </TableCell>
                            <TableCell>
                              <Link to={`/besoins/${besoin.id}`}>
                                <Button variant="ghost" size="icon">
                                  <Eye className="h-4 w-4" />
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
                  <div className="border-t p-4">
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
