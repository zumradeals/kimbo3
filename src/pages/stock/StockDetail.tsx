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
import { CategorySelector } from '@/components/stock/CategorySelector';
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
  FileText,
  Download,
  Filter,
  Info,
  Hash,
  Layers,
  BoxIcon,
  ExternalLink,
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
  const [kimboData, setKimboData] = useState<any>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementFilter, setMovementFilter] = useState<string>('all');
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

  // Edit form - now includes quantity_available, category_id, and reference price
  const [editForm, setEditForm] = useState({
    designation: '',
    description: '',
    unit: '',
    quantity_available: 0,
    quantity_min: 0,
    location: '',
    category_id: null as string | null,
    prix_reference: null as number | null,
    prix_reference_note: '',
    classe_comptable: 3,
    nombre_pieces: 1,
    conditionnement: 'durable' as 'durable' | 'perissable',
    code_barre: '',
    variante: '',
    marque: '',
    etat: 'bon',
  });

  const isLogistics = roles.some((r) => LOGISTICS_ROLES.includes(r));
  const isDAF = hasRole('daf');
  const canManage = isLogistics || isAdmin || isDAF;

  useEffect(() => {
    if (id) {
      fetchArticle();
      fetchMovements();
      fetchKimboData();
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
        category_id: data.category_id || null,
        prix_reference: (data as any).prix_reference || null,
        prix_reference_note: (data as any).prix_reference_note || '',
        classe_comptable: (data as any).classe_comptable || 3,
        nombre_pieces: (data as any).nombre_pieces || 1,
        conditionnement: (data as any).conditionnement || 'durable',
      });
      // Check if unit is custom
      setCustomUnit(!STOCK_UNITS.find(u => u.value === data.unit));
    } catch (error: any) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchKimboData = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_kimbo_view')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) setKimboData(data);
    } catch (e) {
      console.error('Error fetching KIMBO data:', e);
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
      let profilesById: Record<string, { id: string; first_name: string | null; last_name: string | null }> = {};
      if (actorIds.length > 0) {
        const { data: profilesData } = await supabase.rpc('get_public_profiles', {
          _user_ids: [...new Set(actorIds)] // dedupe
        });
        (profilesData || []).forEach((p: any) => {
          profilesById[p.id] = {
            id: p.id,
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
        reference: `ADJ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${article.id.slice(0, 8).toUpperCase()}`,
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
          category_id: editForm.category_id || null,
          prix_reference: editForm.prix_reference || null,
          prix_reference_note: editForm.prix_reference_note || null,
          classe_comptable: editForm.classe_comptable,
          nombre_pieces: editForm.nombre_pieces,
          conditionnement: editForm.conditionnement,
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
          reference: `EDIT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${article.id.slice(0, 8).toUpperCase()}`,
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

  const filteredMovements = movementFilter === 'all' 
    ? movements 
    : movements.filter(m => m.movement_type === movementFilter);

  const handleExportCSV = () => {
    const headers = ['Date', 'Type', 'Référence', 'Quantité', 'Prix unitaire', 'Montant', 'Avant', 'Après', 'Source', 'Observations'];
    const rows = filteredMovements.map(m => [
      format(new Date(m.created_at), 'dd/MM/yyyy HH:mm', { locale: fr }),
      STOCK_MOVEMENT_TYPE_LABELS[m.movement_type],
      m.reference || '',
      `${m.movement_type === 'sortie' ? '-' : ''}${m.quantity}`,
      m.prix_unitaire || '',
      m.montant_total || '',
      m.quantity_before,
      m.quantity_after,
      m.da_id ? 'DA' : m.bl_id ? 'BL' : m.note_frais_id ? 'NDF' : 'Manuel',
      m.observations || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mouvements-${(article as any).code || article.designation}-${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

        {/* Données KIMBO */}
        {kimboData ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Card className="border-primary/20">
                <CardContent className="pt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Stock Final</p>
                  <p className="text-2xl font-bold">{kimboData.stock_final_qty ?? 0} <span className="text-sm font-normal text-muted-foreground">{article.unit}</span></p>
                  <p className="text-xs text-primary font-mono mt-1">
                    {kimboData.stock_final_montant ? `${Math.ceil(kimboData.stock_final_montant).toLocaleString('fr-FR')} FCFA` : '—'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Stock Initial</p>
                  <p className="text-2xl font-bold">{kimboData.stock_initial_qty ?? 0} <span className="text-sm font-normal text-muted-foreground">{article.unit}</span></p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    {kimboData.stock_initial_montant ? `${Math.ceil(kimboData.stock_initial_montant).toLocaleString('fr-FR')} FCFA` : '—'}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-success/20">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-3.5 w-3.5 text-success" />
                    <p className="text-xs font-medium text-muted-foreground">Entrées</p>
                  </div>
                  <p className="text-2xl font-bold text-success">+{kimboData.entrees_qty ?? 0} <span className="text-sm font-normal text-muted-foreground">{article.unit}</span></p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    {kimboData.entrees_prix_unitaire ? `P.U. ${Math.ceil(kimboData.entrees_prix_unitaire).toLocaleString('fr-FR')}` : '—'}
                    {kimboData.entrees_montant ? ` • ${Math.ceil(kimboData.entrees_montant).toLocaleString('fr-FR')} FCFA` : ''}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-destructive/20">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                    <p className="text-xs font-medium text-muted-foreground">Sorties</p>
                  </div>
                  <p className="text-2xl font-bold text-destructive">-{kimboData.sorties_qty ?? 0} <span className="text-sm font-normal text-muted-foreground">{article.unit}</span></p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    {kimboData.sorties_prix_unitaire ? `P.U. ${Math.ceil(kimboData.sorties_prix_unitaire).toLocaleString('fr-FR')}` : '—'}
                    {kimboData.sorties_montant ? ` • ${Math.ceil(kimboData.sorties_montant).toLocaleString('fr-FR')} FCFA` : ''}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <CardContent className="flex items-center gap-3 pt-4">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Emplacement</p>
                    <p className="text-sm font-medium">{article.location || 'Non défini'}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 pt-4">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <div>
                    <p className="text-xs text-muted-foreground">Seuil d'alerte</p>
                    <p className="text-sm font-medium">{article.quantity_min || 0} {article.unit}</p>
                  </div>
                </CardContent>
              </Card>
              {(article as any).prix_reference && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="flex items-center gap-3 pt-4">
                    <span className="text-sm font-bold text-primary">₣</span>
                    <div>
                      <p className="text-xs text-muted-foreground">Prix de référence</p>
                      <p className="text-sm font-medium">{Math.ceil((article as any).prix_reference).toLocaleString('fr-FR')} FCFA/{article.unit}</p>
                      {(article as any).prix_reference_note && (
                        <p className="text-[10px] text-muted-foreground">{(article as any).prix_reference_note}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-primary" />
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
                  <TrendingDown className="h-5 w-5 text-warning" />
                  <div>
                    <p className="text-2xl font-bold">{movements.filter(m => m.movement_type === 'sortie').reduce((sum, m) => sum + m.quantity, 0)}</p>
                    <p className="text-xs text-muted-foreground">Total sorties</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
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
                  <TrendingDown className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="text-2xl font-bold">{article.quantity_min || 0}</p>
                    <p className="text-xs text-muted-foreground">Seuil alerte</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
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

        {/* Fiche article complète */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4" />
              Fiche technique
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Code article</p>
                  <p className="font-mono font-semibold">{(article as any).code || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Classe comptable</p>
                  <p className="font-semibold">Classe {(article as any).classe_comptable || 3}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <BoxIcon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Conditionnement</p>
                  <p className="font-semibold capitalize">{(article as any).conditionnement || 'Durable'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Nombre de pièces</p>
                  <p className="font-semibold">{(article as any).nombre_pieces || 1}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <span className="text-sm font-bold text-muted-foreground">₣</span>
                <div>
                  <p className="text-xs text-muted-foreground">Devise</p>
                  <p className="font-semibold">{(article as any).devise || 'XOF'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Créé le</p>
                  <p className="font-semibold">{format(new Date(article.created_at), 'dd/MM/yyyy', { locale: fr })}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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

        {/* Historique des mouvements enrichi */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Historique des mouvements</CardTitle>
                <CardDescription>
                  {movements.length} mouvement{movements.length > 1 ? 's' : ''} enregistré{movements.length > 1 ? 's' : ''}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={movementFilter} onValueChange={setMovementFilter}>
                  <SelectTrigger className="h-8 w-[140px]">
                    <Filter className="mr-1 h-3 w-3" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="entree">Entrées</SelectItem>
                    <SelectItem value="sortie">Sorties</SelectItem>
                    <SelectItem value="ajustement">Ajustements</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <Download className="mr-1 h-3 w-3" />
                  CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredMovements.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {movements.length === 0 ? 'Aucun mouvement enregistré' : 'Aucun mouvement pour ce filtre'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead className="text-right">Quantité</TableHead>
                      <TableHead className="text-right">P.U.</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead className="text-right">Après</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Par</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMovements.map((mvt) => {
                      const MvtIcon = movementIcons[mvt.movement_type];
                      return (
                        <TableRow key={mvt.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {format(new Date(mvt.created_at), 'dd/MM/yy HH:mm', { locale: fr })}
                          </TableCell>
                          <TableCell>
                            <div className={`flex items-center gap-1.5 text-xs font-medium ${movementColors[mvt.movement_type]}`}>
                              <MvtIcon className="h-3.5 w-3.5" />
                              {STOCK_MOVEMENT_TYPE_LABELS[mvt.movement_type]}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {mvt.reference || '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-bold">
                            {mvt.movement_type === 'sortie' ? '-' : '+'}{mvt.quantity}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {mvt.prix_unitaire ? `${Math.ceil(mvt.prix_unitaire).toLocaleString('fr-FR')}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {mvt.montant_total ? `${Math.ceil(mvt.montant_total).toLocaleString('fr-FR')}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-medium">
                            {mvt.quantity_after}
                          </TableCell>
                          <TableCell>
                            {mvt.da_id ? (
                              <Link to={`/demandes-achat/${mvt.da_id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                <FileText className="h-3 w-3" />
                                DA
                                <ExternalLink className="h-2.5 w-2.5" />
                              </Link>
                            ) : mvt.bl_id ? (
                              <Link to={`/bons-livraison/${mvt.bl_id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                <FileText className="h-3 w-3" />
                                BL
                                <ExternalLink className="h-2.5 w-2.5" />
                              </Link>
                            ) : mvt.note_frais_id ? (
                              <Link to={`/notes-frais/${mvt.note_frais_id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                <FileText className="h-3 w-3" />
                                NDF
                                <ExternalLink className="h-2.5 w-2.5" />
                              </Link>
                            ) : (
                              <span className="text-xs text-muted-foreground">Manuel</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
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

            {/* Catégorie */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Catégorie</Label>
              <CategorySelector
                value={editForm.category_id}
                onChange={(v) => setEditForm({ ...editForm, category_id: v })}
                placeholder="Sélectionner une catégorie"
              />
            </div>

            {/* Classe comptable, Nombre de pièces, Conditionnement */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Classe comptable</Label>
                <Select value={String(editForm.classe_comptable)} onValueChange={(v) => setEditForm({ ...editForm, classe_comptable: parseInt(v) })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5, 6, 7].map((c) => (
                      <SelectItem key={c} value={String(c)}>Classe {c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Nombre de pièces</Label>
                <Input
                  type="number" min={1}
                  value={editForm.nombre_pieces}
                  onChange={(e) => setEditForm({ ...editForm, nombre_pieces: parseInt(e.target.value) || 1 })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Conditionnement</Label>
                <Select value={editForm.conditionnement} onValueChange={(v) => setEditForm({ ...editForm, conditionnement: v as 'durable' | 'perissable' })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="durable">Durable</SelectItem>
                    <SelectItem value="perissable">Périssable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Prix de référence (optionnel)</Label>
                <Badge variant="outline" className="text-xs">Indicatif</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={editForm.prix_reference ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, prix_reference: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Prix unitaire indicatif"
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">En FCFA, sera proposé lors du chiffrage</p>
                </div>
                <div className="space-y-1">
                  <Input
                    value={editForm.prix_reference_note}
                    onChange={(e) => setEditForm({ ...editForm, prix_reference_note: e.target.value })}
                    placeholder="Note (ex: tarif fournisseur X)"
                    className="h-11"
                  />
                </div>
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
