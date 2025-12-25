import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  ArticleStock,
  StockMovement,
  StockMovementType,
  StockStatus,
  STOCK_STATUS_LABELS,
  STOCK_MOVEMENT_TYPE_LABELS,
  LOGISTICS_ROLES,
} from '@/types/kpm';
import {
  ArrowLeft,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  Plus,
  Minus,
  RefreshCw,
  MapPin,
  Calendar,
  Trash2,
} from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

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

const movementColors: Record<StockMovementType, string> = {
  entree: 'text-success',
  sortie: 'text-destructive',
  ajustement: 'text-warning',
  reservation: 'text-primary',
  liberation: 'text-muted-foreground',
};

const movementIcons: Record<StockMovementType, React.ElementType> = {
  entree: TrendingUp,
  sortie: TrendingDown,
  ajustement: RefreshCw,
  reservation: Package,
  liberation: Package,
};

interface ChartData {
  date: string;
  quantity: number;
}

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

export default function StockDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, roles, isAdmin, hasRole } = useAuth();
  const { toast } = useToast();

  const [article, setArticle] = useState<ArticleStock | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [customUnit, setCustomUnit] = useState(false);

  // Adjustment form
  const [adjustForm, setAdjustForm] = useState({
    type: 'ajustement' as StockMovementType,
    quantity: 0,
    observations: '',
  });

  // Edit form - now includes quantity_available
  const [editForm, setEditForm] = useState({
    designation: '',
    description: '',
    unit: '',
    quantity_available: 0,
    quantity_min: 0,
    location: '',
  });

  const isLogistics = roles.some((r) => LOGISTICS_ROLES.includes(r));
  const isDAF = hasRole('daf');
  const canManage = isLogistics || isAdmin || isDAF;

  useEffect(() => {
    if (id) {
      fetchArticle();
      fetchMovements();
    }
  }, [id]);

  const fetchArticle = async () => {
    try {
      const { data, error } = await supabase
        .from('articles_stock')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        toast({ title: 'Erreur', description: 'Article introuvable.', variant: 'destructive' });
        navigate('/stock');
        return;
      }

      setArticle(data as ArticleStock);
      setEditForm({
        designation: data.designation,
        description: data.description || '',
        unit: data.unit,
        quantity_available: data.quantity_available,
        quantity_min: data.quantity_min || 0,
        location: data.location || '',
      });
      // Check if unit is custom
      setCustomUnit(!STOCK_UNITS.find(u => u.value === data.unit));
    } catch (error: any) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMovements = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('article_stock_id', id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const rawMvts = data || [];
      
      // Collect all actor IDs
      const actorIds = rawMvts.map(m => m.created_by).filter(Boolean) as string[];
      
      // Fetch profiles using the security definer function (bypasses RLS)
      let profilesById: Record<string, { first_name: string | null; last_name: string | null }> = {};
      if (actorIds.length > 0) {
        const { data: profilesData } = await supabase.rpc('get_public_profiles', {
          _user_ids: [...new Set(actorIds)] // dedupe
        });
        (profilesData || []).forEach((p: any) => {
          profilesById[p.id] = {
            first_name: p.first_name,
            last_name: p.last_name,
          };
        });
      }

      // Enrich movements with profile data
      const mvts = rawMvts.map(m => ({
        ...m,
        created_by_profile: m.created_by ? profilesById[m.created_by] || null : null,
      })) as StockMovement[];
      
      setMovements(mvts);

      // Build chart data from movements (reverse to get chronological order)
      const sortedMvts = [...mvts].reverse();
      const chartPoints: ChartData[] = [];
      
      if (sortedMvts.length > 0) {
        sortedMvts.forEach((m) => {
          chartPoints.push({
            date: format(new Date(m.created_at), 'dd/MM', { locale: fr }),
            quantity: m.quantity_after,
          });
        });
      }
      
      setChartData(chartPoints);
    } catch (error: any) {
      console.error('Error fetching movements:', error);
    }
  };

  const handleAdjustment = async () => {
    if (!article || adjustForm.quantity <= 0) {
      toast({ title: 'Erreur', description: 'Quantité invalide.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const quantityBefore = article.quantity_available;
      let quantityAfter = quantityBefore;
      let movementQuantity = adjustForm.quantity;

      switch (adjustForm.type) {
        case 'entree':
          quantityAfter = quantityBefore + adjustForm.quantity;
          break;
        case 'sortie':
          if (adjustForm.quantity > quantityBefore) {
            toast({ title: 'Erreur', description: 'Quantité insuffisante.', variant: 'destructive' });
            setIsSaving(false);
            return;
          }
          quantityAfter = quantityBefore - adjustForm.quantity;
          movementQuantity = -adjustForm.quantity;
          break;
        case 'ajustement':
          quantityAfter = adjustForm.quantity;
          movementQuantity = adjustForm.quantity - quantityBefore;
          break;
        default:
          break;
      }

      // Create movement record
      const { error: movementError } = await supabase.from('stock_movements').insert({
        article_stock_id: article.id,
        movement_type: adjustForm.type,
        quantity: Math.abs(movementQuantity),
        quantity_before: quantityBefore,
        quantity_after: quantityAfter,
        observations: adjustForm.observations || null,
        created_by: user?.id,
      });

      if (movementError) throw movementError;

      // Update article quantity
      const { error: updateError } = await supabase
        .from('articles_stock')
        .update({ quantity_available: quantityAfter })
        .eq('id', article.id);

      if (updateError) throw updateError;

      toast({ 
        title: 'Ajustement effectué', 
        description: `Stock mis à jour: ${quantityBefore} → ${quantityAfter}` 
      });
      
      setShowAdjustDialog(false);
      setAdjustForm({ type: 'ajustement', quantity: 0, observations: '' });
      fetchArticle();
      fetchMovements();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!article || !editForm.designation.trim()) {
      toast({ title: 'Erreur', description: 'La désignation est requise.', variant: 'destructive' });
      return;
    }

    if (!editForm.unit.trim()) {
      toast({ title: 'Erreur', description: 'L\'unité est requise.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const quantityChanged = editForm.quantity_available !== article.quantity_available;
      
      // Update article
      const { error } = await supabase
        .from('articles_stock')
        .update({
          designation: editForm.designation,
          description: editForm.description || null,
          unit: editForm.unit,
          quantity_available: editForm.quantity_available,
          quantity_min: editForm.quantity_min || null,
          location: editForm.location || null,
        })
        .eq('id', article.id);

      if (error) throw error;

      // If quantity changed, create a movement record for traceability
      if (quantityChanged) {
        const { error: movementError } = await supabase.from('stock_movements').insert({
          article_stock_id: article.id,
          movement_type: 'ajustement',
          quantity: Math.abs(editForm.quantity_available - article.quantity_available),
          quantity_before: article.quantity_available,
          quantity_after: editForm.quantity_available,
          observations: 'Modification via édition article',
          created_by: user?.id,
        });

        if (movementError) {
          console.error('Error creating movement:', movementError);
        }
      }

      toast({ title: 'Article mis à jour' });
      setShowEditDialog(false);
      fetchArticle();
      if (quantityChanged) fetchMovements();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!article) return;
    
    setIsSaving(true);
    try {
      // Vérifier s'il y a des mouvements validés (pas d'ajustement initial)
      const { count, error: countError } = await supabase
        .from('stock_movements')
        .select('id', { count: 'exact', head: true })
        .eq('article_stock_id', article.id)
        .not('movement_type', 'eq', 'ajustement');
      
      if (countError) throw countError;
      
      if (count && count > 0) {
        toast({ 
          title: 'Suppression impossible', 
          description: `Cet article a ${count} mouvement(s) validé(s). Impossible de le supprimer.`,
          variant: 'destructive' 
        });
        setIsSaving(false);
        setShowDeleteDialog(false);
        return;
      }

      // Delete associated stock movements first
      const { error: movementsError } = await supabase
        .from('stock_movements')
        .delete()
        .eq('article_stock_id', article.id);
      
      if (movementsError) throw movementsError;

      // Delete the article
      const { error } = await supabase
        .from('articles_stock')
        .delete()
        .eq('id', article.id);

      if (error) throw error;

      toast({ title: 'Article supprimé', description: 'L\'article a été retiré du stock.' });
      navigate('/stock');
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
      setShowDeleteDialog(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!article) return null;

  const StatusIcon = statusIcons[article.status];
  const isLowStock = article.quantity_min && article.quantity_available <= article.quantity_min;

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/stock">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-2xl font-bold text-foreground">
                  {article.designation}
                </h1>
                <Badge className={statusColors[article.status]}>
                  <StatusIcon className="mr-1 h-3 w-3" />
                  {STOCK_STATUS_LABELS[article.status]}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Article de stock • {article.unit}
              </p>
            </div>
          </div>

          {canManage && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
                Modifier
              </Button>
              <Button size="sm" onClick={() => setShowAdjustDialog(true)}>
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Ajuster
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </Button>
            </div>
          )}
        </div>

        {/* Alerte stock bas */}
        {isLowStock && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <div>
                <p className="font-medium text-foreground">Stock critique</p>
                <p className="text-sm text-muted-foreground">
                  Le stock actuel ({article.quantity_available}) est inférieur ou égal au seuil minimum ({article.quantity_min}).
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Statistiques */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{article.quantity_available}</p>
                  <p className="text-xs text-muted-foreground">Disponible</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{article.quantity_reserved}</p>
                  <p className="text-xs text-muted-foreground">Réservé</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-bold truncate">{article.location || 'N/A'}</p>
                  <p className="text-xs text-muted-foreground">Emplacement</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{article.quantity_min || 0}</p>
                  <p className="text-xs text-muted-foreground">Seuil alerte</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Description */}
        {article.description && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{article.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Graphique d'évolution */}
        <Card>
          <CardHeader>
            <CardTitle>Évolution du stock</CardTitle>
            <CardDescription>
              Historique des quantités disponibles
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))' 
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="quantity"
                    name="Quantité"
                    stroke="hsl(32, 93%, 54%)"
                    fill="hsl(32, 93%, 54%)"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                Pas assez de données pour afficher le graphique
              </div>
            )}
          </CardContent>
        </Card>

        {/* Historique des mouvements */}
        <Card>
          <CardHeader>
            <CardTitle>Historique des mouvements</CardTitle>
            <CardDescription>
              Derniers mouvements de stock
            </CardDescription>
          </CardHeader>
          <CardContent>
            {movements.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Aucun mouvement enregistré
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Quantité</TableHead>
                      <TableHead className="text-right">Avant</TableHead>
                      <TableHead className="text-right">Après</TableHead>
                      <TableHead>Observations</TableHead>
                      <TableHead>Par</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((mvt) => {
                      const MvtIcon = movementIcons[mvt.movement_type];
                      return (
                        <TableRow key={mvt.id}>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {format(new Date(mvt.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className={`flex items-center gap-2 ${movementColors[mvt.movement_type]}`}>
                              <MvtIcon className="h-4 w-4" />
                              {STOCK_MOVEMENT_TYPE_LABELS[mvt.movement_type]}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            {mvt.movement_type === 'sortie' ? '-' : '+'}{mvt.quantity}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {mvt.quantity_before}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {mvt.quantity_after}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate">
                            {mvt.observations || '-'}
                          </TableCell>
                          <TableCell>
                            {mvt.created_by_profile 
                              ? `${mvt.created_by_profile.first_name || ''} ${mvt.created_by_profile.last_name || ''}`.trim()
                              : 'Système'
                            }
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

      {/* Dialog Ajustement */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuster le stock</DialogTitle>
            <DialogDescription>
              Stock actuel: <strong>{article.quantity_available}</strong> {article.unit}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type d'opération</Label>
              <Select
                value={adjustForm.type}
                onValueChange={(v) => setAdjustForm({ ...adjustForm, type: v as StockMovementType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entree">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-success" />
                      Entrée (ajouter au stock)
                    </div>
                  </SelectItem>
                  <SelectItem value="sortie">
                    <div className="flex items-center gap-2">
                      <Minus className="h-4 w-4 text-destructive" />
                      Sortie (retirer du stock)
                    </div>
                  </SelectItem>
                  <SelectItem value="ajustement">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-warning" />
                      Ajustement (définir la quantité exacte)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                {adjustForm.type === 'ajustement' ? 'Nouvelle quantité' : 'Quantité'}
              </Label>
              <Input
                type="number"
                min={0}
                value={adjustForm.quantity}
                onChange={(e) => setAdjustForm({ ...adjustForm, quantity: Number(e.target.value) })}
              />
              {adjustForm.type !== 'ajustement' && adjustForm.quantity > 0 && (
                <p className="text-xs text-muted-foreground">
                  Résultat: {article.quantity_available} 
                  {adjustForm.type === 'entree' ? ' + ' : ' - '}
                  {adjustForm.quantity} = {' '}
                  <strong>
                    {adjustForm.type === 'entree' 
                      ? article.quantity_available + adjustForm.quantity
                      : article.quantity_available - adjustForm.quantity
                    }
                  </strong>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Observations</Label>
              <Textarea
                value={adjustForm.observations}
                onChange={(e) => setAdjustForm({ ...adjustForm, observations: e.target.value })}
                placeholder="Raison de l'ajustement, inventaire, etc."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleAdjustment} disabled={isSaving}>
              {isSaving ? 'Enregistrement...' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Édition */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier l'article</DialogTitle>
            <DialogDescription>
              Mettre à jour les informations de l'article. Les modifications de quantité seront tracées.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {/* Désignation */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Désignation <span className="text-destructive">*</span>
              </Label>
              <Input
                value={editForm.designation}
                onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                className="h-11"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Description</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
                placeholder="Caractéristiques, références, spécifications..."
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
                    value={STOCK_UNITS.find(u => u.value === editForm.unit) ? editForm.unit : ''}
                    onValueChange={(v) => setEditForm({ ...editForm, unit: v })}
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
                    onClick={() => { setCustomUnit(true); }}
                    className="h-11"
                  >
                    Autre
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={editForm.unit}
                    onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                    placeholder="Entrer une unité personnalisée"
                    className="h-11 flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => { setCustomUnit(false); setEditForm({ ...editForm, unit: 'unité' }); }}
                    className="h-11"
                  >
                    Liste
                  </Button>
                </div>
              )}
            </div>

            {/* Quantité disponible */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Quantité disponible <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={editForm.quantity_available}
                onChange={(e) => setEditForm({ ...editForm, quantity_available: Number(e.target.value) })}
                className="h-11"
              />
              {article && editForm.quantity_available !== article.quantity_available && (
                <p className="text-xs text-warning">
                  Modification: {article.quantity_available} → {editForm.quantity_available} 
                  ({editForm.quantity_available > article.quantity_available ? '+' : ''}{editForm.quantity_available - article.quantity_available})
                  — Un mouvement d'ajustement sera créé
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Seuil d'alerte */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Seuil d'alerte</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editForm.quantity_min}
                  onChange={(e) => setEditForm({ ...editForm, quantity_min: Number(e.target.value) })}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">Alerte si stock ≤ seuil</p>
              </div>

              {/* Emplacement */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Emplacement</Label>
                <Input
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  placeholder="Entrepôt, rayon..."
                  className="h-11"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleEdit} 
              disabled={isSaving || !editForm.designation.trim() || !editForm.unit.trim()}
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Supprimer l'article</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer cet article du stock ? Cette action est irréversible et supprimera également tout l'historique des mouvements associés.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <p className="font-medium text-foreground">{article?.designation}</p>
              <p className="text-sm text-muted-foreground">
                Quantité actuelle : {article?.quantity_available} {article?.unit}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Annuler
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete} 
              disabled={isSaving}
            >
              {isSaving ? 'Suppression...' : 'Confirmer la suppression'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
