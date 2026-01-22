import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { ProjetSelector } from '@/components/ui/ProjetSelector';
import { NoteFraisLigne } from '@/types/kpm';

interface LigneInput {
  id: string;
  date_depense: string;
  motif: string;
  projet_id: string;
  montant: number;
  observations: string;
  isNew?: boolean;
}

export default function NoteFraisEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [note, setNote] = useState<any>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projet_id: '',
  });

  const [lignes, setLignes] = useState<LigneInput[]>([]);
  const [deletedLigneIds, setDeletedLigneIds] = useState<string[]>([]);

  useEffect(() => {
    if (id) fetchNote();
  }, [id]);

  const fetchNote = async () => {
    try {
      const { data, error } = await supabase
        .from('notes_frais')
        .select('*, lignes:note_frais_lignes(*)')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        toast({ title: 'Erreur', description: 'Note de frais introuvable.', variant: 'destructive' });
        navigate('/notes-frais');
        return;
      }

      // Check if user can edit
      const canEdit = data.user_id === user?.id || isAdmin;
      const isEditable = data.status === 'brouillon' || data.status === 'rejetee';

      if (!canEdit || !isEditable) {
        toast({ title: 'Accès refusé', description: 'Vous ne pouvez pas modifier cette note.', variant: 'destructive' });
        navigate(`/notes-frais/${id}`);
        return;
      }

      setNote(data);
      setFormData({
        title: data.title || '',
        description: data.description || '',
        projet_id: data.projet_id || '',
      });

      setLignes(
        (data.lignes || []).map((l: NoteFraisLigne) => ({
          id: l.id,
          date_depense: l.date_depense,
          motif: l.motif,
          projet_id: l.projet_id || '',
          montant: l.montant,
          observations: l.observations || '',
          isNew: false,
        }))
      );
    } catch (error: any) {
      console.error('Error:', error);
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

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
        isNew: true,
      },
    ]);
  };

  const updateLigne = (id: string, field: keyof LigneInput, value: any) => {
    setLignes(lignes.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const removeLigne = (id: string) => {
    const ligne = lignes.find((l) => l.id === id);
    if (ligne && !ligne.isNew) {
      setDeletedLigneIds([...deletedLigneIds, id]);
    }
    setLignes(lignes.filter((l) => l.id !== id));
  };

  const totalAmount = lignes.reduce((sum, l) => sum + (l.montant || 0), 0);

  const handleSubmit = async () => {
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
      // Update note
      const { error: noteError } = await supabase
        .from('notes_frais')
        .update({
          title: formData.title,
          description: formData.description || null,
          projet_id: formData.projet_id || null,
          total_amount: totalAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (noteError) throw noteError;

      // Delete removed lignes
      if (deletedLigneIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('note_frais_lignes')
          .delete()
          .in('id', deletedLigneIds);

        if (deleteError) throw deleteError;
      }

      // Update existing lignes & insert new ones
      for (const ligne of validLignes) {
        const ligneData = {
          note_frais_id: id,
          date_depense: ligne.date_depense,
          motif: ligne.motif,
          projet_id: ligne.projet_id || null,
          montant: ligne.montant,
          observations: ligne.observations || null,
        };

        if (ligne.isNew) {
          const { error } = await supabase.from('note_frais_lignes').insert(ligneData);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('note_frais_lignes')
            .update(ligneData)
            .eq('id', ligne.id);
          if (error) throw error;
        }
      }

      toast({ title: 'Modifications enregistrées', description: 'La note de frais a été mise à jour.' });
      navigate(`/notes-frais/${id}`);
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to={`/notes-frais/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Modifier la note de frais
            </h1>
            <p className="text-muted-foreground font-mono">{note?.reference}</p>
          </div>
        </div>

        {/* Form - Landscape layout */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
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
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="projet">Projet rattaché</Label>
                <ProjetSelector
                  value={formData.projet_id}
                  onChange={(pid) => setFormData({ ...formData, projet_id: pid })}
                  placeholder="Sélectionner un projet..."
                />
              </div>

              <div className="pt-4 border-t">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold text-primary">
                    {new Intl.NumberFormat('fr-FR').format(Math.ceil(totalAmount))} XOF
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lignes - Takes 2/3 of space */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Lignes de dépenses</CardTitle>
                <CardDescription>{lignes.length} ligne(s)</CardDescription>
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
                            onChange={(pid) => updateLigne(ligne.id, 'projet_id', pid)}
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
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link to={`/notes-frais/${id}`}>
            <Button variant="outline">Annuler</Button>
          </Link>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
