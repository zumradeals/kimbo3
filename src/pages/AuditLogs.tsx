import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { AccessDenied } from '@/components/ui/AccessDenied';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { AuditLog } from '@/types/kpm';
import {
  Search,
  FileText,
  Eye,
  Activity,
  Shield,
  Clock,
  User,
  Download,
  Calendar,
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { useDebounce } from '@/hooks/use-debounce';

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  INSERT: { label: 'Création', color: 'bg-success/10 text-success' },
  UPDATE: { label: 'Modification', color: 'bg-primary/10 text-primary' },
  DELETE: { label: 'Suppression', color: 'bg-destructive/10 text-destructive' },
  LOGIN: { label: 'Connexion', color: 'bg-muted text-muted-foreground' },
  LOGOUT: { label: 'Déconnexion', color: 'bg-muted text-muted-foreground' },
};

const TABLE_LABELS: Record<string, string> = {
  besoins: 'Besoins',
  demandes_achat: 'Demandes d\'achat',
  bons_livraison: 'Bons de livraison',
  articles_stock: 'Stock',
  stock_movements: 'Mouvements stock',
  ecritures_comptables: 'Écritures comptables',
  fournisseurs: 'Fournisseurs',
  profiles: 'Profils',
  user_roles: 'Rôles',
  departments: 'Départements',
};

interface AuditLogWithProfile extends AuditLog {
  profile?: { first_name: string | null; last_name: string | null; email: string } | null;
}

const PAGE_SIZE = 25;

// Date range presets
const DATE_PRESETS = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week', label: '7 derniers jours' },
  { value: 'month', label: '30 derniers jours' },
  { value: 'all', label: 'Tout' },
];

export default function AuditLogs() {
  const { roles, isAdmin } = useAuth();
  const { toast } = useToast();

  const [logs, setLogs] = useState<AuditLogWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<string>('week');
  const [selectedLog, setSelectedLog] = useState<AuditLogWithProfile | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const debouncedSearch = useDebounce(search, 300);
  const hasAccess = isAdmin || roles.some(r => ['dg', 'daf'].includes(r));

  const getDateRange = useCallback(() => {
    const now = new Date();
    switch (datePreset) {
      case 'today':
        return { from: startOfDay(now), to: endOfDay(now) };
      case 'week':
        return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
      case 'month':
        return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
      default:
        return null;
    }
  }, [datePreset]);

  const fetchLogs = useCallback(async () => {
    if (!hasAccess) return;
    
    setIsLoading(true);
    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const dateRange = getDateRange();

      // Build query
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' });

      // Apply date filter
      if (dateRange) {
        query = query
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString());
      }

      // Apply action filter
      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      // Apply table filter
      if (tableFilter !== 'all') {
        query = query.eq('table_name', tableFilter);
      }

      // Apply pagination
      query = query
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data: logsData, error: logsError, count } = await query;

      if (logsError) throw logsError;

      setTotalCount(count || 0);

      // Fetch profiles for user_ids using the security definer function
      const userIds = [...new Set((logsData || []).filter(l => l.user_id).map(l => l.user_id))] as string[];
      let profilesMap: Record<string, { first_name: string | null; last_name: string | null; email: string }> = {};

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .rpc('get_public_profiles', { _user_ids: userIds });

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        }

        if (profilesData) {
          profilesData.forEach((p: { id: string; first_name: string | null; last_name: string | null; email: string }) => {
            profilesMap[p.id] = {
              first_name: p.first_name,
              last_name: p.last_name,
              email: p.email || '',
            };
          });
        }
      }

      // Merge data - show user_id info even if profile not found
      const enrichedLogs = (logsData || []).map(log => ({
        ...log,
        profile: log.user_id ? (profilesMap[log.user_id] || { 
          first_name: null, 
          last_name: null, 
          email: `ID: ${log.user_id.substring(0, 8)}...` 
        }) : null,
      }));

      setLogs(enrichedLogs as AuditLogWithProfile[]);
    } catch (error: any) {
      console.error('Error fetching logs:', error);
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [hasAccess, page, actionFilter, tableFilter, datePreset, getDateRange, toast]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [actionFilter, tableFilter, datePreset]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const exportCSV = () => {
    const headers = ['Date', 'Utilisateur', 'Action', 'Table', 'Enregistrement', 'IP'];
    const rows = filteredLogs.map(log => [
      format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss'),
      log.profile ? `${log.profile.first_name || ''} ${log.profile.last_name || ''}`.trim() || log.profile.email : 'Système',
      ACTION_LABELS[log.action]?.label || log.action,
      TABLE_LABELS[log.table_name || ''] || log.table_name || '-',
      log.record_id || '-',
      log.ip_address || '-',
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  // Client-side search filter (for current page only)
  const filteredLogs = logs.filter((log) => {
    if (!debouncedSearch) return true;
    const searchLower = debouncedSearch.toLowerCase();
    return (
      (log.profile?.email || '').toLowerCase().includes(searchLower) ||
      (log.profile?.first_name || '').toLowerCase().includes(searchLower) ||
      (log.profile?.last_name || '').toLowerCase().includes(searchLower) ||
      (log.record_id || '').toLowerCase().includes(searchLower) ||
      (log.table_name || '').toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const formatUserName = (log: AuditLogWithProfile) => {
    if (!log.user_id) return 'Système';
    if (!log.profile) return 'Utilisateur inconnu';
    const { first_name, last_name, email } = log.profile;
    if (first_name || last_name) {
      return `${first_name || ''} ${last_name || ''}`.trim();
    }
    return email || 'Utilisateur inconnu';
  };

  if (!hasAccess) {
    return (
      <AppLayout>
        <AccessDenied message="Seuls les administrateurs, DG, DAF et Comptables peuvent consulter le journal d'audit." />
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
              Journal d'audit
            </h1>
            <p className="text-muted-foreground">
              Traçabilité complète des actions système
            </p>
          </div>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Exporter CSV
          </Button>
        </div>

        {/* Avertissement */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 py-4">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">Données immuables</p>
              <p className="text-sm text-muted-foreground">
                Ce journal enregistre toutes les actions. Aucune entrée ne peut être modifiée ou supprimée.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCount.toLocaleString('fr-FR')}</p>
                <p className="text-sm text-muted-foreground">Total (période)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{DATE_PRESETS.find(d => d.value === datePreset)?.label}</p>
                <p className="text-sm text-muted-foreground">Période affichée</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{page}</p>
                <p className="text-sm text-muted-foreground">Page / {totalPages || 1}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                <FileText className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{PAGE_SIZE}</p>
                <p className="text-sm text-muted-foreground">Par page</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Filtres</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par utilisateur, table ou ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={datePreset} onValueChange={setDatePreset}>
                <SelectTrigger className="w-full sm:w-44">
                  <Calendar className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Période" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map(preset => (
                    <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes actions</SelectItem>
                  <SelectItem value="INSERT">Création</SelectItem>
                  <SelectItem value="UPDATE">Modification</SelectItem>
                  <SelectItem value="DELETE">Suppression</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Table" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes tables</SelectItem>
                  {Object.entries(TABLE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {filteredLogs.length} entrée{filteredLogs.length !== 1 ? 's' : ''} affichée{filteredLogs.length !== 1 ? 's' : ''}
              {totalCount > PAGE_SIZE && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  sur {totalCount.toLocaleString('fr-FR')} au total
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ListSkeleton rows={10} />
            ) : filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Aucune entrée d'audit trouvée pour ces critères.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Utilisateur</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Table</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead className="text-right">Détails</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => {
                        const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-muted' };
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className={!log.user_id ? 'text-muted-foreground' : ''}>
                                  {formatUserName(log)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={actionInfo.color}>
                                {actionInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {TABLE_LABELS[log.table_name || ''] || log.table_name || '-'}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {log.ip_address || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedLog(log)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4">
                    <PaginationControls
                      page={page}
                      totalPages={totalPages}
                      totalCount={totalCount}
                      pageSize={PAGE_SIZE}
                      onPageChange={setPage}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détail de l'action</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {format(new Date(selectedLog.created_at), 'dd MMMM yyyy à HH:mm:ss', { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Utilisateur</p>
                  <p className="font-medium">
                    {formatUserName(selectedLog)}
                    {selectedLog.profile?.email && selectedLog.profile.first_name && (
                      <span className="ml-1 text-sm text-muted-foreground">({selectedLog.profile.email})</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Action</p>
                  <Badge className={ACTION_LABELS[selectedLog.action]?.color || 'bg-muted'}>
                    {ACTION_LABELS[selectedLog.action]?.label || selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Table</p>
                  <p className="font-medium">
                    {TABLE_LABELS[selectedLog.table_name || ''] || selectedLog.table_name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ID Enregistrement</p>
                  <p className="font-mono text-sm">{selectedLog.record_id || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Adresse IP</p>
                  <p className="font-mono text-sm">{selectedLog.ip_address || '-'}</p>
                </div>
              </div>

              {selectedLog.user_agent && (
                <div>
                  <p className="text-sm text-muted-foreground">User Agent</p>
                  <p className="font-mono text-xs text-muted-foreground">{selectedLog.user_agent}</p>
                </div>
              )}

              {selectedLog.old_values && (
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">Valeurs avant</p>
                  <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">
                    {JSON.stringify(selectedLog.old_values, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_values && (
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">Valeurs après</p>
                  <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">
                    {JSON.stringify(selectedLog.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
