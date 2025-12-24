import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { BesoinLignesTable } from './BesoinLignesTable';
import { BesoinAttachmentsUpload } from './BesoinAttachmentsUpload';
import {
  BesoinLigne,
  BESOIN_URGENCY_LABELS,
  BESOIN_TYPE_ENUM_LABELS,
  BesoinLigneCategory,
  BesoinUrgency,
} from '@/types/kpm';
import { Edit, Save, X, AlertCircle, Lock } from 'lucide-react';

interface BesoinEditLogistiqueProps {
  besoinId: string;
  besoin: any;
  onUpdate: () => void;
  isLocked: boolean;
}

export function BesoinEditLogistique({ besoinId, besoin, onUpdate, isLocked }: BesoinEditLogistiqueProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const [editForm, setEditForm] = useState({
    objet_besoin: besoin.objet_besoin || besoin.title || '',
    description: besoin.description || '',
    besoin_type: besoin.besoin_type || 'article',
    urgency: besoin.urgency || 'normale',
    lieu_livraison: besoin.lieu_livraison || '',
    site_projet: besoin.site_projet || '',
    desired_date: besoin.desired_date || '',
  });

  const [lignes, setLignes] = useState<any[]>([]);

  useEffect(() => {
    if (besoin.lignes) {
      setLignes(besoin.lignes.map((l: any) => ({
        id: l.id,
        designation: l.designation,
        category: l.category,
        unit: l.unit,
        quantity: l.quantity,
        urgency: l.urgency,
        justification: l.justification || '',
      })));
    }
  }, [besoin.lignes]);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Update besoin main info
      const { error: besoinError } = await supabase
        .from('besoins')
        .update({
          objet_besoin: editForm.objet_besoin,
          title: editForm.objet_besoin,
          description: editForm.description,
          besoin_type: editForm.besoin_type,
          urgency: editForm.urgency,
          lieu_livraison: editForm.lieu_livraison || null,
          site_projet: editForm.site_projet || null,
          desired_date: editForm.desired_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', besoinId);

      if (besoinError) throw besoinError;

      // Update lignes - delete removed, update existing, insert new
      const existingIds = lignes.filter(l => l.id && !l.id.startsWith('temp-')).map(l => l.id);
      
      // Delete removed lignes
      if (besoin.lignes) {
        const removedIds = besoin.lignes
          .filter((l: any) => !existingIds.includes(l.id))
          .map((l: any) => l.id);
        
        if (removedIds.length > 0) {
          await supabase.from('besoin_lignes').delete().in('id', removedIds);
        }
      }

      // Update or insert lignes
      for (const ligne of lignes) {
        if (ligne.id && !ligne.id.startsWith('temp-')) {
          // Update existing
          await supabase
            .from('besoin_lignes')
            .update({
              designation: ligne.designation,
              category: ligne.category,
              unit: ligne.unit,
              quantity: ligne.quantity,
              urgency: ligne.urgency,
              justification: ligne.justification || null,
            })
            .eq('id', ligne.id);
        } else {
          // Insert new
          await supabase.from('besoin_lignes').insert({
            besoin_id: besoinId,
            designation: ligne.designation,
            category: ligne.category,
            unit: ligne.unit,
            quantity: ligne.quantity,
            urgency: ligne.urgency,
            justification: ligne.justification || null,
          });
        }
      }

      toast({ title: 'Besoin modifié', description: 'Les modifications ont été enregistrées.' });
      setIsEditing(false);
      onUpdate();
    } catch (error: any) {
      console.error('Error saving:', error);
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLocked) {
    return (
      <Card className="border-muted bg-muted/30">
        <CardContent className="flex items-center gap-3 py-4">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-muted-foreground">Besoin verrouillé</p>
            <p className="text-sm text-muted-foreground">
              Ce besoin a été converti en DA ou BL et ne peut plus être modifié.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isEditing) {
    return (
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Edit className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Mode édition Logistique</p>
              <p className="text-sm text-muted-foreground">
                Vous pouvez normaliser ce besoin avant conversion.
              </p>
            </div>
          </div>
          <Button onClick={() => setIsEditing(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Modifier le besoin
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-warning/50 bg-warning/5">
        <CardContent className="flex items-center gap-3 py-4">
          <AlertCircle className="h-5 w-5 text-warning" />
          <div>
            <p className="font-medium text-warning">Mode édition actif</p>
            <p className="text-sm text-muted-foreground">
              Modifiez les informations puis enregistrez. Le besoin sera verrouillé après conversion.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle>Informations du besoin</CardTitle>
          <CardDescription>Normalisez les informations avant conversion</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Objet du besoin *</Label>
              <Input
                value={editForm.objet_besoin}
                onChange={(e) => setEditForm({ ...editForm, objet_besoin: e.target.value })}
                placeholder="Titre clair et concis"
              />
            </div>
            <div>
              <Label>Type de besoin</Label>
              <Select
                value={editForm.besoin_type}
                onValueChange={(v) => setEditForm({ ...editForm, besoin_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BESOIN_TYPE_ENUM_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Urgence</Label>
              <Select
                value={editForm.urgency}
                onValueChange={(v) => setEditForm({ ...editForm, urgency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BESOIN_URGENCY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lieu de livraison</Label>
              <Input
                value={editForm.lieu_livraison}
                onChange={(e) => setEditForm({ ...editForm, lieu_livraison: e.target.value })}
                placeholder="Adresse ou site"
              />
            </div>
            <div>
              <Label>Site / Projet</Label>
              <Input
                value={editForm.site_projet}
                onChange={(e) => setEditForm({ ...editForm, site_projet: e.target.value })}
              />
            </div>
            <div>
              <Label>Date souhaitée</Label>
              <Input
                type="date"
                value={editForm.desired_date}
                onChange={(e) => setEditForm({ ...editForm, desired_date: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lignes */}
      <Card>
        <CardHeader>
          <CardTitle>Lignes de besoin</CardTitle>
          <CardDescription>Ajoutez, modifiez ou supprimez les articles demandés</CardDescription>
        </CardHeader>
        <CardContent>
          <BesoinLignesTable lignes={lignes} onChange={setLignes} readOnly={false} />
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card>
        <CardHeader>
          <CardTitle>Pièces jointes</CardTitle>
        </CardHeader>
        <CardContent>
          <BesoinAttachmentsUpload
            attachments={(besoin.attachments || []).map((a: any) => ({
              id: a.id,
              file_url: a.file_url,
              file_name: a.file_name,
              file_type: a.file_type,
              file_size: a.file_size,
            }))}
            onChange={() => {}}
            readOnly={true}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={() => setIsEditing(false)}>
          <X className="mr-2 h-4 w-4" />
          Annuler
        </Button>
        <Button onClick={() => setShowConfirmDialog(true)} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          Enregistrer les modifications
        </Button>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer les modifications</DialogTitle>
            <DialogDescription>
              Les modifications seront enregistrées et tracées dans l'historique.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Annuler
            </Button>
            <Button onClick={() => { setShowConfirmDialog(false); handleSave(); }} disabled={isSaving}>
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
