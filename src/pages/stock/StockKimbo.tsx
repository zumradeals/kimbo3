import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Package,
  ArrowLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface StockKimboRow {
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
  quantity_available: number;
  status: string;
}

const formatMontant = (n: number) =>
  Math.ceil(n).toLocaleString('fr-FR');

export default function StockKimbo() {
  const { toast } = useToast();
  const [data, setData] = useState<StockKimboRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classeFilter, setClasseFilter] = useState<string>('all');
  const [condFilter, setCondFilter] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

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
      console.error('Error fetching stock kimbo view:', error);
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return data.filter((r) => {
      const matchSearch =
        !search.trim() ||
        r.code.toLowerCase().includes(search.toLowerCase()) ||
        r.designation.toLowerCase().includes(search.toLowerCase());
      const matchClasse =
        classeFilter === 'all' || String(r.classe_comptable) === classeFilter;
      const matchCond =
        condFilter === 'all' || r.conditionnement === condFilter;
      return matchSearch && matchClasse && matchCond;
    });
  }, [data, search, classeFilter, condFilter]);

  // Totaux
  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => ({
        entrees_montant: acc.entrees_montant + r.entrees_montant,
        sorties_montant: acc.sorties_montant + r.sorties_montant,
        stock_final_montant: acc.stock_final_montant + r.stock_final_montant,
      }),
      { entrees_montant: 0, sorties_montant: 0, stock_final_montant: 0 }
    );
  }, [filtered]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link to="/stock">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-serif text-2xl font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-primary" />
                État du Stock KIMBO
              </h1>
              <p className="text-muted-foreground">
                Vue calculée dynamiquement à partir des mouvements de stock
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={fetchData}>
            Actualiser
          </Button>
        </div>

        {/* Résumé */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-xl font-bold text-success">
                  {formatMontant(totals.entrees_montant)} ₣
                </p>
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
                <p className="text-xl font-bold text-destructive">
                  {formatMontant(totals.sorties_montant)} ₣
                </p>
                <p className="text-sm text-muted-foreground">Total Sorties</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">
                  {formatMontant(totals.stock_final_montant)} ₣
                </p>
                <p className="text-sm text-muted-foreground">
                  Valeur Stock Final
                </p>
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
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Classe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes classes</SelectItem>
                  {[2, 3, 4, 5, 6, 7].map((c) => (
                    <SelectItem key={c} value={String(c)}>
                      Classe {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={condFilter} onValueChange={setCondFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Conditionnement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="durable">Durable</SelectItem>
                  <SelectItem value="perissable">Périssable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tableau KIMBO */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {filtered.length} article{filtered.length !== 1 ? 's' : ''}
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
                      <TableHead rowSpan={2} className="border-r align-middle">Classe</TableHead>
                      <TableHead colSpan={3} className="text-center border-r bg-muted/30">STOCK INITIAL</TableHead>
                      <TableHead colSpan={3} className="text-center border-r bg-success/5">ENTRÉES</TableHead>
                      <TableHead colSpan={3} className="text-center border-r bg-destructive/5">SORTIES</TableHead>
                      <TableHead colSpan={3} className="text-center bg-primary/5">STOCK FINAL</TableHead>
                      <TableHead rowSpan={2} className="border-l align-middle">Unité</TableHead>
                      <TableHead rowSpan={2} className="border-l align-middle text-center">Pièces</TableHead>
                      <TableHead rowSpan={2} className="border-l align-middle">Cond.</TableHead>
                    </TableRow>
                    <TableRow>
                      {/* Stock initial */}
                      <TableHead className="text-right text-xs bg-muted/30">Qté</TableHead>
                      <TableHead className="text-right text-xs bg-muted/30">PU</TableHead>
                      <TableHead className="text-right text-xs border-r bg-muted/30">Montant</TableHead>
                      {/* Entrées */}
                      <TableHead className="text-right text-xs bg-success/5">Qté</TableHead>
                      <TableHead className="text-right text-xs bg-success/5">PU</TableHead>
                      <TableHead className="text-right text-xs border-r bg-success/5">Montant</TableHead>
                      {/* Sorties */}
                      <TableHead className="text-right text-xs bg-destructive/5">Qté</TableHead>
                      <TableHead className="text-right text-xs bg-destructive/5">PU</TableHead>
                      <TableHead className="text-right text-xs border-r bg-destructive/5">Montant</TableHead>
                      {/* Stock final */}
                      <TableHead className="text-right text-xs bg-primary/5">Qté</TableHead>
                      <TableHead className="text-right text-xs bg-primary/5">PU</TableHead>
                      <TableHead className="text-right text-xs bg-primary/5">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => (
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
                          <div className="font-medium text-sm max-w-[200px] truncate">
                            {row.designation}
                          </div>
                          {row.category_name && (
                            <span className="text-xs text-muted-foreground">{row.category_name}</span>
                          )}
                        </TableCell>
                        <TableCell className="border-r text-center">
                          <Badge variant="secondary" className="text-xs">
                            {row.classe_comptable || '-'}
                          </Badge>
                        </TableCell>
                        {/* Stock initial */}
                        <TableCell className="text-right font-mono text-xs bg-muted/10">
                          {row.stock_initial_qty}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs bg-muted/10">
                          {formatMontant(row.stock_initial_prix)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs border-r bg-muted/10">
                          {formatMontant(row.stock_initial_montant)}
                        </TableCell>
                        {/* Entrées */}
                        <TableCell className="text-right font-mono text-xs bg-success/5">
                          <span className={row.entrees_qty > 0 ? 'text-success font-semibold' : ''}>
                            {row.entrees_qty}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs bg-success/5">
                          {formatMontant(row.entrees_prix_unitaire)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs border-r bg-success/5">
                          <span className={row.entrees_montant > 0 ? 'text-success font-semibold' : ''}>
                            {formatMontant(row.entrees_montant)}
                          </span>
                        </TableCell>
                        {/* Sorties */}
                        <TableCell className="text-right font-mono text-xs bg-destructive/5">
                          <span className={row.sorties_qty > 0 ? 'text-destructive font-semibold' : ''}>
                            {row.sorties_qty}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs bg-destructive/5">
                          {formatMontant(row.sorties_prix_unitaire)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs border-r bg-destructive/5">
                          <span className={row.sorties_montant > 0 ? 'text-destructive font-semibold' : ''}>
                            {formatMontant(row.sorties_montant)}
                          </span>
                        </TableCell>
                        {/* Stock final */}
                        <TableCell className="text-right font-mono text-xs bg-primary/5 font-bold">
                          {row.stock_final_qty}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs bg-primary/5">
                          {formatMontant(row.stock_final_prix_unitaire)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs bg-primary/5 font-bold">
                          {formatMontant(row.stock_final_montant)}
                        </TableCell>
                        {/* Détails article */}
                        <TableCell className="border-l text-xs">{row.unit}</TableCell>
                        <TableCell className="border-l text-center text-xs">
                          {row.nombre_pieces || 1}
                        </TableCell>
                        <TableCell className="border-l">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${
                              row.conditionnement === 'perissable'
                                ? 'bg-warning/10 text-warning'
                                : 'bg-muted'
                            }`}
                          >
                            {row.conditionnement === 'perissable'
                              ? 'Périssable'
                              : 'Durable'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Ligne Totaux */}
                    <TableRow className="bg-muted/20 font-bold">
                      <TableCell colSpan={4} className="border-r text-right">
                        TOTAUX
                      </TableCell>
                      <TableCell colSpan={3} className="text-right border-r bg-muted/10">
                        -
                      </TableCell>
                      <TableCell colSpan={2} className="bg-success/5" />
                      <TableCell className="text-right font-mono text-sm border-r bg-success/5 text-success">
                        {formatMontant(totals.entrees_montant)} ₣
                      </TableCell>
                      <TableCell colSpan={2} className="bg-destructive/5" />
                      <TableCell className="text-right font-mono text-sm border-r bg-destructive/5 text-destructive">
                        {formatMontant(totals.sorties_montant)} ₣
                      </TableCell>
                      <TableCell colSpan={2} className="bg-primary/5" />
                      <TableCell className="text-right font-mono text-sm bg-primary/5">
                        {formatMontant(totals.stock_final_montant)} ₣
                      </TableCell>
                      <TableCell colSpan={3} className="border-l" />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Note explicative */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <BarChart3 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">
                  Comment lire ce tableau ?
                </p>
                <p>
                  Ce tableau est <strong>entièrement calculé</strong> à partir
                  des mouvements de stock. Aucune valeur n'est saisie
                  manuellement.
                </p>
                <p>
                  <strong>Stock Final</strong> = Stock Initial + Entrées -
                  Sorties. Les montants sont calculés automatiquement à partir
                  des prix unitaires des mouvements.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
