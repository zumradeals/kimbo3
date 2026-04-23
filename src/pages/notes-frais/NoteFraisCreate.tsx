import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, Receipt, Calendar, Coins, Paperclip, X, FileText } from 'lucide-react';
import { ProjetSelector } from '@/components/ui/ProjetSelector';
import { useAALBypass } from '@/hooks/useAALBypass';

interface LigneInput {
  id: string;
  date_depense: string;
  motif: string;
  montant: number;
  observations: string;
}

export default function NoteFraisCreate() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { aalBypassEnabled } = useAALBypass();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projet_id: '',
  });

  const [lignes, setLignes] = useState<LigneInput[]>([
    {
      id: crypto.randomUUID(),
      date_depense: new Date().toISOString().split('T')[0],
      motif: '',
      montant: 0,
      observations: '',
    },
  ]);

  const addLigne = () => {
    setLignes([
      ...lignes,
      {
        id: crypto.randomUUID(),
        date_depense: new Date().toISOString().split('T')[0],
        motif: '',
        montant: 0,
        observations: '',
      },
    ]);
  };

  const updateLigne = (id: string, field: keyof LigneInput, value: any) => {
    setLignes(lignes.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const removeLigne = (id: string) => {
    if (lignes.length === 1) return;
    setLignes(lignes.filter((l) => l.id !== id));
  };

  const totalAmount = lignes.reduce((sum, l) => sum + (l.montant || 0), 0);

  const handleAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Fichier trop volumineux', description: 'Limite : 10 Mo.', variant: 'destructive' });
      return;
    }
    setAttachmentFile(file);
  };

  const uploadAttachment = async (noteId: string): Promise<{ url: string; name: string } | null> => {
    if (!attachmentFile) return null;
    const ext = attachmentFile.name.split('.').pop();
    const path = `${noteId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('notes-frais-attachments')
      .upload(path, attachmentFile, { upsert: false });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from('notes-frais-attachments').getPublicUrl(path);
    return { url: pub.publicUrl, name: attachmentFile.name };
  };

  const handleSubmit = async (asBrouillon: boolean) => {
    if (!formData.title.trim()) {
      toast({ title: 'Erreur', description: 'Le titre est requis.', variant: 'destructive' });
      return;
    }

    const validLignes = lignes.filter((l) => l.motif.trim() && l.montant > 0);
    if (validLignes.length === 0) {
      toast({ title: 'Erreur', description: 'Ajoutez au moins une ligne de dépense valide.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: refData } = await supabase.rpc('generate_ndf_reference');
      const reference = refData || `NDF-${Date.now()}`;

      const { data: noteData, error: noteError } = await supabase
        .from('notes_frais')
        .insert({
          reference,
          user_id: user?.id,
          department_id: profile?.department_id,
          projet_id: formData.projet_id || null,
          title: formData.title,
          description: formData.description || null,
          total_amount: totalAmount,
          status: 'brouillon',
        })
        .select()
        .single();

      if (noteError) throw noteError;

      const lignesData = validLignes.map((l) => ({
        note_frais_id: noteData.id,
        date_depense: l.date_depense,
        motif: l.motif,
        projet_id: formData.projet_id || null, // Use global project
        montant: l.montant,
        observations: l.observations || null,
      }));

      const { error: lignesError } = await supabase
        .from('note_frais_lignes')
        .insert(lignesData);

      if (lignesError) throw lignesError;

      // Upload attachment if any
      const uploaded = await uploadAttachment(noteData.id);
      if (uploaded) {
        await supabase
          .from('notes_frais')
          .update({ attachment_url: uploaded.url, attachment_name: uploaded.name })
          .eq('id', noteData.id);
      }

      if (!asBrouillon) {
        const newStatus = aalBypassEnabled ? 'soumise' : 'soumis_aal';
        const { error: updateError } = await supabase
          .from('notes_frais')
          .update({
            status: newStatus,
            submitted_at: new Date().toISOString(),
          })
          .eq('id', noteData.id);

        if (updateError) throw updateError;
      }

      toast({
        title: asBrouillon ? 'Brouillon enregistré' : 'Note soumise',
        description: asBrouillon
          ? 'Votre note de frais a été enregistrée comme brouillon.'
          : aalBypassEnabled ? 'Votre note de frais a été soumise au DAF pour validation.' : 'Votre note de frais a été soumise au AAL pour validation.',
      });

      navigate(`/notes-frais/${noteData.id}`);
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/notes-frais">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Nouvelle note de frais
            </h1>
            <p className="text-muted-foreground">
              Créez une demande de remboursement
            </p>
          </div>
        </div>

        {/* Informations générales */}
        <Card>
          <CardHeader>
            <CardTitle>Informations générales</CardTitle>
            <CardDescription>Décrivez le contexte de vos dépenses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Titre de la note *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Frais de déplacement mission Douala"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="projet">Projet / Chantier rattaché</Label>
                <ProjetSelector
                  value={formData.projet_id}
                  onChange={(id) => setFormData({ ...formData, projet_id: id })}
                  placeholder="Sélectionner un projet (optionnel)..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description et justification</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Décrivez le contexte général de ces dépenses, l'objectif de la mission, les justifications nécessaires..."
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Fournissez le contexte et les justifications pour faciliter la validation
              </p>
            </div>

            {/* Pièce jointe */}
            <div className="space-y-2">
              <Label htmlFor="attachment" className="flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />
                Pièce jointe (justificatif global)
              </Label>
              {!attachmentFile ? (
                <div className="rounded-md border-2 border-dashed border-muted-foreground/25 p-4 hover:border-primary/50 transition-colors">
                  <input
                    id="attachment"
                    type="file"
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleAttachmentSelect}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    PDF, image, Word ou Excel (max 10 Mo)
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{attachmentFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(attachmentFile.size / 1024).toFixed(0)} Ko
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setAttachmentFile(null)} className="h-8 w-8 shrink-0">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lignes de dépenses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Lignes de dépenses</CardTitle>
              <CardDescription>Détaillez chaque dépense à rembourser</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addLigne}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter une ligne
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {lignes.map((ligne, index) => (
              <div 
                key={ligne.id} 
                className="relative rounded-lg border bg-muted/30 p-4 space-y-4"
              >
                {/* Header ligne */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Dépense #{index + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLigne(ligne.id)}
                    disabled={lignes.length === 1}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Supprimer
                  </Button>
                </div>

                {/* Ligne fields - responsive grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Date *
                    </Label>
                    <Input
                      type="date"
                      value={ligne.date_depense}
                      onChange={(e) => updateLigne(ligne.id, 'date_depense', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2 lg:col-span-2">
                    <Label>Motif de la dépense *</Label>
                    <Textarea
                      value={ligne.motif}
                      onChange={(e) => updateLigne(ligne.id, 'motif', e.target.value)}
                      placeholder="Décrivez l'objet de cette dépense (transport, repas, fournitures, etc.)"
                      rows={2}
                      className="resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Coins className="h-3.5 w-3.5" />
                      Montant (XOF) *
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={ligne.montant || ''}
                      onChange={(e) => updateLigne(ligne.id, 'montant', Number(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Observations - full width */}
                <div className="space-y-2">
                  <Label>Observations / Justificatifs</Label>
                  <Textarea
                    value={ligne.observations}
                    onChange={(e) => updateLigne(ligne.id, 'observations', e.target.value)}
                    placeholder="Notes complémentaires, références de factures, précisions utiles pour la validation..."
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </div>
            ))}

            {/* Total */}
            <div className="flex justify-end pt-4 border-t">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total général</p>
                <p className="text-3xl font-bold text-primary">
                  {new Intl.NumberFormat('fr-FR').format(Math.ceil(totalAmount))} XOF
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 pb-6">
          <Link to="/notes-frais" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full">Annuler</Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Enregistrer brouillon
          </Button>
          <Button 
            onClick={() => handleSubmit(false)} 
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            <Receipt className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Envoi...' : (aalBypassEnabled ? 'Soumettre au DAF' : 'Soumettre au AAL')}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
