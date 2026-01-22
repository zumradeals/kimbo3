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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CategorySelector } from '@/components/stock/CategorySelector';
import {
  ArticleStock,
  StockStatus,
  STOCK_STATUS_LABELS,
  LOGISTICS_ROLES,
  StockCategory,
} from '@/types/kpm';
import { ReadOnlyBadge } from '@/components/ui/ReadOnlyBadge';
import {
  Package,
  Search,
  Plus,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Warehouse,
  FolderTree,
} from 'lucide-react';

const statusColors: Record<StockStatus, string> = {
  disponible: 'bg-success/10 text-success border-success/20',
  reserve: 'bg-warning/10 text-warning border-warning/20',
  epuise: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusIcons: Record<StockStatus, React.ElementType> = {
  disponible: CheckCircle,
  reserve: AlertTriangle,
  epuise: XCircle,
};

// Unités prédéfinies
const STOCK_UNITS = [
  { value: 'unité', label: 'Unité' },
  { value: 'pièce', label: 'Pièce' },
  { value: 'kg', label: 'Kilogramme (kg)' },
  { value: 'g', label: 'Gramme (g)' },
  { value: 't', label: 'Tonne (t)' },
  { value: 'm', label: 'Mètre (m)' },
  { value: 'cm', label: 'Centimètre (cm)' },
  { value: 'm²', label: 'Mètre carré (m²)' },
  { value: 'm³', label: 'Mètre cube (m³)' },
  { value: 'L', label: 'Litre (L)' },
  { value: 'mL', label: 'Millilitre (mL)' },
  { value: 'boîte', label: 'Boîte' },
  { value: 'carton', label: 'Carton' },
  { value: 'palette', label: 'Palette' },
  { value: 'rouleau', label: 'Rouleau' },
  { value: 'sac', label: 'Sac' },
  { value: 'bidon', label: 'Bidon' },
  { value: 'paquet', label: 'Paquet' },
  { value: 'paquets', label: 'Paquets' },
  { value: 'lot', label: 'Lot' },
];

interface ArticleWithCategory extends ArticleStock {
  category?: StockCategory | null;
}

export default function StockList() {
  const { user, roles, isAdmin, hasRole } = useAuth();
  const { toast } = useToast();

  const [articles, setArticles] = useState<ArticleWithCategory[]>([]);
  const [categories, setCategories] = useState<StockCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [customUnit, setCustomUnit] = useState(false);

  // Form state
  const [newArticle, setNewArticle] = useState({
    designation: '',
    description: '',
    unit: 'unité',
    quantity_available: 0,
    quantity_min: 0,
    location: '',
    category_id: null as string | null,
  });

  const isLogistics = roles.some((r) => LOGISTICS_ROLES.includes(r));
  const isDAF = hasRole('daf');
  const isComptable = hasRole('comptable');
  const canManage = isLogistics || isAdmin || isDAF;
  const isReadOnly = isComptable && !isLogistics && !isDAF && !isAdmin;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch articles with category
      const { data: articlesData, error: articlesError } = await supabase
        .from('articles_stock')
        .select('*, category:stock_categories(*)')
        .order('designation');

      if (articlesError) throw articlesError;

      // Fetch categories for filter
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('stock_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (categoriesError) throw categoriesError;

      setArticles((articlesData as ArticleWithCategory[]) || []);
      setCategories((categoriesData as StockCategory[]) || []);
    } catch (error: any) {
      console.error('Error fetching stock:', error);
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddArticle = async () => {
    if (!newArticle.designation.trim()) {
      toast({ title: 'Erreur', description: 'La désignation est requise.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from('articles_stock').insert({
        designation: newArticle.designation,
        description: newArticle.description || null,
        unit: newArticle.unit,
        quantity_available: newArticle.quantity_available,
        quantity_min: newArticle.quantity_min || null,
        location: newArticle.location || null,
        category_id: newArticle.category_id,
        created_by: user?.id,
      });

      if (error) throw error;

      toast({ title: 'Succès', description: 'Article ajouté au stock.' });
      setShowAddDialog(false);
      setNewArticle({
        designation: '',
        description: '',
        unit: 'unité',
        quantity_available: 0,
        quantity_min: 0,
        location: '',
        category_id: null,
      });
      setCustomUnit(false);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setNewArticle({
      designation: '',
      description: '',
      unit: 'unité',
      quantity_available: 0,
      quantity_min: 0,
      location: '',
      category_id: null,
    });
    setCustomUnit(false);
  };

  const filteredArticles = articles.filter((art) => {
    const matchesSearch =
      art.designation.toLowerCase().includes(search.toLowerCase()) ||
      (art.location || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || art.status === statusFilter;
    const matchesCategory = !categoryFilter || art.category_id === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const stats = {
    total: articles.length,
    disponible: articles.filter((a) => a.status === 'disponible').length,
    reserve: articles.filter((a) => a.status === 'reserve').length,
    epuise: articles.filter((a) => a.status === 'epuise').length,
    lowStock: articles.filter((a) => a.quantity_min && a.quantity_available <= a.quantity_min).length,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-serif text-2xl font-bold text-foreground">
                Gestion du Stock
              </h1>
              <p className="text-muted-foreground">
                {isReadOnly ? 'Consultation du stock' : 'Inventaire et mouvements de stock'}
              </p>
            </div>
            {isReadOnly && <ReadOnlyBadge />}
          </div>
          {canManage && (
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvel article
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Articles total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.disponible}</p>
                <p className="text-sm text-muted-foreground">Disponibles</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.lowStock}</p>
                <p className="text-sm text-muted-foreground">Stock bas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.epuise}</p>
                <p className="text-sm text-muted-foreground">Épuisés</p>
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
                  placeholder="Rechercher par désignation ou emplacement..."
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
                  {(Object.keys(STOCK_STATUS_LABELS) as StockStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {STOCK_STATUS_LABELS[status]}
                    </SelectItem>
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
              {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
            </CardTitle>
            <Link to="/stock/mouvements">
              <Button variant="outline" size="sm">
                <Warehouse className="mr-2 h-4 w-4" />
                Voir les mouvements
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Aucun article trouvé.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Désignation</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead className="text-right">Qté disponible</TableHead>
                      <TableHead className="text-right">Qté réservée</TableHead>
                      <TableHead>Unité</TableHead>
                      <TableHead className="text-right">Prix réf.</TableHead>
                      <TableHead>Emplacement</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredArticles.map((art) => {
                      const StatusIcon = statusIcons[art.status];
                      const isLow = art.quantity_min && art.quantity_available <= art.quantity_min;
                      return (
                        <TableRow key={art.id} className={isLow ? 'bg-warning/5' : undefined}>
                          <TableCell>
                            <div className="font-medium">{art.designation}</div>
                            {art.description && (
                              <div className="text-xs text-muted-foreground">{art.description}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            {art.category ? (
                              <Badge variant="outline" className="text-xs">
                                <FolderTree className="mr-1 h-3 w-3" />
                                {art.category.name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {art.quantity_available}
                            {isLow && (
                              <AlertTriangle className="ml-2 inline h-4 w-4 text-warning" />
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">{art.quantity_reserved}</TableCell>
                          <TableCell>{art.unit}</TableCell>
                          <TableCell className="text-right">
                            {(art as any).prix_reference ? (
                              <div className="flex items-center justify-end gap-1">
                                <span className="font-mono text-sm">{Math.ceil((art as any).prix_reference as number).toLocaleString('fr-FR')}</span>
                                <Badge variant="outline" className="text-[10px] px-1">₣</Badge>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{art.location || '-'}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[art.status]}>
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {STOCK_STATUS_LABELS[art.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link to={`/stock/${art.id}`}>
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

      {/* Add Article Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un article au stock</DialogTitle>
            <DialogDescription>
              Créez un nouvel article dans l'inventaire avec sa quantité initiale.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {/* Désignation */}
            <div className="space-y-2">
              <Label htmlFor="designation" className="text-sm font-medium">
                Désignation <span className="text-destructive">*</span>
              </Label>
              <Input
                id="designation"
                value={newArticle.designation}
                onChange={(e) => setNewArticle({ ...newArticle, designation: e.target.value })}
                placeholder="Ex: Câble électrique 2.5mm²"
                className="h-11"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Description
              </Label>
              <Textarea
                id="description"
                value={newArticle.description}
                onChange={(e) => setNewArticle({ ...newArticle, description: e.target.value })}
                placeholder="Caractéristiques, références, spécifications..."
                rows={3}
              />
            </div>

            {/* Unité */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Unité de mesure <span className="text-destructive">*</span>
              </Label>
              {!customUnit ? (
                <div className="flex gap-2">
                  <Select
                    value={STOCK_UNITS.find(u => u.value === newArticle.unit) ? newArticle.unit : ''}
                    onValueChange={(v) => setNewArticle({ ...newArticle, unit: v })}
                  >
                    <SelectTrigger className="h-11 flex-1">
                      <SelectValue placeholder="Sélectionner une unité" />
                    </SelectTrigger>
                    <SelectContent>
                      {STOCK_UNITS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => { setCustomUnit(true); setNewArticle({ ...newArticle, unit: '' }); }}
                    className="h-11"
                  >
                    Autre
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={newArticle.unit}
                    onChange={(e) => setNewArticle({ ...newArticle, unit: e.target.value })}
                    placeholder="Entrer une unité personnalisée"
                    className="h-11 flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => { setCustomUnit(false); setNewArticle({ ...newArticle, unit: 'unité' }); }}
                    className="h-11"
                  >
                    Liste
                  </Button>
                </div>
              )}
            </div>

            {/* Quantités */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quantity" className="text-sm font-medium">
                  Quantité initiale <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min={0}
                  step="0.01"
                  value={newArticle.quantity_available}
                  onChange={(e) => setNewArticle({ ...newArticle, quantity_available: Number(e.target.value) })}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">Stock disponible à la création</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity_min" className="text-sm font-medium">
                  Seuil d'alerte
                </Label>
                <Input
                  id="quantity_min"
                  type="number"
                  min={0}
                  step="0.01"
                  value={newArticle.quantity_min}
                  onChange={(e) => setNewArticle({ ...newArticle, quantity_min: Number(e.target.value) })}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">Alerte si stock ≤ ce seuil</p>
              </div>
            </div>

            {/* Catégorie */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Catégorie
              </Label>
              <CategorySelector
                value={newArticle.category_id}
                onChange={(v) => setNewArticle({ ...newArticle, category_id: v })}
                placeholder="Sélectionner une catégorie"
              />
            </div>

            {/* Emplacement */}
            <div className="space-y-2">
              <Label htmlFor="location" className="text-sm font-medium">
                Emplacement
              </Label>
              <Input
                id="location"
                value={newArticle.location}
                onChange={(e) => setNewArticle({ ...newArticle, location: e.target.value })}
                placeholder="Ex: Entrepôt A - Rayon 3 - Étagère B"
                className="h-11"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
              Annuler
            </Button>
            <Button onClick={handleAddArticle} disabled={isSaving || !newArticle.designation.trim() || !newArticle.unit.trim()}>
              {isSaving ? 'Enregistrement...' : 'Créer l\'article'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
