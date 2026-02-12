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
import { DemandeAchat, DA_STATUS_LABELS, DA_PRIORITY_LABELS, DAStatus } from '@/types/kpm';
import { FileText, Search, Clock, Send, XCircle, BarChart3, CheckCircle, FileCheck, ShieldCheck, Ban, RotateCcw, Banknote, BookX } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { useDebounce } from '@/hooks/use-debounce';

const statusColors: Record<DAStatus, string> = {
  brouillon: 'bg-muted text-muted-foreground',
  soumise: 'bg-primary/10 text-primary border-primary/20',
  en_analyse: 'bg-warning/10 text-warning border-warning/20',
  chiffree: 'bg-success/10 text-success border-success/20',
  validee_aal: 'bg-accent/10 text-accent-foreground border-accent/20',
  rejetee_aal: 'bg-destructive/10 text-destructive border-destructive/20',
  soumise_validation: 'bg-accent/10 text-accent-foreground border-accent/20',
  validee_finance: 'bg-success text-success-foreground',
  refusee_finance: 'bg-destructive text-destructive-foreground',
  en_revision_achats: 'bg-warning text-warning-foreground',
  rejetee: 'bg-destructive/10 text-destructive border-destructive/20',
  payee: 'bg-success text-success-foreground',
  rejetee_comptabilite: 'bg-destructive text-destructive-foreground',
  annulee: 'bg-muted text-muted-foreground line-through',
};

const statusIcons: Record<DAStatus, React.ElementType> = {
  brouillon: Clock,
  soumise: Send,
  en_analyse: BarChart3,
  chiffree: CheckCircle,
  validee_aal: FileCheck,
  rejetee_aal: XCircle,
  soumise_validation: FileCheck,
  validee_finance: ShieldCheck,
  refusee_finance: Ban,
  en_revision_achats: RotateCcw,
  rejetee: XCircle,
  payee: Banknote,
  rejetee_comptabilite: BookX,
  annulee: XCircle,
};

const priorityColors: Record<string, string> = {
  basse: 'bg-muted text-muted-foreground',
  normale: 'bg-muted text-muted-foreground',
  haute: 'bg-warning/10 text-warning',
  urgente: 'bg-destructive/10 text-destructive',
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function DAList() {
  const { roles, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  const debouncedSearch = useDebounce(search, 300);

  // Fetch function with pagination
  const fetchDemandes = useCallback(async () => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('demandes_achat')
      .select(`
        *,
        department:departments(id, name),
        created_by_profile:profiles!demandes_achat_created_by_fkey(id, first_name, last_name),
        besoin:besoins(id, title)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    // Apply status filter
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter as DAStatus);
    }

    // Apply search filter
    if (debouncedSearch) {
      query = query.or(`reference.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      demandes: (data as unknown as DemandeAchat[]) || [],
      totalCount: count || 0,
    };
  }, [page, pageSize, statusFilter, debouncedSearch]);

  // React Query with cache
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['demandes-achat', page, pageSize, statusFilter, debouncedSearch],
    queryFn: fetchDemandes,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    placeholderData: (previousData) => previousData,
  });

  // Prefetch next page
  useEffect(() => {
    if (data && page < Math.ceil(data.totalCount / pageSize)) {
      queryClient.prefetchQuery({
        queryKey: ['demandes-achat', page + 1, pageSize, statusFilter, debouncedSearch],
        queryFn: fetchDemandes,
        staleTime: 5 * 60 * 1000,
      });
    }
  }, [data, page, pageSize, statusFilter, debouncedSearch, queryClient, fetchDemandes]);

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
              Demandes d'Achat
            </h1>
            <p className="text-muted-foreground">
              Gérez les demandes d'achat issues des besoins internes
            </p>
          </div>
        </div>

        {/* Info banner */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 py-4">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">Document administratif</p>
              <p className="text-sm text-muted-foreground">
                Une DA est créée par la Logistique à partir d'un Besoin accepté. Elle ne contient aucune donnée financière.
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
                  placeholder="Rechercher par référence ou description..."
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
                  {(Object.keys(DA_STATUS_LABELS) as DAStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {DA_STATUS_LABELS[status]}
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
              {data?.totalCount || 0} demande{(data?.totalCount || 0) !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.demandes.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Aucune demande d'achat trouvée.
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
                        <TableHead>Priorité</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.demandes.map((da) => {
                        const StatusIcon = statusIcons[da.status];
                        return (
                          <TableRow key={da.id}>
                            <TableCell className="font-medium">{da.reference}</TableCell>
                            <TableCell className="max-w-xs truncate">
                              {(da.besoin as any)?.title || 'N/A'}
                            </TableCell>
                            <TableCell>{da.department?.name || 'N/A'}</TableCell>
                            <TableCell>
                              <Badge className={priorityColors[da.priority]}>
                                {DA_PRIORITY_LABELS[da.priority]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors[da.status]}>
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {DA_STATUS_LABELS[da.status]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(da.created_at), 'dd MMM yyyy', { locale: fr })}
                            </TableCell>
                            <TableCell className="text-right">
                              <Link to={`/demandes-achat/${da.id}`}>
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
