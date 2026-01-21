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
import { Plus, Search, Eye, Clock, CheckCircle, XCircle, Info, FileEdit, Send, Users, Package } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { useDebounce } from '@/hooks/use-debounce';
import { UserBadge } from '@/components/ui/UserBadge';
import {
  ExpressionBesoinStatus,
  EXPRESSION_STATUS_LABELS,
  EXPRESSION_STATUS_COLORS,
  PublicProfile,
  formatFullName,
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

// Interface pour les lignes d'expression
interface ExpressionLigne {
  id: string;
  nom_article: string;
  quantite: number | null;
  unite: string | null;
  status: string;
}

export default function ExpressionsList() {
  const { profile, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Check if user is a manager
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

    // 1. Fetch expressions with department and lignes
    let query = supabase
      .from('expressions_besoin')
      .select(`
        *,
        department:departments(id, name),
        lignes:expressions_besoin_lignes(id, nom_article, quantite, unite, status)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter as ExpressionBesoinStatus);
    }

    if (debouncedSearch) {
      // Rechercher dans le titre ou le commentaire
      query = query.or(`titre.ilike.%${debouncedSearch}%,nom_article.ilike.%${debouncedSearch}%`);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // 2. Collect user IDs to fetch via RPC
    const userIds = [...new Set((data || []).map(e => e.user_id).filter(Boolean))] as string[];

    // 3. Fetch public profiles via RPC (bypasses RLS)
    let profilesMap = new Map<string, PublicProfile>();
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase.rpc('get_public_profiles', {
        _user_ids: userIds,
      });
      profilesMap = new Map((profilesData || []).map((p: PublicProfile) => [p.id, p]));
    }

    return {
      expressions: (data || []).map(exp => ({
        ...exp,
        user: profilesMap.get(exp.user_id) || null,
        lignes: exp.lignes as ExpressionLigne[] || [],
      })),
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
              <strong>Expression groupée :</strong> Chaque expression peut contenir plusieurs articles, 
              validés ensemble par votre responsable.
            </p>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
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
              <Users className="h-5 w-5 text-success" />
              <p className="text-sm text-foreground">
                <strong>Vous êtes responsable hiérarchique.</strong> Vous voyez les expressions de vos subordonnés 
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
                        <TableHead>Articles</TableHead>
                        <TableHead>Département</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.expressions.map((expression) => {
                        const status = expression.status as ExpressionBesoinStatus;
                        const StatusIcon = STATUS_ICONS[status];
                        const isMine = expression.user_id === user?.id;
                        const userProfile = expression.user as PublicProfile | null;
                        const lignes = expression.lignes as ExpressionLigne[];
                        const articleCount = lignes.length;
                        
                        return (
                          <TableRow key={expression.id}>
                            <TableCell>
                              <UserBadge
                                userId={userProfile?.id}
                                photoUrl={userProfile?.photo_url}
                                firstName={userProfile?.first_name}
                                lastName={userProfile?.last_name}
                                fonction={userProfile?.fonction}
                                size="sm"
                                showFonction
                              />
                              {isMine && (
                                <span className="ml-2 text-xs text-muted-foreground">(vous)</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  {articleCount > 1 ? (
                                    <>
                                      <p className="font-medium">{articleCount} articles</p>
                                      <p className="text-xs text-muted-foreground line-clamp-1">
                                        {lignes.slice(0, 2).map(l => l.nom_article).join(', ')}
                                        {articleCount > 2 && '...'}
                                      </p>
                                    </>
                                  ) : (
                                    <p className="font-medium">
                                      {lignes[0]?.nom_article || expression.nom_article || '—'}
                                    </p>
                                  )}
                                  {expression.commentaire && (
                                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                      💬 {expression.commentaire}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {expression.department?.name || '—'}
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
