import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Building2, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/use-debounce';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { ListSkeleton } from '@/components/ui/ListSkeleton';

type ImmoStatus = 'brouillon' | 'validee' | 'active' | 'en_maintenance' | 'sortie' | 'reformee' | 'cedee';

const STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  validee: 'Validée',
  active: 'Active',
  en_maintenance: 'En maintenance',
  sortie: 'Sortie',
  reformee: 'Réformée',
  cedee: 'Cédée',
};

const STATUS_COLORS: Record<string, string> = {
  brouillon: 'bg-muted text-muted-foreground',
  validee: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  en_maintenance: 'bg-yellow-100 text-yellow-800',
  sortie: 'bg-orange-100 text-orange-800',
  reformee: 'bg-red-100 text-red-800',
  cedee: 'bg-purple-100 text-purple-800',
};

const ETAT_LABELS: Record<string, string> = {
  neuf: 'Neuf',
  bon: 'Bon état',
  use: 'Usé',
  en_panne: 'En panne',
  hors_service: 'Hors service',
};

const PAGE_SIZE = 20;

export default function ImmobilisationsList() {
  const { isAdmin, roles } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ImmoStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const canCreate = isAdmin || roles.some(r => ['aal', 'responsable_logistique', 'agent_logistique', 'daf'].includes(r as string));

  const { data, isLoading } = useQuery({
    queryKey: ['immobilisations', debouncedSearch, statusFilter, page],
    queryFn: async () => {
      let query = supabase
        .from('immobilisations')
        .select('*, departments(name), profiles!immobilisations_affecte_a_fkey(first_name, last_name, matricule)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (debouncedSearch) {
        query = query.or(`designation.ilike.%${debouncedSearch}%,code.ilike.%${debouncedSearch}%,numero_serie.ilike.%${debouncedSearch}%`);
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as ImmoStatus);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { items: data || [], count: count || 0 };
    },
  });

  const items = data?.items || [];
  const totalPages = Math.ceil((data?.count || 0) / PAGE_SIZE);

  // KPIs
  const { data: kpis } = useQuery({
    queryKey: ['immobilisations-kpis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('immobilisations')
        .select('status, valeur_acquisition');
      if (error) throw error;
      const total = data?.length || 0;
      const actives = data?.filter(i => i.status === 'active').length || 0;
      const maintenance = data?.filter(i => i.status === 'en_maintenance').length || 0;
      const valeurTotale = data?.filter(i => ['active', 'en_maintenance', 'validee'].includes(i.status)).reduce((s, i) => s + (i.valeur_acquisition || 0), 0) || 0;
      return { total, actives, maintenance, valeurTotale };
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Immobilisations</h1>
            <p className="text-sm text-muted-foreground">Gestion du patrimoine et des biens durables</p>
          </div>
          {canCreate && (
            <Button asChild>
              <Link to="/immobilisations/nouveau"><Plus className="mr-2 h-4 w-4" />Nouvelle immobilisation</Link>
            </Button>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{kpis?.total || 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-600" />Actives</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-green-600">{kpis?.actives || 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-yellow-600" />En maintenance</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-yellow-600">{kpis?.maintenance || 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Valeur patrimoine</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-bold">{(kpis?.valeurTotale || 0).toLocaleString('fr-FR')} <span className="text-sm text-muted-foreground">FCFA</span></p></CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher par code, désignation, N° série..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? <ListSkeleton /> : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Désignation</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead className="hidden md:table-cell">État</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden lg:table-cell">Affecté à</TableHead>
                    <TableHead className="hidden lg:table-cell">Valeur</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune immobilisation trouvée</TableCell></TableRow>
                  ) : items.map((item: any) => (
                    <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.location.href = `/immobilisations/${item.id}`}>
                      <TableCell className="font-mono text-xs font-medium">{item.code}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{item.designation}</TableCell>
                      <TableCell className="hidden md:table-cell capitalize">{item.type === 'corporel' ? '🏗️ Corporel' : '💻 Incorporel'}</TableCell>
                      <TableCell className="hidden md:table-cell">{ETAT_LABELS[item.etat] || item.etat}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[item.status] || ''}>{STATUS_LABELS[item.status] || item.status}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {item.profiles ? `${item.profiles.first_name} ${item.profiles.last_name}` : <span className="text-muted-foreground">Non affecté</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell font-mono">{(item.valeur_acquisition || 0).toLocaleString('fr-FR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {totalPages > 1 && (
          <PaginationControls page={page} totalPages={totalPages} totalCount={data?.count || 0} pageSize={PAGE_SIZE} onPageChange={setPage} />
        )}
      </div>
    </AppLayout>
  );
}
