import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { PlusCircle, Loader2 } from 'lucide-react';

interface ApprovisionnementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caisse: {
    id: string;
    name: string;
    code: string;
    solde_actuel: number;
    devise: string;
  };
  onSuccess: () => void;
}

export function ApprovisionnementDialog({ open, onOpenChange, caisse, onSuccess }: ApprovisionnementDialogProps) {
  const [montant, setMontant] = useState<number>(0);
  const [motif, setMotif] = useState('');
  const [observations, setObservations] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ARRONDI COMPTABLE DAF: arrondi au supérieur pour les montants
  const formatMoney = (amount: number, devise: string = 'XOF') => {
    const rounded = Math.ceil(amount);
    return new Intl.NumberFormat('fr-FR').format(rounded) + ' ' + devise;
  };

  const handleSubmit = async () => {
    if (montant <= 0) {
      toast.error('Le montant doit être supérieur à 0');
      return;
    }
    if (!motif.trim() || motif.trim().length < 5) {
      toast.error('Le motif est obligatoire (minimum 5 caractères)');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('approvisionner_caisse', {
        p_caisse_id: caisse.id,
        p_montant: montant,
        p_motif: motif.trim(),
        p_observations: observations.trim() || null,
      });

      if (error) throw error;

      toast.success('Approvisionnement effectué', {
        description: `${formatMoney(montant, caisse.devise)} crédités sur ${caisse.name}`,
      });
      onOpenChange(false);
      resetForm();
      onSuccess();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Erreur lors de l\'approvisionnement', {
        description: error.message || 'Veuillez réessayer',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setMontant(0);
    setMotif('');
    setObservations('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-green-600" />
            Approvisionner la caisse
          </DialogTitle>
          <DialogDescription>
            Ajouter des fonds à la caisse <strong>{caisse.name}</strong> ({caisse.code})
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">Solde actuel</p>
            <p className="text-xl font-bold font-mono text-green-600">
              {formatMoney(caisse.solde_actuel, caisse.devise)}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Montant à approvisionner *</Label>
            <Input
              type="number"
              min={1}
              value={montant || ''}
              onChange={(e) => setMontant(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="font-mono text-lg"
            />
            {montant > 0 && (
              <p className="text-sm text-muted-foreground">
                Nouveau solde: <span className="font-mono font-medium text-green-600">
                  {formatMoney(caisse.solde_actuel + montant, caisse.devise)}
                </span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Motif *</Label>
            <Textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex: Approvisionnement mensuel, Dépôt bancaire..."
              rows={2}
            />
          </div>

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
          <Button onClick={handleSubmit} disabled={isLoading || montant <= 0 || !motif.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                En cours...
              </>
            ) : (
              <>
                <PlusCircle className="h-4 w-4 mr-2" />
                Approvisionner
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
