import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProjetSelector } from '@/components/ui/ProjetSelector';

interface LigneInput {
  id: string;
  date_depense: string;
  motif: string;
  projet_id: string;
  montant: number;
  observations: string;
}

export default function NoteFraisCreate() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);

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
      projet_id: '',
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
        projet_id: formData.projet_id || '',
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
      // Generate reference
      const { data: refData } = await supabase.rpc('generate_ndf_reference');
      const reference = refData || `NDF-${Date.now()}`;

      // Create note de frais
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
          status: asBrouillon ? 'brouillon' : 'soumise',
          submitted_at: asBrouillon ? null : new Date().toISOString(),
        })
        .select()
        .single();

      if (noteError) throw noteError;

      // Create lignes
      const lignesData = validLignes.map((l) => ({
        note_frais_id: noteData.id,
        date_depense: l.date_depense,
        motif: l.motif,
        projet_id: l.projet_id || null,
        montant: l.montant,
        observations: l.observations || null,
      }));

      const { error: lignesError } = await supabase
        .from('note_frais_lignes')
        .insert(lignesData);

      if (lignesError) throw lignesError;

      toast({
        title: asBrouillon ? 'Brouillon enregistré' : 'Note soumise',
        description: asBrouillon
          ? 'Votre note de frais a été enregistrée comme brouillon.'
          : 'Votre note de frais a été soumise pour validation.',
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
      <div className="mx-auto max-w-4xl space-y-6">
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

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Contexte et justification des dépenses..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="projet">Projet rattaché (optionnel)</Label>
              <ProjetSelector
                value={formData.projet_id}
                onChange={(id) => setFormData({ ...formData, projet_id: id })}
                placeholder="Sélectionner un projet..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Lignes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Lignes de dépenses</CardTitle>
              <CardDescription>Ajoutez les dépenses à rembourser</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addLigne}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Date</TableHead>
                    <TableHead>Motif *</TableHead>
                    <TableHead className="w-40">Projet</TableHead>
                    <TableHead className="w-32 text-right">Montant *</TableHead>
                    <TableHead className="w-40">Observations</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lignes.map((ligne) => (
                    <TableRow key={ligne.id}>
                      <TableCell>
                        <Input
                          type="date"
                          value={ligne.date_depense}
                          onChange={(e) => updateLigne(ligne.id, 'date_depense', e.target.value)}
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={ligne.motif}
                          onChange={(e) => updateLigne(ligne.id, 'motif', e.target.value)}
                          placeholder="Objet de la dépense"
                        />
                      </TableCell>
                      <TableCell>
                        <ProjetSelector
                          value={ligne.projet_id}
                          onChange={(id) => updateLigne(ligne.id, 'projet_id', id)}
                          placeholder="-"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={ligne.montant || ''}
                          onChange={(e) => updateLigne(ligne.id, 'montant', Number(e.target.value))}
                          className="text-right"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={ligne.observations}
                          onChange={(e) => updateLigne(ligne.id, 'observations', e.target.value)}
                          placeholder="Note"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLigne(ligne.id)}
                          disabled={lignes.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex justify-end border-t pt-4">
              <div className="text-right">
              <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('fr-FR').format(totalAmount)} XOF
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link to="/notes-frais">
            <Button variant="outline">Annuler</Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting}
          >
            Enregistrer brouillon
          </Button>
          <Button onClick={() => handleSubmit(false)} disabled={isSubmitting}>
            <Receipt className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Envoi...' : 'Soumettre pour validation'}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
