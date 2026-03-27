import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Search, RefreshCw, Calculator } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface CUMPRow {
  id: string;
  article_stock_id: string;
  article_code: string;
  article_designation: string;
  article_unit: string;
  date_mouvement: string;
  movement_type: string;
  quantity: number;
  prix_unitaire: number;
  montant_total: number;
  quantity_before: number;
  quantity_after: number;
  reference: string;
  da_id: string | null;
  bl_id: string | null;
  rn: number;
}

const fmtInt = (n: number) => Math.ceil(Math.abs(n)).toLocaleString('fr-FR');
const fmtCump = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export default function StockCUMPTab() {
  const { toast } = useToast();
  const [data, setData] = useState<CUMPRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [articleFilter, setArticleFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from('stock_cump_view' as any)
        .select('*')
        .order('article_code')
        .order('date_mouvement', { ascending: true });
      if (error) throw error;
      setData((rows as any) || []);
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique articles for filter
  const articles = useMemo(() => {
    const map = new Map<string, { id: string; code: string; designation: string }>();
    data.forEach((r) => {
      if (!map.has(r.article_stock_id)) {
        map.set(r.article_stock_id, { id: r.article_stock_id, code: r.article_code, designation: r.article_designation });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [data]);

  // Filter
  const filtered = useMemo(() => {
    return data.filter((r) => {
      const matchArticle = articleFilter === 'all' || r.article_stock_id === articleFilter;
      const matchSearch = !search.trim() ||
        r.article_code.toLowerCase().includes(search.toLowerCase()) ||
        r.article_designation.toLowerCase().includes(search.toLowerCase());
      return matchArticle && matchSearch;
    });
  }, [data, articleFilter, search]);

  // CUMP calculation: running weighted average per article
  // RULE: CUMP recalculated ONLY on entries. Exits use existing CUMP.
  const cumpData = useMemo(() => {
    const state: Record<string, { qty: number; value: number; cump: number }> = {};
    
    return filtered.map((row) => {
      const key = row.article_stock_id;
      if (!state[key]) state[key] = { qty: 0, value: 0, cump: 0 };
      const s = state[key];

      const stockAvant = s.qty;
      const valeurAvant = s.value;
      const cumpAvant = s.cump;
      let entreeQty = 0, entreeMontant = 0, sortieQty = 0, sortieMontant = 0;
      let anomalie = '';

      if (row.movement_type === 'entree') {
        entreeQty = row.quantity;
        entreeMontant = row.montant_total || (row.quantity * (row.prix_unitaire || 0));
        // CUMP formula: (previous_value + entry_value) / (previous_qty + entry_qty)
        const newQty = s.qty + entreeQty;
        const newValue = s.value + entreeMontant;
        s.qty = newQty;
        s.value = newValue;
        // If stock was 0, CUMP = entry unit price
        s.cump = newQty > 0 ? newValue / newQty : 0;
      } else if (row.movement_type === 'sortie') {
        sortieQty = row.quantity;
        if (sortieQty > s.qty) {
          anomalie = `⚠ Sortie (${sortieQty}) > Stock (${s.qty})`;
        }
        // Exit uses EXISTING CUMP — no recalculation
        sortieMontant = sortieQty * s.cump;
        s.qty -= sortieQty;
        s.value -= sortieMontant;
        if (s.qty <= 0) { s.qty = 0; s.value = 0; }
        // CUMP stays unchanged on exit
      } else if (row.movement_type === 'ajustement') {
        if (row.quantity_after > row.quantity_before) {
          // Adjustment UP = treated as entry (recalculates CUMP only if value provided)
          entreeQty = row.quantity;
          entreeMontant = row.montant_total || 0;
          const newQty = s.qty + entreeQty;
          const newValue = s.value + entreeMontant;
          s.qty = newQty;
          s.value = newValue;
          if (entreeMontant > 0 && newQty > 0) {
            s.cump = newValue / newQty;
          }
          // If no value provided, CUMP unchanged (qty-only adjustment)
        } else {
          // Adjustment DOWN = treated as exit (CUMP unchanged)
          sortieQty = row.quantity;
          sortieMontant = sortieQty * s.cump;
          s.qty -= sortieQty;
          s.value -= sortieMontant;
          if (s.qty <= 0) { s.qty = 0; s.value = 0; }
        }
      }

      return {
        ...row,
        stock_avant: stockAvant,
        valeur_avant: valeurAvant,
        cump_avant: cumpAvant,
        entree_qty: entreeQty,
        entree_montant: entreeMontant,
        sortie_qty: sortieQty,
        sortie_montant: sortieMontant,
        stock_apres: s.qty,
        cump: s.cump,
        valeur_stock: s.value,
        anomalie,
      };
    });
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Info */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Calculator className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Tableau CUMP — Coût Unitaire Moyen Pondéré</p>
              <p>Ce tableau recalcule le CUMP en temps réel pour chaque mouvement. Aucun champ n'est modifiable — tout est dérivé automatiquement des mouvements de stock.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtres */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher un article..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={articleFilter} onValueChange={setArticleFilter}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Tous les articles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les articles</SelectItem>
                {articles.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code} — {a.designation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tableau CUMP */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{cumpData.length} ligne{cumpData.length !== 1 ? 's' : ''}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : cumpData.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">Aucune donnée CUMP</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Stock avant</TableHead>
                    <TableHead className="text-right bg-success/5">Entrée Qté</TableHead>
                    <TableHead className="text-right bg-success/5">Entrée Montant</TableHead>
                    <TableHead className="text-right bg-destructive/5">Sortie Qté</TableHead>
                    <TableHead className="text-right bg-destructive/5">Sortie Montant</TableHead>
                    <TableHead className="text-right bg-primary/5">Stock après</TableHead>
                    <TableHead className="text-right bg-primary/5 font-bold">CUMP</TableHead>
                    <TableHead className="text-right bg-primary/5 font-bold">Valeur Stock</TableHead>
                    <TableHead>Anomalie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cumpData.map((row, i) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link to={`/stock/${row.article_stock_id}`}>
                          <Badge variant="outline" className="font-mono text-xs cursor-pointer hover:bg-accent">
                            {row.article_code}
                          </Badge>
                        </Link>
                        <div className="text-xs text-muted-foreground truncate max-w-[150px]">{row.article_designation}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(row.date_mouvement), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">{row.stock_avant}</TableCell>
                      <TableCell className="text-right font-mono text-xs bg-success/5">
                        {row.entree_qty > 0 ? <span className="text-success font-semibold">+{row.entree_qty}</span> : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs bg-success/5">
                        {row.entree_montant > 0 ? <span className="text-success">{fmtInt(row.entree_montant)}</span> : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs bg-destructive/5">
                        {row.sortie_qty > 0 ? <span className="text-destructive">-{row.sortie_qty}</span> : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs bg-destructive/5">
                        {row.sortie_montant > 0 ? <span className="text-destructive">{fmtInt(row.sortie_montant)}</span> : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs bg-primary/5 font-bold">{Math.round(row.stock_apres)}</TableCell>
                      <TableCell className="text-right font-mono text-xs bg-primary/5 font-bold">{fmtCump(row.cump)}</TableCell>
                      <TableCell className="text-right font-mono text-xs bg-primary/5 font-bold">{fmtInt(row.valeur_stock)} ₣</TableCell>
                      {row.anomalie && (
                        <TableCell className="text-xs text-destructive font-medium">{row.anomalie}</TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
