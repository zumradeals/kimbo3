import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Split, AlertTriangle, Package, ShoppingCart, ArrowLeft } from 'lucide-react';

interface LigneRow {
  id: string;
  designation: string;
  quantity: number;
  unit: string;
  article_stock_id: string | null;
  stock_available: number | null;
  is_covered: boolean;
  qty_to_move: number; // quantité ajustable à déplacer dans le besoin-fils
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
  const [step, setStep] = useState<'edit' | 'confirm'>('edit');

  useEffect(() => {
    if (!open) return;
    setStep('edit');
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
        const qty = Number(l.quantity);
        const covered = l.article_stock_id ? (dispo ?? 0) >= qty : false;
        // Déficit = ce qui manque en stock → suggestion de qté à déplacer
        let suggested = 0;
        if (!l.article_stock_id) {
          suggested = qty; // hors catalogue → tout acheter
        } else if (covered) {
          suggested = 0; // entièrement couvert → rien à acheter
        } else {
          suggested = Math.max(0, qty - (dispo ?? 0)); // déficit
        }
        return {
          id: l.id,
          designation: l.designation,
          quantity: qty,
          unit: l.unit,
          article_stock_id: l.article_stock_id,
          stock_available: dispo,
          is_covered: covered,
          qty_to_move: suggested,
        };
      });

      setLignes(rows);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const updateQty = (id: string, raw: string) => {
    const num = Number(raw);
    setLignes((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        let v = isNaN(num) ? 0 : num;
        if (v < 0) v = 0;
        if (v > l.quantity) v = l.quantity;
        return { ...l, qty_to_move: v };
      }),
    );
  };

  const setAll = (mode: 'all' | 'none' | 'suggested') => {
    setLignes((prev) =>
      prev.map((l) => {
        if (mode === 'all') return { ...l, qty_to_move: l.quantity };
        if (mode === 'none') return { ...l, qty_to_move: 0 };
        // suggested = recompute deficit
        let s = 0;
        if (!l.article_stock_id) s = l.quantity;
        else if (l.is_covered) s = 0;
        else s = Math.max(0, l.quantity - (l.stock_available ?? 0));
        return { ...l, qty_to_move: s };
      }),
    );
  };

  const totals = useMemo(() => {
    const totalQty = lignes.reduce((s, l) => s + l.quantity, 0);
    const moved = lignes.reduce((s, l) => s + l.qty_to_move, 0);
    const remaining = totalQty - moved;
    const movedLines = lignes.filter((l) => l.qty_to_move > 0).length;
    const fullyKeptLines = lignes.filter((l) => l.qty_to_move === 0).length;
    return { totalQty, moved, remaining, movedLines, fullyKeptLines };
  }, [lignes]);

  const canProceed = totals.moved > 0 && totals.remaining > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canProceed) return;
    setSubmitting(true);
    try {
      const moves = lignes
        .filter((l) => l.qty_to_move > 0)
        .map((l) => ({ ligne_id: l.id, quantity: l.qty_to_move }));
      const { data, error } = await supabase.rpc('split_besoin_qty', {
        _besoin_id: besoinId,
        _moves: moves as any,
      });
      if (error) throw error;
      toast({
        title: 'Besoin scindé',
        description: `${totals.moved} unité(s) déplacée(s) dans le besoin-fils, ${totals.remaining} conservée(s) ici.`,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="h-5 w-5 text-primary" />
            {step === 'edit' ? 'Scinder ce besoin' : 'Confirmer la scission'}
          </DialogTitle>
          <DialogDescription>
            {step === 'edit'
              ? 'Indiquez pour chaque ligne la quantité à déplacer dans le besoin-fils (à acheter). Le reste demeure sur le besoin actuel (à livrer en BL depuis le stock).'
              : 'Vérifiez la répartition avant de créer le besoin-fils. Cette action est irréversible (mais une nouvelle scission reste possible si nécessaire).'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : step === 'edit' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 p-3 text-sm">
              <div>
                <p className="font-medium">Suggestion automatique</p>
                <p className="text-muted-foreground">Quantité à déplacer = déficit de stock par ligne.</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setAll('suggested')}>
                  Suggéré
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setAll('all')}>
                  Tout déplacer
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setAll('none')}>
                  Tout garder
                </Button>
              </div>
            </div>

            <div className="max-h-[26rem] space-y-2 overflow-y-auto">
              {lignes.map((l) => {
                const moving = l.qty_to_move > 0;
                const partial = moving && l.qty_to_move < l.quantity;
                return (
                  <div
                    key={l.id}
                    className={`rounded-md border p-3 transition-colors ${
                      moving ? 'border-primary/50 bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{l.designation}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Demandé : <strong>{l.quantity} {l.unit}</strong>
                          </span>
                          {l.article_stock_id ? (
                            l.is_covered ? (
                              <Badge variant="outline" className="border-success/40 text-success">
                                <Package className="mr-1 h-3 w-3" />
                                Stock dispo : {l.stock_available}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-warning/40 text-warning">
                                <AlertTriangle className="mr-1 h-3 w-3" />
                                Stock : {l.stock_available ?? 0} (déficit {l.quantity - (l.stock_available ?? 0)})
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
                      <div className="flex items-center gap-2">
                        <div className="text-right text-xs text-muted-foreground">
                          <div>Qté à déplacer</div>
                          <div>(0 → {l.quantity})</div>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          max={l.quantity}
                          step="any"
                          value={l.qty_to_move}
                          onChange={(e) => updateQty(l.id, e.target.value)}
                          className="w-24"
                        />
                      </div>
                    </div>
                    {moving && (
                      <div className="mt-2 flex flex-wrap gap-3 text-xs">
                        <span className="text-primary">
                          → Fils : {l.qty_to_move} {l.unit}
                        </span>
                        <span className="text-muted-foreground">
                          → Reste ici : {l.quantity - l.qty_to_move} {l.unit}
                        </span>
                        {partial && (
                          <Badge variant="outline" className="border-primary/40 text-primary">
                            Scission partielle
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/20 p-3 text-sm">
              <div>
                <p className="text-muted-foreground">Reste sur ce besoin</p>
                <p className="text-lg font-semibold">{totals.remaining} unité(s)</p>
              </div>
              <div>
                <p className="text-muted-foreground">Va dans le besoin-fils</p>
                <p className="text-lg font-semibold text-primary">
                  {totals.moved} unité(s) sur {totals.movedLines} ligne(s)
                </p>
              </div>
            </div>

            {totals.moved > 0 && totals.remaining <= 0 && (
              <p className="text-sm text-destructive">
                Au moins une unité doit rester sur le besoin d'origine.
              </p>
            )}
            {totals.moved <= 0 && (
              <p className="text-sm text-muted-foreground">
                Aucune quantité n'est sélectionnée pour le besoin-fils.
              </p>
            )}
          </div>
        ) : (
          // CONFIRM STEP
          <div className="space-y-3">
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
              <p className="font-medium text-foreground">Récapitulatif</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>• Besoin-fils créé avec <strong className="text-primary">{totals.moved} unité(s)</strong> sur {totals.movedLines} ligne(s) → à convertir en <strong>DA</strong></li>
                <li>• Ce besoin conserve <strong>{totals.remaining} unité(s)</strong> → à convertir en <strong>BL</strong></li>
                <li>• Lien parent/enfant conservé pour traçabilité</li>
              </ul>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border p-2">
              {lignes
                .filter((l) => l.qty_to_move > 0)
                .map((l) => (
                  <div key={l.id} className="flex items-start justify-between gap-3 border-b py-2 last:border-b-0">
                    <div>
                      <p className="text-sm font-medium">{l.designation}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.qty_to_move === l.quantity ? 'Ligne entière déplacée' : `Scission partielle (sur ${l.quantity} ${l.unit})`}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-primary font-semibold">→ {l.qty_to_move} {l.unit}</div>
                      {l.qty_to_move < l.quantity && (
                        <div className="text-xs text-muted-foreground">
                          reste {l.quantity - l.qty_to_move} ici
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'edit' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Annuler
              </Button>
              <Button onClick={() => setStep('confirm')} disabled={!canProceed}>
                Continuer
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('edit')} disabled={submitting}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Modifier
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Scission…' : 'Confirmer et scinder'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}