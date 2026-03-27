import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AddArticleToStockDialog } from '@/components/stock/AddArticleToStockDialog';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CategorySelector } from '@/components/stock/CategorySelector';
import { LOGISTICS_ROLES } from '@/types/kpm';
import {
  Search, Package, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Plus,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface StockRow {
  id: string;
  code: string;
  designation: string;
  unit: string;
  classe_comptable: number | null;
  nombre_pieces: number | null;
  conditionnement: string | null;
  category_name: string | null;
  location: string | null;
  date_premiere_entree: string | null;
  stock_initial_qty: number;
  stock_initial_prix: number;
  stock_initial_montant: number;
  entrees_qty: number;
  entrees_prix_unitaire: number;
  entrees_montant: number;
  sorties_qty: number;
  sorties_prix_unitaire: number;
  sorties_montant: number;
  stock_final_qty: number;
  stock_final_prix_unitaire: number;
  stock_final_montant: number;
  seuil_alerte: number;
  statut_auto: string;
  quantity_available: number;
  status: string;
}

const fmt = (n: number) => Math.ceil(n).toLocaleString('fr-FR');

const statusConfig: Record<string, { label: string; class: string }> = {
  disponible: { label: 'Disponible', class: 'bg-success/10 text-success border-success/20' },
  faible: { label: 'Stock faible', class: 'bg-warning/10 text-warning border-warning/20' },
  rupture: { label: 'Rupture', class: 'bg-destructive/10 text-destructive border-destructive/20' },
};

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
  { value: 'lot', label: 'Lot' },
];

export default function StockStandardTab() {
  const { user, roles, isAdmin, hasRole } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<StockRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classeFilter, setClasseFilter] = useState('all');
  const [condFilter, setCondFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // CRUD state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddToStockDialog, setShowAddToStockDialog] = useState(false);
  const [stocks, setStocks] = useState<{ id: string; nom: string }[]>([]);
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const [stockArticleIds, setStockArticleIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [customUnit, setCustomUnit] = useState(false);
  const [newArticle, setNewArticle] = useState({
    designation: '',
    description: '',
    unit: 'unité',
    quantity_available: 0,
    quantity_min: 0,
    location: '',
    category_id: null as string | null,
    classe_comptable: 3,
    nombre_pieces: 1,
    conditionnement: 'durable' as 'durable' | 'perissable',
    prix_reference: null as number | null,
    prix_reference_note: '',
  });

  const isLogistics = roles.some((r) => LOGISTICS_ROLES.includes(r));
  const isDAF = hasRole('daf');
  const canManage = isLogistics || isAdmin || isDAF;

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from('stock_kimbo_view' as any)
        .select('*')
        .order('code');
      if (error) throw error;
      setData((rows as any) || []);
    } catch (error: any) {
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
      const { data: codeData, error: codeError } = await supabase.rpc('generate_article_code');
      if (codeError) throw codeError;

      const { error } = await supabase.from('articles_stock').insert({
        code: codeData as string,
        designation: newArticle.designation,
        description: newArticle.description || null,
        unit: newArticle.unit,
        quantity_available: newArticle.quantity_available,
        quantity_min: newArticle.quantity_min || null,
        location: newArticle.location || null,
        category_id: newArticle.category_id,
        classe_comptable: newArticle.classe_comptable,
        nombre_pieces: newArticle.nombre_pieces,
        conditionnement: newArticle.conditionnement,
        prix_reference: newArticle.prix_reference,
        prix_reference_note: newArticle.prix_reference_note || null,
        prix_reference_updated_at: newArticle.prix_reference ? new Date().toISOString() : null,
        created_by: user?.id,
      });
      if (error) throw error;

      toast({ title: 'Succès', description: 'Article créé avec succès.' });
      setShowAddDialog(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setNewArticle({
      designation: '', description: '', unit: 'unité', quantity_available: 0,
      quantity_min: 0, location: '', category_id: null, classe_comptable: 3,
      nombre_pieces: 1, conditionnement: 'durable', prix_reference: null, prix_reference_note: '',
    });
    setCustomUnit(false);
  };

  const filtered = useMemo(() => {
    return data.filter((r) => {
      const matchSearch = !search.trim() ||
        r.code.toLowerCase().includes(search.toLowerCase()) ||
        r.designation.toLowerCase().includes(search.toLowerCase());
      const matchClasse = classeFilter === 'all' || String(r.classe_comptable) === classeFilter;
      const matchCond = condFilter === 'all' || r.conditionnement === condFilter;
      const matchStatus = statusFilter === 'all' || r.statut_auto === statusFilter;
      return matchSearch && matchClasse && matchCond && matchStatus;
    });
  }, [data, search, classeFilter, condFilter, statusFilter]);

  const totals = useMemo(() => filtered.reduce((acc, r) => ({
    entrees: acc.entrees + r.entrees_montant,
    sorties: acc.sorties + r.sorties_montant,
    stock: acc.stock + r.stock_final_montant,
  }), { entrees: 0, sorties: 0, stock: 0 }), [filtered]);

  const stats = useMemo(() => ({
    total: data.length,
    disponible: data.filter(r => r.statut_auto === 'disponible').length,
    faible: data.filter(r => r.statut_auto === 'faible').length,
    rupture: data.filter(r => r.statut_auto === 'rupture').length,
  }), [data]);

  return (
    <div className="space-y-6">
      {/* Header with CRUD button */}
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvel article
          </Button>
        </div>
      )}

      {/* KPIs */}
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
              <TrendingUp className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-xl font-bold text-success">{fmt(totals.entrees)} ₣</p>
              <p className="text-sm text-muted-foreground">Total Entrées</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
              <TrendingDown className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-xl font-bold text-destructive">{fmt(totals.sorties)} ₣</p>
              <p className="text-sm text-muted-foreground">Total Sorties</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.faible + stats.rupture}</p>
              <p className="text-sm text-muted-foreground">Alertes stock</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par code ou désignation..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={classeFilter} onValueChange={setClasseFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Classe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes classes</SelectItem>
                {[2, 3, 4, 5, 6, 7].map((c) => (
                  <SelectItem key={c} value={String(c)}>Classe {c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={condFilter} onValueChange={setCondFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Conditionnement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="durable">Durable</SelectItem>
                <SelectItem value="perissable">Périssable</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="disponible">Disponible</SelectItem>
                <SelectItem value="faible">Stock faible</SelectItem>
                <SelectItem value="rupture">Rupture</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tableau */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {filtered.length} article{filtered.length !== 1 ? 's' : ''} — Valeur stock : {fmt(totals.stock)} ₣
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4">Aucun article trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead rowSpan={2} className="border-r align-middle">Code</TableHead>
                    <TableHead rowSpan={2} className="border-r align-middle">Date entrée</TableHead>
                    <TableHead rowSpan={2} className="border-r align-middle">Désignation</TableHead>
                    
                    <TableHead rowSpan={2} className="border-r align-middle text-center">Cl.</TableHead>
                    <TableHead rowSpan={2} className="border-r align-middle">Unité</TableHead>
                    <TableHead rowSpan={2} className="border-r align-middle text-center">Pcs</TableHead>
                    <TableHead rowSpan={2} className="border-r align-middle">Cond.</TableHead>
                    <TableHead colSpan={3} className="text-center border-r bg-muted/30">STOCK INITIAL</TableHead>
                    <TableHead colSpan={3} className="text-center border-r bg-success/5">ENTRÉES</TableHead>
                    <TableHead colSpan={3} className="text-center border-r bg-destructive/5">SORTIES</TableHead>
                    <TableHead colSpan={3} className="text-center border-r bg-primary/5">STOCK ACTUEL</TableHead>
                    <TableHead rowSpan={2} className="border-r align-middle text-center">Seuil</TableHead>
                    <TableHead rowSpan={2} className="align-middle text-center">Statut</TableHead>
                    <TableHead rowSpan={2} className="align-middle">Empl.</TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead className="text-right text-xs bg-muted/30">Qté</TableHead>
                    <TableHead className="text-right text-xs bg-muted/30">PU</TableHead>
                    <TableHead className="text-right text-xs border-r bg-muted/30">Montant</TableHead>
                    <TableHead className="text-right text-xs bg-success/5">Qté</TableHead>
                    <TableHead className="text-right text-xs bg-success/5">PM</TableHead>
                    <TableHead className="text-right text-xs border-r bg-success/5">Montant</TableHead>
                    <TableHead className="text-right text-xs bg-destructive/5">Qté</TableHead>
                    <TableHead className="text-right text-xs bg-destructive/5">PM</TableHead>
                    <TableHead className="text-right text-xs border-r bg-destructive/5">Montant</TableHead>
                    <TableHead className="text-right text-xs bg-primary/5">Qté</TableHead>
                    <TableHead className="text-right text-xs bg-primary/5">PM</TableHead>
                    <TableHead className="text-right text-xs border-r bg-primary/5">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const sc = statusConfig[row.statut_auto] || statusConfig.disponible;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="border-r">
                          <Link to={`/stock/${row.id}`}>
                            <Badge variant="outline" className="font-mono text-xs cursor-pointer hover:bg-accent">
                              {row.code}
                            </Badge>
                          </Link>
                        </TableCell>
                        <TableCell className="border-r text-xs whitespace-nowrap">
                          {row.date_premiere_entree
                            ? format(new Date(row.date_premiere_entree), 'dd/MM/yyyy', { locale: fr })
                            : '-'}
                        </TableCell>
                        <TableCell className="border-r">
                          <div className="font-medium text-sm max-w-[180px] truncate">{row.designation}</div>
                          {row.category_name && <span className="text-xs text-muted-foreground">{row.category_name}</span>}
                        </TableCell>
                        
                        <TableCell className="border-r text-center">
                          <Badge variant="secondary" className="text-xs">{row.classe_comptable || '-'}</Badge>
                        </TableCell>
                        <TableCell className="border-r text-xs">{row.unit}</TableCell>
                        <TableCell className="border-r text-center text-xs">{row.nombre_pieces || 1}</TableCell>
                        <TableCell className="border-r">
                          <Badge variant="secondary" className={`text-[10px] ${row.conditionnement === 'perissable' ? 'bg-warning/10 text-warning' : 'bg-muted'}`}>
                            {row.conditionnement === 'perissable' ? 'Périssable' : 'Durable'}
                          </Badge>
                        </TableCell>
                        {/* Stock initial */}
                        <TableCell className="text-right font-mono text-xs bg-muted/10">{row.stock_initial_qty}</TableCell>
                        <TableCell className="text-right font-mono text-xs bg-muted/10">{fmt(row.stock_initial_prix)}</TableCell>
                        <TableCell className="text-right font-mono text-xs border-r bg-muted/10">{fmt(row.stock_initial_montant)}</TableCell>
                        {/* Entrées */}
                        <TableCell className="text-right font-mono text-xs bg-success/5">
                          <span className={row.entrees_qty > 0 ? 'text-success font-semibold' : ''}>{row.entrees_qty}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs bg-success/5">{fmt(row.entrees_prix_unitaire)}</TableCell>
                        <TableCell className="text-right font-mono text-xs border-r bg-success/5">
                          <span className={row.entrees_montant > 0 ? 'text-success font-semibold' : ''}>{fmt(row.entrees_montant)}</span>
                        </TableCell>
                        {/* Sorties */}
                        <TableCell className="text-right font-mono text-xs bg-destructive/5">
                          <span className={row.sorties_qty > 0 ? 'text-destructive font-semibold' : ''}>{row.sorties_qty}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs bg-destructive/5">{fmt(row.sorties_prix_unitaire)}</TableCell>
                        <TableCell className="text-right font-mono text-xs border-r bg-destructive/5">
                          <span className={row.sorties_montant > 0 ? 'text-destructive font-semibold' : ''}>{fmt(row.sorties_montant)}</span>
                        </TableCell>
                        {/* Stock actuel */}
                        <TableCell className="text-right font-mono text-xs bg-primary/5 font-bold">{row.stock_final_qty}</TableCell>
                        <TableCell className="text-right font-mono text-xs bg-primary/5">{fmt(row.stock_final_prix_unitaire)}</TableCell>
                        <TableCell className="text-right font-mono text-xs border-r bg-primary/5 font-bold">{fmt(row.stock_final_montant)}</TableCell>
                        {/* Seuil */}
                        <TableCell className="border-r text-center text-xs font-mono">{row.seuil_alerte || '-'}</TableCell>
                        {/* Statut auto */}
                        <TableCell className="text-center">
                          <Badge className={`text-[10px] ${sc.class}`}>{sc.label}</Badge>
                        </TableCell>
                        {/* Emplacement */}
                        <TableCell className="text-xs">{row.location || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Totaux */}
                  <TableRow className="bg-muted/20 font-bold">
                    <TableCell colSpan={7} className="border-r text-right">TOTAUX</TableCell>
                    <TableCell colSpan={3} className="text-right border-r bg-muted/10">-</TableCell>
                    <TableCell colSpan={2} className="bg-success/5" />
                    <TableCell className="text-right font-mono text-sm border-r bg-success/5 text-success">{fmt(totals.entrees)} ₣</TableCell>
                    <TableCell colSpan={2} className="bg-destructive/5" />
                    <TableCell className="text-right font-mono text-sm border-r bg-destructive/5 text-destructive">{fmt(totals.sorties)} ₣</TableCell>
                    <TableCell colSpan={2} className="bg-primary/5" />
                    <TableCell className="text-right font-mono text-sm border-r bg-primary/5">{fmt(totals.stock)} ₣</TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Note */}
      <Card>
        <CardContent className="py-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Tableau 100% dynamique</p>
            <p>Toutes les valeurs sont calculées à partir des mouvements de stock. Aucune modification directe n'est possible — toute variation passe par le module Mouvements.</p>
            <p><strong>Stock Actuel</strong> = Entrées cumulées − Sorties cumulées. Le <strong>Statut</strong> est automatique selon le seuil d'alerte.</p>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Nouvel Article */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un article au stock</DialogTitle>
            <DialogDescription>
              Créez un nouvel article dans l'inventaire avec sa quantité initiale.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4 max-h-[60vh] overflow-y-auto">
            {/* Désignation */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Désignation <span className="text-destructive">*</span>
              </Label>
              <Input
                value={newArticle.designation}
                onChange={(e) => setNewArticle({ ...newArticle, designation: e.target.value })}
                placeholder="Ex: Câble électrique 2.5mm²"
                className="h-11"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Description</Label>
              <Textarea
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
                        <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={() => { setCustomUnit(true); setNewArticle({ ...newArticle, unit: '' }); }} className="h-11">
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
                  <Button type="button" variant="outline" onClick={() => { setCustomUnit(false); setNewArticle({ ...newArticle, unit: 'unité' }); }} className="h-11">
                    Liste
                  </Button>
                </div>
              )}
            </div>

            {/* Quantités */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Quantité initiale <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={newArticle.quantity_available}
                  onChange={(e) => setNewArticle({ ...newArticle, quantity_available: Number(e.target.value) })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Seuil d'alerte</Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={newArticle.quantity_min}
                  onChange={(e) => setNewArticle({ ...newArticle, quantity_min: Number(e.target.value) })}
                  className="h-11"
                />
              </div>
            </div>

            {/* Catégorie */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Catégorie</Label>
              <CategorySelector
                value={newArticle.category_id}
                onChange={(v) => setNewArticle({ ...newArticle, category_id: v })}
                placeholder="Sélectionner une catégorie"
              />
            </div>

            {/* Classe comptable & Conditionnement */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Classe comptable</Label>
                <Select value={String(newArticle.classe_comptable)} onValueChange={(v) => setNewArticle({ ...newArticle, classe_comptable: parseInt(v) })}>
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
                  value={newArticle.nombre_pieces}
                  onChange={(e) => setNewArticle({ ...newArticle, nombre_pieces: parseInt(e.target.value) || 1 })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Conditionnement</Label>
                <Select value={newArticle.conditionnement} onValueChange={(v) => setNewArticle({ ...newArticle, conditionnement: v as 'durable' | 'perissable' })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="durable">Durable</SelectItem>
                    <SelectItem value="perissable">Périssable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Prix de référence */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Prix unitaire de référence (FCFA)</Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={newArticle.prix_reference ?? ''}
                  onChange={(e) => setNewArticle({ ...newArticle, prix_reference: e.target.value ? Number(e.target.value) : null })}
                  placeholder="Prix indicatif"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Source / Remarque</Label>
                <Input
                  value={newArticle.prix_reference_note}
                  onChange={(e) => setNewArticle({ ...newArticle, prix_reference_note: e.target.value })}
                  placeholder="Ex: tarif fournisseur X"
                  className="h-11"
                />
              </div>
            </div>

            {/* Emplacement */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Emplacement</Label>
              <Input
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
    </div>
  );
}
