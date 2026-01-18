import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowRightLeft, Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Caisse {
  id: string;
  code: string;
  name: string;
  solde_actuel: number;
  devise: string;
  is_active: boolean;
}

interface TransfertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceCaisse: Caisse;
  onSuccess: () => void;
}

export function TransfertDialog({ open, onOpenChange, sourceCaisse, onSuccess }: TransfertDialogProps) {
  const [caisses, setCaisses] = useState<Caisse[]>([]);
  const [destinationId, setDestinationId] = useState('');
  const [montant, setMontant] = useState<number>(0);
  const [motif, setMotif] = useState('');
  const [observations, setObservations] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCaisses, setIsLoadingCaisses] = useState(true);

  useEffect(() => {
    if (open) {
      fetchCaisses();
    }
  }, [open]);

  const fetchCaisses = async () => {
    setIsLoadingCaisses(true);
    try {
      const { data, error } = await supabase
        .from('caisses')
        .select('id, code, name, solde_actuel, devise, is_active')
        .eq('is_active', true)
        .neq('id', sourceCaisse.id)
        .order('name');

      if (error) throw error;
      setCaisses(data || []);
    } catch (error) {
      console.error('Error fetching caisses:', error);
      toast.error('Erreur lors du chargement des caisses');
    } finally {
      setIsLoadingCaisses(false);
    }
  };

  const formatMoney = (amount: number, devise: string = 'XOF') => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' ' + devise;
  };

  const selectedDestination = caisses.find(c => c.id === destinationId);
  const insufficientFunds = montant > sourceCaisse.solde_actuel;

  const handleSubmit = async () => {
    if (!destinationId) {
      toast.error('Veuillez sélectionner une caisse de destination');
      return;
    }
    if (montant <= 0) {
      toast.error('Le montant doit être supérieur à 0');
      return;
    }
    if (insufficientFunds) {
      toast.error('Solde insuffisant sur la caisse source');
      return;
    }
    if (!motif.trim() || motif.trim().length < 5) {
      toast.error('Le motif est obligatoire (minimum 5 caractères)');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('transferer_entre_caisses', {
        p_caisse_source_id: sourceCaisse.id,
        p_caisse_dest_id: destinationId,
        p_montant: montant,
        p_motif: motif.trim(),
        p_observations: observations.trim() || null,
      });

      if (error) throw error;

      toast.success('Transfert effectué', {
        description: `${formatMoney(montant, sourceCaisse.devise)} transférés vers ${selectedDestination?.name}`,
      });
      onOpenChange(false);
      resetForm();
      onSuccess();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Erreur lors du transfert', {
        description: error.message || 'Veuillez réessayer',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setDestinationId('');
    setMontant(0);
    setMotif('');
    setObservations('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-blue-600" />
            Transférer des fonds
          </DialogTitle>
          <DialogDescription>
            Transférer des fonds depuis <strong>{sourceCaisse.name}</strong>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Source */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">Caisse source</p>
            <p className="font-medium">{sourceCaisse.name} ({sourceCaisse.code})</p>
            <p className="text-lg font-bold font-mono text-green-600">
              {formatMoney(sourceCaisse.solde_actuel, sourceCaisse.devise)}
            </p>
          </div>

          {/* Destination */}
          <div className="space-y-2">
            <Label>Caisse de destination *</Label>
            {isLoadingCaisses ? (
              <div className="flex items-center gap-2 text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Chargement...</span>
              </div>
            ) : caisses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Aucune autre caisse active disponible</p>
            ) : (
              <Select value={destinationId} onValueChange={setDestinationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une caisse..." />
                </SelectTrigger>
                <SelectContent>
                  {caisses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex justify-between items-center gap-4">
                        <span>{c.name} ({c.code})</span>
                        <span className="text-muted-foreground font-mono text-sm">
                          {formatMoney(c.solde_actuel, c.devise)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Montant */}
          <div className="space-y-2">
            <Label>Montant à transférer *</Label>
            <Input
              type="number"
              min={1}
              max={sourceCaisse.solde_actuel}
              value={montant || ''}
              onChange={(e) => setMontant(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="font-mono text-lg"
            />
            {insufficientFunds && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Solde insuffisant. Maximum disponible: {formatMoney(sourceCaisse.solde_actuel, sourceCaisse.devise)}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Aperçu */}
          {montant > 0 && selectedDestination && !insufficientFunds && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-blue-800">Après transfert:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">{sourceCaisse.name}</p>
                  <p className="font-mono font-medium text-red-600">
                    {formatMoney(sourceCaisse.solde_actuel - montant, sourceCaisse.devise)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{selectedDestination.name}</p>
                  <p className="font-mono font-medium text-green-600">
                    {formatMoney(selectedDestination.solde_actuel + montant, selectedDestination.devise)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Motif */}
          <div className="space-y-2">
            <Label>Motif *</Label>
            <Textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex: Équilibrage de caisses, Besoin opérationnel..."
              rows={2}
            />
          </div>

          {/* Observations */}
          <div className="space-y-2">
            <Label>Observations (optionnel)</Label>
            <Textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Informations complémentaires..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Annuler
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !destinationId || montant <= 0 || insufficientFunds || !motif.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                En cours...
              </>
            ) : (
              <>
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Transférer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
