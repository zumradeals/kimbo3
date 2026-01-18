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
import { Plus, Search, Eye, Clock, CheckCircle, XCircle, Info, FileEdit, Send } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { useDebounce } from '@/hooks/use-debounce';
import { UserAvatar } from '@/components/ui/UserAvatar';
import {
  ExpressionBesoinStatus,
  EXPRESSION_STATUS_LABELS,
  EXPRESSION_STATUS_COLORS,
  ExpressionBesoin,
} from '@/types/expression-besoin';

const STATUS_ICONS: Record<ExpressionBesoinStatus, React.ElementType> = {
  brouillon: FileEdit,
  soumis: Clock,
  en_examen: Eye,
  valide_departement: CheckCircle,
  rejete_departement: XCircle,
  envoye_logistique: Send,
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function ExpressionsList() {
  const { profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Check if user is a manager (has subordinates)
  const { data: isManager } = useQuery({
    queryKey: ['is-manager', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return false;
      const { count, error } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('chef_hierarchique_id', profile.id);
      if (error) return false;
      return (count || 0) > 0;
    },
    enabled: !!profile?.id,
  });

  const fetchExpressions = useCallback(async () => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('expressions_besoin')
      .select(`
        *,
        user:profiles!expressions_besoin_user_id_fkey(id, first_name, last_name, photo_url, fonction),
        department:departments(id, name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter as ExpressionBesoinStatus);
    }

    if (debouncedSearch) {
      query = query.ilike('nom_article', `%${debouncedSearch}%`);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      expressions: (data || []) as unknown as ExpressionBesoin[],
      totalCount: count || 0,
    };
  }, [page, pageSize, statusFilter, debouncedSearch]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['expressions-besoin', page, pageSize, statusFilter, debouncedSearch],
    queryFn: fetchExpressions,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    if (data && page < Math.ceil(data.totalCount / pageSize)) {
      queryClient.prefetchQuery({
        queryKey: ['expressions-besoin', page + 1, pageSize, statusFilter, debouncedSearch],
        queryFn: fetchExpressions,
        staleTime: 5 * 60 * 1000,
      });
    }
  }, [data, page, pageSize, statusFilter, debouncedSearch, queryClient, fetchExpressions]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch]);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.totalCount / pageSize) : 0;

  // Check if user can create (has a department)
  const canCreate = !!profile?.department_id;

  if (isLoading) {
    return (
      <AppLayout>
        <ListSkeleton rows={8} columns={6} />
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
              Expressions de besoin
            </h1>
            <p className="text-muted-foreground">
              {data?.totalCount || 0} expression(s) enregistrée(s)
            </p>
          </div>
          {canCreate ? (
            <Link to="/expressions-besoin/nouveau">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle expression
              </Button>
            </Link>
          ) : (
            <Button disabled title="Vous devez être rattaché à un département">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle expression
            </Button>
          )}
        </div>

        {/* Info banner */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-3">
            <Info className="h-5 w-5 text-primary" />
            <p className="text-sm text-foreground">
              <strong>Expression de besoin :</strong> Une demande simple (nom + commentaire) 
              soumise à votre chef hiérarchique pour validation avant transmission à la logistique.
            </p>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom d'article..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="brouillon">Brouillon</SelectItem>
                <SelectItem value="soumis">En attente de validation</SelectItem>
                <SelectItem value="en_examen">En cours d'examen</SelectItem>
                <SelectItem value="valide_departement">Validée</SelectItem>
                <SelectItem value="rejete_departement">Rejetée</SelectItem>
                <SelectItem value="envoye_logistique">Transmise</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Manager info */}
        {isManager && (
          <Card className="border-success/20 bg-success/5">
            <CardContent className="flex items-center gap-3 py-3">
              <CheckCircle className="h-5 w-5 text-success" />
              <p className="text-sm text-foreground">
                <strong>Vous êtes responsable :</strong> Vous voyez les expressions de vos subordonnés 
                et pouvez les valider ou les rejeter.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {data?.expressions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {searchQuery || statusFilter !== 'all'
                  ? 'Aucune expression trouvée avec ces critères.'
                  : 'Aucune expression enregistrée.'}
              </div>
            ) : (
              <>
                <div className={`overflow-x-auto ${isFetching ? 'opacity-70' : ''}`}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Demandeur</TableHead>
                        <TableHead>Nom de l'article</TableHead>
                        <TableHead>Département</TableHead>
                        <TableHead>Quantité</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.expressions.map((expression) => {
                        const status = expression.status as ExpressionBesoinStatus;
                        const StatusIcon = STATUS_ICONS[status];
                        const isMine = expression.user_id === profile?.id;
                        return (
                          <TableRow key={expression.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <UserAvatar
                                  photoUrl={expression.user?.photo_url}
                                  firstName={expression.user?.first_name}
                                  lastName={expression.user?.last_name}
                                  size="sm"
                                />
                                <div>
                                  <p className="text-sm font-medium">
                                    {[expression.user?.first_name, expression.user?.last_name]
                                      .filter(Boolean)
                                      .join(' ') || 'Inconnu'}
                                    {isMine && (
                                      <span className="ml-2 text-xs text-muted-foreground">(vous)</span>
                                    )}
                                  </p>
                                  {expression.user?.fonction && (
                                    <p className="text-xs text-muted-foreground">
                                      {expression.user.fonction}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{expression.nom_article}</p>
                              {expression.commentaire && (
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {expression.commentaire}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              {expression.department?.name || 'N/A'}
                            </TableCell>
                            <TableCell>
                              {expression.quantite ? (
                                <span>
                                  {expression.quantite} {expression.unite || 'unité(s)'}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={EXPRESSION_STATUS_COLORS[status]}>
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {EXPRESSION_STATUS_LABELS[status]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(expression.created_at), 'dd MMM yyyy', { locale: fr })}
                            </TableCell>
                            <TableCell>
                              <Link to={`/expressions-besoin/${expression.id}`}>
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
