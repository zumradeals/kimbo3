import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Entrepot, ENTREPOT_TYPE_LABELS } from '@/types/entrepot';
import { ArrowRight, Warehouse, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface StockTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleId?: string;
  articleName?: string;
  sourceEntrepotId?: string;
  availableQuantity?: number;
  unit?: string;
  onSuccess?: () => void;
}

export function StockTransferDialog({
  open,
  onOpenChange,
  articleId,
  articleName,
  sourceEntrepotId,
  availableQuantity = 0,
  unit = 'unité',
  onSuccess,
}: StockTransferDialogProps) {
  const { toast } = useToast();
  const [entrepots, setEntrepots] = useState<Entrepot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    sourceId: sourceEntrepotId || '',
    destId: '',
    quantity: '',
    observations: '',
  });

  useEffect(() => {
    if (open) {
      fetchEntrepots();
      setForm((prev) => ({
        ...prev,
        sourceId: sourceEntrepotId || '',
        destId: '',
        quantity: '',
        observations: '',
      }));
    }
  }, [open, sourceEntrepotId]);

  const fetchEntrepots = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('entrepots')
        .select('*')
        .eq('is_active', true)
        .order('nom');

      if (error) throw error;
      setEntrepots((data as Entrepot[]) || []);
    } catch (error) {
      console.error('Error fetching entrepots:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransfer = async () => {
    const qty = parseFloat(form.quantity);
    
    if (!form.sourceId || !form.destId) {
      toast({ title: 'Erreur', description: 'Sélectionnez les entrepôts source et destination.', variant: 'destructive' });
      return;
    }
    
    if (form.sourceId === form.destId) {
      toast({ title: 'Erreur', description: 'Les entrepôts doivent être différents.', variant: 'destructive' });
      return;
    }
    
    if (!qty || qty <= 0) {
      toast({ title: 'Erreur', description: 'Quantité invalide.', variant: 'destructive' });
      return;
    }
    
    if (qty > availableQuantity) {
      toast({ title: 'Erreur', description: `Stock insuffisant (disponible: ${availableQuantity} ${unit}).`, variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('transferer_stock_entrepots', {
        _article_id: articleId,
        _entrepot_source_id: form.sourceId,
        _entrepot_dest_id: form.destId,
        _quantite: qty,
        _observations: form.observations.trim() || null,
      });

      if (error) throw error;

      const destEntrepot = entrepots.find((e) => e.id === form.destId);
      toast({
        title: 'Transfert effectué',
        description: `${qty} ${unit} transféré(s) vers ${destEntrepot?.nom || 'destination'}.`,
      });
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const sourceEntrepot = entrepots.find((e) => e.id === form.sourceId);
  const destEntrepot = entrepots.find((e) => e.id === form.destId);
  const availableDestinations = entrepots.filter((e) => e.id !== form.sourceId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Transfert inter-entrepôts
          </DialogTitle>
          <DialogDescription>
            {articleName ? (
              <span>Transférer l'article <strong>{articleName}</strong> vers un autre entrepôt</span>
            ) : (
              'Transférer du stock entre entrepôts'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Visual transfer flow */}
          <div className="flex items-center justify-center gap-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex-1 text-center">
              <Warehouse className="mx-auto mb-1 h-6 w-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Source</p>
              <p className="font-medium text-sm truncate">
                {sourceEntrepot?.nom || 'Non sélectionné'}
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 text-center">
              <Warehouse className="mx-auto mb-1 h-6 w-6 text-primary" />
              <p className="text-xs text-muted-foreground">Destination</p>
              <p className="font-medium text-sm truncate">
                {destEntrepot?.nom || 'Non sélectionné'}
              </p>
            </div>
          </div>

          {/* Source selection */}
          <div className="space-y-2">
            <Label>Entrepôt source</Label>
            <Select
              value={form.sourceId}
              onValueChange={(val) => setForm({ ...form, sourceId: val })}
              disabled={!!sourceEntrepotId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {entrepots.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    <div className="flex items-center gap-2">
                      {e.nom}
                      <Badge variant="outline" className="text-[10px]">
                        {ENTREPOT_TYPE_LABELS[e.type]}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Destination selection */}
          <div className="space-y-2">
            <Label>Entrepôt destination</Label>
            <Select
              value={form.destId}
              onValueChange={(val) => setForm({ ...form, destId: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {availableDestinations.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    <div className="flex items-center gap-2">
                      {e.nom}
                      <Badge variant="outline" className="text-[10px]">
                        {ENTREPOT_TYPE_LABELS[e.type]}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label>Quantité à transférer</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="any"
                min="0"
                max={availableQuantity}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="0"
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground">{unit}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Disponible: <span className="font-medium">{availableQuantity} {unit}</span>
            </p>
          </div>

          {/* Observations */}
          <div className="space-y-2">
            <Label>Observations</Label>
            <Textarea
              value={form.observations}
              onChange={(e) => setForm({ ...form, observations: e.target.value })}
              placeholder="Motif du transfert..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleTransfer} disabled={isSaving || isLoading}>
            {isSaving ? 'Transfert...' : 'Transférer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
