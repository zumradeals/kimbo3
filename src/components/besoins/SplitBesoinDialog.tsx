import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Split, AlertTriangle, Package, ShoppingCart } from 'lucide-react';

interface LigneRow {
  id: string;
  designation: string;
  quantity: number;
  unit: string;
  article_stock_id: string | null;
  stock_available: number | null;
  is_covered: boolean;
}

interface SplitBesoinDialogProps {
  besoinId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

export function SplitBesoinDialog({ besoinId, open, onOpenChange, onDone }: SplitBesoinDialogProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lignes, setLignes] = useState<LigneRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    void loadLignes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, besoinId]);

  const loadLignes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('besoin_lignes')
        .select('id, designation, quantity, unit, article_stock_id')
        .eq('besoin_id', besoinId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const stockIds = (data || [])
        .map((l) => l.article_stock_id)
        .filter((v): v is string => !!v);

      let stockMap: Record<string, number> = {};
      if (stockIds.length > 0) {
        const { data: stocks } = await supabase
          .from('articles_stock')
          .select('id, quantity_available')
          .in('id', stockIds);
        (stocks || []).forEach((s: any) => {
          stockMap[s.id] = Number(s.quantity_available) || 0;
        });
      }

      const rows: LigneRow[] = (data || []).map((l: any) => {
        const dispo = l.article_stock_id ? stockMap[l.article_stock_id] ?? 0 : null;
        const covered = l.article_stock_id ? (dispo ?? 0) >= Number(l.quantity) : false;
        return {
          id: l.id,
          designation: l.designation,
          quantity: Number(l.quantity),
          unit: l.unit,
          article_stock_id: l.article_stock_id,
          stock_available: dispo,
          is_covered: covered,
        };
      });

      setLignes(rows);
      // Pré-sélection: lignes NON couvertes par le stock (= à acheter → vont dans le besoin-fils)
      setSelected(new Set(rows.filter((r) => !r.is_covered).map((r) => r.id)));
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const remainingCount = lignes.length - selected.size;
  const canSubmit = selected.size > 0 && remainingCount > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('split_besoin', {
        _besoin_id: besoinId,
        _ligne_ids: Array.from(selected),
      });
      if (error) throw error;
      toast({
        title: 'Besoin scindé',
        description: `${selected.size} ligne(s) déplacée(s) dans un besoin-fils. ${remainingCount} ligne(s) conservée(s) ici.`,
      });
      onOpenChange(false);
      onDone?.();
      if (data) navigate(`/besoins/${data}`);
    } catch (e: any) {
      toast({ title: 'Scission impossible', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const summary = useMemo(() => {
    const toBuy = lignes.filter((l) => selected.has(l.id)).length;
    const toKeep = lignes.length - toBuy;
    return { toBuy, toKeep };
  }, [lignes, selected]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="h-5 w-5 text-primary" />
            Scinder ce besoin
          </DialogTitle>
          <DialogDescription>
            Cochez les lignes <strong>à déplacer dans un nouveau besoin-fils</strong> (typiquement
            les articles à acheter). Les lignes décochées resteront sur le besoin actuel (typiquement
            les articles disponibles en stock, à convertir en BL).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">Pré-sélection automatique</p>
              <p className="text-muted-foreground">
                Les lignes non couvertes par le stock disponible sont cochées par défaut.
              </p>
            </div>

            <div className="max-h-80 space-y-2 overflow-y-auto">
              {lignes.map((l) => {
                const isSelected = selected.has(l.id);
                return (
                  <label
                    key={l.id}
                    className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                      isSelected ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/30'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggle(l.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{l.designation}</p>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {l.quantity} {l.unit}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {l.article_stock_id ? (
                          l.is_covered ? (
                            <Badge variant="outline" className="border-success/40 text-success">
                              <Package className="mr-1 h-3 w-3" />
                              Stock dispo : {l.stock_available}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-warning/40 text-warning">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Stock insuffisant : {l.stock_available ?? 0}
                            </Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="border-orange-500/40 text-orange-600">
                            <ShoppingCart className="mr-1 h-3 w-3" />
                            Hors catalogue stock
                          </Badge>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/20 p-3 text-sm">
              <div>
                <p className="text-muted-foreground">Reste sur ce besoin</p>
                <p className="text-lg font-semibold">{summary.toKeep} ligne(s)</p>
              </div>
              <div>
                <p className="text-muted-foreground">Va dans le besoin-fils</p>
                <p className="text-lg font-semibold text-primary">{summary.toBuy} ligne(s)</p>
              </div>
            </div>

            {remainingCount === 0 && (
              <p className="text-sm text-destructive">
                Au moins une ligne doit rester sur le besoin d'origine.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Scission…' : 'Scinder le besoin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}