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
import { useToast } from '@/hooks/use-toast';
import { NoteFrais, NoteFraisStatus, NOTE_FRAIS_STATUS_LABELS } from '@/types/kpm';
import {
  Receipt,
  Plus,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Wallet,
  FileCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const statusColors: Record<NoteFraisStatus, string> = {
  brouillon: 'bg-muted text-muted-foreground',
  soumise: 'bg-warning/10 text-warning border-warning/20',
  validee_daf: 'bg-primary/10 text-primary border-primary/20',
  payee: 'bg-success/10 text-success border-success/20',
  rejetee: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusIcons: Record<NoteFraisStatus, React.ElementType> = {
  brouillon: Clock,
  soumise: FileCheck,
  validee_daf: CheckCircle,
  payee: Wallet,
  rejetee: XCircle,
};

export default function NotesFraisList() {
  const { user, roles, isAdmin } = useAuth();
  const { toast } = useToast();

  const [notes, setNotes] = useState<NoteFrais[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const isDAF = roles.includes('daf');
  const isComptable = roles.includes('comptable');
  const isDG = roles.includes('dg');

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('notes_frais')
        .select(`
          *,
          user:profiles!notes_frais_user_id_fkey(id, first_name, last_name, email),
          department:departments(id, name),
          projet:projets(id, code, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes((data as unknown as NoteFrais[]) || []);
    } catch (error: any) {
      console.error('Error:', error);
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredNotes = notes.filter((n) => {
    const matchesSearch =
      n.reference.toLowerCase().includes(search.toLowerCase()) ||
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      (n.user?.first_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (n.user?.last_name || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || n.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: notes.length,
    brouillon: notes.filter((n) => n.status === 'brouillon').length,
    soumise: notes.filter((n) => n.status === 'soumise').length,
    validee_daf: notes.filter((n) => n.status === 'validee_daf').length,
    payee: notes.filter((n) => n.status === 'payee').length,
  };

  // ARRONDI COMPTABLE DAF: arrondi au supérieur pour les montants
  const formatAmount = (amount: number, currency: string = 'XOF') => {
    const rounded = Math.ceil(amount);
    return new Intl.NumberFormat('fr-FR').format(rounded) + ' ' + currency;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Notes de Frais
            </h1>
            <p className="text-muted-foreground">
              Gestion des demandes de remboursement
            </p>
          </div>
          <Link to="/notes-frais/nouveau">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle note
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Receipt className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                <Clock className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.brouillon}</p>
                <p className="text-sm text-muted-foreground">Brouillons</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
                <FileCheck className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.soumise}</p>
                <p className="text-sm text-muted-foreground">À valider</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.validee_daf}</p>
                <p className="text-sm text-muted-foreground">À payer</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                <Wallet className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.payee}</p>
                <p className="text-sm text-muted-foreground">Payées</p>
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
                  placeholder="Rechercher par référence, titre ou demandeur..."
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
                  {(Object.keys(NOTE_FRAIS_STATUS_LABELS) as NoteFraisStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {NOTE_FRAIS_STATUS_LABELS[status]}
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
              {filteredNotes.length} note{filteredNotes.length !== 1 ? 's' : ''} de frais
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Aucune note de frais trouvée.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Référence</TableHead>
                      <TableHead>Titre</TableHead>
                      <TableHead>Demandeur</TableHead>
                      <TableHead>Projet</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNotes.map((note) => {
                      const StatusIcon = statusIcons[note.status];
                      return (
                        <TableRow key={note.id}>
                          <TableCell className="font-mono font-medium">{note.reference}</TableCell>
                          <TableCell>
                            <div className="font-medium">{note.title}</div>
                            {note.description && (
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {note.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {note.user?.first_name} {note.user?.last_name}
                          </TableCell>
                          <TableCell>
                            {note.projet ? (
                              <span className="font-mono text-sm">{note.projet.code}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {formatAmount(note.total_amount, note.currency)}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[note.status]}>
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {NOTE_FRAIS_STATUS_LABELS[note.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(note.created_at), 'dd MMM yyyy', { locale: fr })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link to={`/notes-frais/${note.id}`}>
                              <Button variant="ghost" size="sm">
                                Détails
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
