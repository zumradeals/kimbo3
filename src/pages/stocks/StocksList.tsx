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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Stock, StockType, STOCK_TYPE_LABELS } from '@/types/entrepot';
import { LOGISTICS_ROLES } from '@/types/kpm';
import { AccessDenied } from '@/components/ui/AccessDenied';
import {
  Warehouse,
  Search,
  Plus,
  MapPin,
  Building2,
  HardHat,
  CheckCircle,
  XCircle,
  Pencil,
  Star,
} from 'lucide-react';

export default function StocksList() {
  const { user, roles, isAdmin } = useAuth();
  const { toast } = useToast();

  const [stocks, setStocks] = useState<Stock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingStock, setEditingStock] = useState<Stock | null>(null);

  const [form, setForm] = useState({
    nom: '',
    type: 'interne' as StockType,
    localisation: '',
  });

  const isLogistics = roles.some((r) => LOGISTICS_ROLES.includes(r));
  const canManage = isLogistics || isAdmin;

  useEffect(() => {
    fetchStocks();
  }, []);

  const fetchStocks = async () => {
    try {
      const { data, error } = await supabase
        .from('entrepots')
        .select('*')
        .order('is_default', { ascending: false })
        .order('nom');

      if (error) throw error;
      setStocks((data as Stock[]) || []);
    } catch (error: any) {
      console.error('Error fetching stocks:', error);
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddStock = async () => {
    if (!form.nom.trim()) {
      toast({ title: 'Erreur', description: 'Le nom est requis.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from('entrepots').insert({
        nom: form.nom.trim(),
        type: form.type,
        localisation: form.localisation.trim() || null,
        created_by: user?.id,
      });

      if (error) throw error;

      toast({ title: 'Succès', description: 'Stock créé avec succès.' });
      setShowAddDialog(false);
      resetForm();
      fetchStocks();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditStock = async () => {
    if (!editingStock || !form.nom.trim()) {
      toast({ title: 'Erreur', description: 'Le nom est requis.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('entrepots')
        .update({
          nom: form.nom.trim(),
          type: form.type,
          localisation: form.localisation.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingStock.id);

      if (error) throw error;

      toast({ title: 'Succès', description: 'Stock mis à jour.' });
      setShowEditDialog(false);
      setEditingStock(null);
      resetForm();
      fetchStocks();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (stock: Stock) => {
    if (stock.is_default) {
      toast({ title: 'Erreur', description: 'Impossible de désactiver le stock par défaut.', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('entrepots')
        .update({ is_active: !stock.is_active, updated_at: new Date().toISOString() })
        .eq('id', stock.id);

      if (error) throw error;

      toast({ title: 'Succès', description: `Stock ${stock.is_active ? 'désactivé' : 'activé'}.` });
      fetchStocks();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  const openEditDialog = (stock: Stock) => {
    setEditingStock(stock);
    setForm({
      nom: stock.nom,
      type: stock.type,
      localisation: stock.localisation || '',
    });
    setShowEditDialog(true);
  };

  const resetForm = () => {
    setForm({ nom: '', type: 'interne', localisation: '' });
  };

  const filteredStocks = stocks.filter((s) => {
    const matchesSearch = s.nom.toLowerCase().includes(search.toLowerCase()) ||
      (s.localisation || '').toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || s.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const stats = {
    total: stocks.length,
    interne: stocks.filter((s) => s.type === 'interne').length,
    chantier: stocks.filter((s) => s.type === 'chantier').length,
    actifs: stocks.filter((s) => s.is_active).length,
  };

  if (!canManage) {
    return (
      <AppLayout>
        <AccessDenied message="Seule la Logistique peut gérer les stocks." />
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
              Gestion des Stocks
            </h1>
            <p className="text-muted-foreground">
              Gérez vos stocks internes et stocks chantiers
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau stock
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Warehouse className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total stocks</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                <Building2 className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.interne}</p>
                <p className="text-sm text-muted-foreground">Stocks internes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/10">
                <HardHat className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.chantier}</p>
                <p className="text-sm text-muted-foreground">Stocks chantiers</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.actifs}</p>
                <p className="text-sm text-muted-foreground">Actifs</p>
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
                  placeholder="Rechercher par nom ou localisation..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Tous les types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="interne">Stock Interne</SelectItem>
                  <SelectItem value="chantier">Stock Chantier</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              {filteredStocks.length} stock{filteredStocks.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredStocks.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Aucun stock trouvé.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Localisation</TableHead>
                      <TableHead className="text-center">Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStocks.map((stock) => (
                      <TableRow key={stock.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{stock.nom}</span>
                            {stock.is_default && (
                              <Badge className="bg-primary/10 text-primary text-[10px]">
                                <Star className="mr-1 h-3 w-3" />
                                Défaut
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {stock.type === 'interne' ? (
                              <Building2 className="mr-1 h-3 w-3" />
                            ) : (
                              <HardHat className="mr-1 h-3 w-3" />
                            )}
                            {STOCK_TYPE_LABELS[stock.type]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {stock.localisation ? (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {stock.localisation}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {stock.is_active ? (
                            <Badge className="bg-success/10 text-success border-success/20">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Actif
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              <XCircle className="mr-1 h-3 w-3" />
                              Inactif
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(stock)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {!stock.is_default && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleActive(stock)}
                              >
                                {stock.is_active ? (
                                  <XCircle className="h-4 w-4 text-destructive" />
                                ) : (
                                  <CheckCircle className="h-4 w-4 text-success" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un stock</DialogTitle>
            <DialogDescription>
              Ajoutez un nouveau stock interne ou chantier
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom <span className="text-destructive">*</span></Label>
              <Input
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                placeholder="Ex: Stock Kimbo Interne, Stock Chantier Riviera..."
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(val) => setForm({ ...form, type: val as StockType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interne">Stock Interne</SelectItem>
                  <SelectItem value="chantier">Stock Chantier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Localisation</Label>
              <Input
                value={form.localisation}
                onChange={(e) => setForm({ ...form, localisation: e.target.value })}
                placeholder="Adresse ou emplacement..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddStock} disabled={isSaving}>
              {isSaving ? 'Création...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { setShowEditDialog(open); if (!open) { setEditingStock(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le stock</DialogTitle>
            <DialogDescription>
              Modifiez les informations du stock
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom <span className="text-destructive">*</span></Label>
              <Input
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(val) => setForm({ ...form, type: val as StockType })}
                disabled={editingStock?.is_default}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interne">Stock Interne</SelectItem>
                  <SelectItem value="chantier">Stock Chantier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Localisation</Label>
              <Input
                value={form.localisation}
                onChange={(e) => setForm({ ...form, localisation: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleEditStock} disabled={isSaving}>
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
