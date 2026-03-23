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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Projet, ProjetStatus, PROJET_STATUS_LABELS } from '@/types/kpm';
import {
  FolderKanban,
  Plus,
  Search,
  Calendar,
  MapPin,
  Building2,
  CheckCircle,
  Pause,
  XCircle,
  Clock,
  FileEdit,
  Send,
  ShieldCheck,
  Wallet,
  X,
  Info,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CaisseWithSolde {
  id: string;
  code: string;
  name: string;
  devise: string;
  solde_actuel: number;
}

const statusColors: Record<ProjetStatus, string> = {
  brouillon: 'bg-muted text-muted-foreground',
  soumis_daf: 'bg-warning/10 text-warning border-warning/20',
  valide_daf: 'bg-primary/10 text-primary border-primary/20',
  actif: 'bg-success/10 text-success border-success/20',
  termine: 'bg-muted text-muted-foreground',
  suspendu: 'bg-warning/10 text-warning border-warning/20',
};

const statusIcons: Record<ProjetStatus, React.ElementType> = {
  brouillon: FileEdit,
  soumis_daf: Send,
  valide_daf: ShieldCheck,
  actif: CheckCircle,
  termine: Clock,
  suspendu: Pause,
};

export default function ProjetsList() {
  const { user, roles, isAdmin } = useAuth();
  const { toast } = useToast();

  const [projets, setProjets] = useState<Projet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    client: '',
    location: '',
    start_date: '',
    end_date: '',
    budget: '',
  });
  const [selectedCaisses, setSelectedCaisses] = useState<string[]>([]);
  const [availableCaisses, setAvailableCaisses] = useState<CaisseWithSolde[]>([]);

  const isAAL = roles.includes('aal');
  const isDaf = roles.includes('daf');
  const isLogistics = roles.some((r) => ['responsable_logistique', 'agent_logistique'].includes(r));
  const canCreate = isAAL || isAdmin || isLogistics || isDaf;

  // Auto-calculate budget from selected caisses
  const totalCaissesBudget = selectedCaisses.reduce((sum, cId) => {
    const c = availableCaisses.find((x) => x.id === cId);
    return sum + (c?.solde_actuel || 0);
  }, 0);

  useEffect(() => {
    fetchProjets();
    fetchCaisses();
  }, []);

  // Auto-update budget when caisses change
  useEffect(() => {
    if (selectedCaisses.length > 0) {
      setFormData((prev) => ({ ...prev, budget: Math.ceil(totalCaissesBudget).toString() }));
    }
  }, [selectedCaisses, totalCaissesBudget]);

  const fetchCaisses = async () => {
    try {
      const { data } = await supabase
        .from('caisses')
        .select('id, code, name, devise, solde_actuel')
        .eq('is_active', true)
        .order('code');
      setAvailableCaisses(data || []);
    } catch (e) {
      console.error('Error fetching caisses:', e);
    }
  };

  const toggleCaisse = (caisseId: string) => {
    setSelectedCaisses((prev) =>
      prev.includes(caisseId) ? prev.filter((id) => id !== caisseId) : [...prev, caisseId]
    );
  };

  const fetchProjets = async () => {
    try {
      const { data, error } = await supabase
        .from('projets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjets((data as Projet[]) || []);
    } catch (error: any) {
      console.error('Error:', error);
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProjet = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      toast({ title: 'Erreur', description: 'Le code et le nom sont requis.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const { data: newProjet, error } = await supabase.from('projets').insert({
        code: formData.code.toUpperCase(),
        name: formData.name,
        description: formData.description || null,
        client: formData.client || null,
        location: formData.location || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        budget: formData.budget ? Number(formData.budget) : null,
        status: 'brouillon',
        created_by: user?.id,
      }).select('id').single();

      if (error) throw error;

      // Link selected caisses
      if (selectedCaisses.length > 0 && newProjet) {
        const { error: linkError } = await supabase.from('projet_caisses').insert(
          selectedCaisses.map((caisseId) => ({
            projet_id: newProjet.id,
            caisse_id: caisseId,
            created_by: user?.id,
          }))
        );
        if (linkError) console.error('Error linking caisses:', linkError);
      }

      toast({ title: 'Projet créé', description: 'Le projet a été ajouté avec succès.' });
      setShowAddDialog(false);
      setFormData({
        code: '',
        name: '',
        description: '',
        client: '',
        location: '',
        start_date: '',
        end_date: '',
        budget: '',
      });
      setSelectedCaisses([]);
      fetchProjets();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProjets = projets.filter((p) => {
    const matchesSearch =
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.client || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: projets.length,
    actif: projets.filter((p) => p.status === 'actif').length,
    brouillon: projets.filter((p) => p.status === 'brouillon').length,
    soumis_daf: projets.filter((p) => p.status === 'soumis_daf').length,
    termine: projets.filter((p) => p.status === 'termine').length,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Projets & Chantiers
            </h1>
            <p className="text-muted-foreground">
              Gestion des projets et centres de coût
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau projet
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <FolderKanban className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Projets total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.actif}</p>
                <p className="text-sm text-muted-foreground">Actifs</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
                <Send className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.soumis_daf}</p>
                <p className="text-sm text-muted-foreground">En attente DAF</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                <Clock className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.termine}</p>
                <p className="text-sm text-muted-foreground">Terminés</p>
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
                  placeholder="Rechercher par code, nom ou client..."
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
                  {(Object.keys(PROJET_STATUS_LABELS) as ProjetStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {PROJET_STATUS_LABELS[status]}
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
              {filteredProjets.length} projet{filteredProjets.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredProjets.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Aucun projet trouvé.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Lieu</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjets.map((projet) => {
                      const StatusIcon = statusIcons[projet.status];
                      return (
                        <TableRow key={projet.id}>
                          <TableCell className="font-mono font-medium">{projet.code}</TableCell>
                          <TableCell>
                            <div className="font-medium">{projet.name}</div>
                            {projet.description && (
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {projet.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {projet.client && (
                              <div className="flex items-center gap-1">
                                <Building2 className="h-3 w-3 text-muted-foreground" />
                                {projet.client}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {projet.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                {projet.location}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {projet.start_date && (
                              <div className="flex items-center gap-1 text-sm">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                {format(new Date(projet.start_date), 'dd/MM/yyyy', { locale: fr })}
                                {projet.end_date && (
                                  <span className="text-muted-foreground">
                                    → {format(new Date(projet.end_date), 'dd/MM/yyyy', { locale: fr })}
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[projet.status]}>
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {PROJET_STATUS_LABELS[projet.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link to={`/projets/${projet.id}`}>
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

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau projet</DialogTitle>
            <DialogDescription>
              Créez un nouveau projet ou chantier pour le suivi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="code">Code projet *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="PROJ-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nom du projet *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Construction site UIPA"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description du projet..."
                rows={2}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <Input
                  id="client"
                  value={formData.client}
                  onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                  placeholder="Nom du client"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Lieu</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Douala, Cameroun"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start_date">Date de début</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Date de fin</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            {/* Caisse selector */}
            <div className="space-y-2">
              <Label>
                <Wallet className="inline h-4 w-4 mr-1" />
                Caisses associées
              </Label>
              {selectedCaisses.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedCaisses.map((cId) => {
                    const c = availableCaisses.find((x) => x.id === cId);
                    return c ? (
                      <Badge key={cId} variant="secondary" className="gap-1">
                        {c.code} - {c.name}
                        <span className="text-xs font-normal ml-1">
                          ({Math.ceil(c.solde_actuel).toLocaleString()} {c.devise})
                        </span>
                        <X className="h-3 w-3 cursor-pointer" onClick={() => toggleCaisse(cId)} />
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
              {availableCaisses.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune caisse disponible</p>
              ) : (
                <div className="max-h-32 overflow-y-auto rounded-md border p-2 space-y-1">
                  {availableCaisses.map((c) => (
                    <label key={c.id} className="flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedCaisses.includes(c.id)}
                          onCheckedChange={() => toggleCaisse(c.id)}
                        />
                        <span className="text-sm">{c.code} - {c.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {Math.ceil(c.solde_actuel).toLocaleString()} {c.devise}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Budget - auto-calculated */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="budget">Budget (XOF)</Label>
                {selectedCaisses.length > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Budget auto-calculé depuis les soldes des caisses sélectionnées. Vous pouvez le modifier manuellement.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <Input
                id="budget"
                type="number"
                min={0}
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                placeholder="0"
              />
              {selectedCaisses.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  💰 Total soldes caisses : <span className="font-medium">{Math.ceil(totalCaissesBudget).toLocaleString()} XOF</span>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddProjet} disabled={isSaving}>
              {isSaving ? 'Création...' : 'Créer le projet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
