import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Caisse {
  id: string;
  code: string;
  name: string;
  solde_actuel: number;
  devise: string;
  is_active: boolean;
}

interface CorrectionCaisseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'da' | 'note_frais';
  entityId: string;
  entityReference: string;
  currentCaisseId: string;
  currentCaisseName: string;
  amount: number;
  devise: string;
  onSuccess: () => void;
}

export function CorrectionCaisseDialog({
  open,
  onOpenChange,
  type,
  entityId,
  entityReference,
  currentCaisseId,
  currentCaisseName,
  amount,
  devise,
  onSuccess,
}: CorrectionCaisseDialogProps) {
  const [caisses, setCaisses] = useState<Caisse[]>([]);
  const [nouvelleCaisseId, setNouvelleCaisseId] = useState('');
  const [raison, setRaison] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCaisses, setIsLoadingCaisses] = useState(true);

  useEffect(() => {
    if (open) {
      fetchCaisses();
    }
  }, [open, currentCaisseId]);

  const fetchCaisses = async () => {
    setIsLoadingCaisses(true);
    try {
      const { data, error } = await supabase
        .from('caisses')
        .select('id, code, name, solde_actuel, devise, is_active')
        .eq('is_active', true)
        .neq('id', currentCaisseId)
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

  // ARRONDI COMPTABLE DAF: arrondi au supérieur pour les montants
  const formatMoney = (amt: number, dev: string = 'XOF') => {
    const rounded = Math.ceil(amt);
    return new Intl.NumberFormat('fr-FR').format(rounded) + ' ' + dev;
  };

  const selectedCaisse = caisses.find(c => c.id === nouvelleCaisseId);
  const insufficientFunds = selectedCaisse && amount > selectedCaisse.solde_actuel;

  const handleSubmit = async () => {
    if (!nouvelleCaisseId) {
      toast.error('Veuillez sélectionner la nouvelle caisse');
      return;
    }
    if (!raison.trim() || raison.trim().length < 10) {
      toast.error('La raison doit contenir au moins 10 caractères');
      return;
    }
    if (insufficientFunds) {
      toast.error('Solde insuffisant sur la nouvelle caisse');
      return;
    }

    setIsLoading(true);
    try {
      let error;
      
      if (type === 'da') {
        const result = await supabase.rpc('corriger_caisse_paiement', {
          p_da_id: entityId,
          p_nouvelle_caisse_id: nouvelleCaisseId,
          p_raison: raison.trim(),
        });
        error = result.error;
      } else {
        const result = await supabase.rpc('corriger_caisse_note_frais', {
          p_note_frais_id: entityId,
          p_nouvelle_caisse_id: nouvelleCaisseId,
          p_raison: raison.trim(),
        });
        error = result.error;
      }

      if (error) throw error;

      toast.success('Correction effectuée', {
        description: `Le paiement ${entityReference} a été réaffecté à ${selectedCaisse?.name}`,
      });
      onOpenChange(false);
      resetForm();
      onSuccess();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Erreur lors de la correction', {
        description: error.message || 'Veuillez réessayer',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setNouvelleCaisseId('');
    setRaison('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-orange-600" />
            Corriger erreur de caisse
          </DialogTitle>
          <DialogDescription>
            Réaffecter le paiement <strong>{entityReference}</strong> à une autre caisse
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Opération traçable</AlertTitle>
            <AlertDescription>
              Cette correction créera des contre-écritures automatiques et sera enregistrée dans le journal d'audit.
            </AlertDescription>
          </Alert>

          {/* Résumé */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">Caisse actuelle (erreur)</p>
              <p className="font-medium">{currentCaisseName}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Montant: <span className="font-mono">{formatMoney(amount, devise)}</span>
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">Référence</p>
              <p className="font-mono font-medium">{entityReference}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Type: {type === 'da' ? 'Demande d\'Achat' : 'Note de Frais'}
              </p>
            </div>
          </div>

          {/* Nouvelle caisse */}
          <div className="space-y-2">
            <Label>Nouvelle caisse (correcte) *</Label>
            {isLoadingCaisses ? (
              <div className="flex items-center gap-2 text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Chargement...</span>
              </div>
            ) : caisses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Aucune autre caisse active disponible</p>
            ) : (
              <Select value={nouvelleCaisseId} onValueChange={setNouvelleCaisseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner la bonne caisse..." />
                </SelectTrigger>
                <SelectContent>
                  {caisses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex justify-between items-center gap-4">
                        <span>{c.name} ({c.code})</span>
                        <span className={`font-mono text-sm ${c.solde_actuel >= amount ? 'text-green-600' : 'text-red-600'}`}>
                          {formatMoney(c.solde_actuel, c.devise)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {insufficientFunds && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Solde insuffisant. Cette caisse doit avoir au moins {formatMoney(amount, devise)}.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Aperçu */}
          {selectedCaisse && !insufficientFunds && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-green-800">Résultat après correction:</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{currentCaisseName}</p>
                  <p className="font-mono">Crédit de +{formatMoney(amount, devise)}</p>
                  <p className="text-xs text-muted-foreground">(Annulation)</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{selectedCaisse.name}</p>
                  <p className="font-mono">Débit de -{formatMoney(amount, devise)}</p>
                  <p className="text-xs text-muted-foreground">(Nouvelle imputation)</p>
                </div>
              </div>
            </div>
          )}

          {/* Raison */}
          <div className="space-y-2">
            <Label>Raison de la correction * (min. 10 caractères)</Label>
            <Textarea
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
              placeholder="Ex: Erreur de sélection lors du paiement, la caisse projet devait être utilisée..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {raison.length}/10 caractères minimum
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Annuler
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !nouvelleCaisseId || raison.trim().length < 10 || insufficientFunds}
            variant="default"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                En cours...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Confirmer la correction
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
