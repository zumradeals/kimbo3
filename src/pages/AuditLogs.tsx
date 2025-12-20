import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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

export default function AuditLogs() {
  const { roles, isAdmin } = useAuth();
  const { toast } = useToast();

  const [logs, setLogs] = useState<AuditLogWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogWithProfile | null>(null);

  const hasAccess = isAdmin || roles.some(r => ['dg', 'daf', 'comptable'].includes(r));

  useEffect(() => {
    if (hasAccess) {
      fetchLogs();
    }
  }, [hasAccess]);

  const fetchLogs = async () => {
    try {
      // First fetch logs
      const { data: logsData, error: logsError } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (logsError) throw logsError;

      // Fetch profiles for user_ids
      const userIds = [...new Set((logsData || []).filter(l => l.user_id).map(l => l.user_id))];
      let profilesMap: Record<string, { first_name: string | null; last_name: string | null; email: string }> = {};

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', userIds);

        if (profilesData) {
          profilesMap = Object.fromEntries(profilesData.map(p => [p.id, p]));
        }
      }

      // Merge data
      const enrichedLogs = (logsData || []).map(log => ({
        ...log,
        profile: log.user_id ? profilesMap[log.user_id] || null : null,
      }));

      setLogs(enrichedLogs as AuditLogWithProfile[]);
    } catch (error: any) {
      console.error('Error fetching logs:', error);
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

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

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      (log.profile?.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (log.profile?.first_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (log.profile?.last_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (log.record_id || '').toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesTable = tableFilter === 'all' || log.table_name === tableFilter;
    return matchesSearch && matchesAction && matchesTable;
  });

  const stats = {
    total: logs.length,
    creates: logs.filter(l => l.action === 'INSERT').length,
    updates: logs.filter(l => l.action === 'UPDATE').length,
    deletes: logs.filter(l => l.action === 'DELETE').length,
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
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total actions</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                <FileText className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.creates}</p>
                <p className="text-sm text-muted-foreground">Créations</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.updates}</p>
                <p className="text-sm text-muted-foreground">Modifications</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
                <FileText className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.deletes}</p>
                <p className="text-sm text-muted-foreground">Suppressions</p>
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
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par utilisateur ou ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
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
          <CardHeader>
            <CardTitle>
              {filteredLogs.length} entrée{filteredLogs.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Aucune entrée d'audit trouvée.
              </div>
            ) : (
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
                              {log.profile ? (
                                <span>
                                  {log.profile.first_name} {log.profile.last_name}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Système</span>
                              )}
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
                    {selectedLog.profile
                      ? `${selectedLog.profile.first_name} ${selectedLog.profile.last_name} (${selectedLog.profile.email})`
                      : 'Système'}
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
