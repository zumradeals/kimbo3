import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Projet } from '@/types/kpm';
import { AccessDenied } from '@/components/ui/AccessDenied';
import {
  ArrowLeft,
  Edit,
  Trash2,
  MapPin,
  Calendar,
  DollarSign,
  Building2,
  User,
  FileText,
  Package,
  Wallet,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_LABELS: Record<string, string> = {
  actif: 'Actif',
  termine: 'Terminé',
  suspendu: 'Suspendu',
};

const STATUS_COLORS: Record<string, string> = {
  actif: 'bg-success/10 text-success border-success/20',
  termine: 'bg-muted text-muted-foreground',
  suspendu: 'bg-warning/10 text-warning border-warning/20',
};

export default function ProjetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { roles, isAdmin } = useAuth();
  const { toast } = useToast();

  const [projet, setProjet] = useState<Projet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    description: '',
    client: '',
    location: '',
    status: 'actif',
    budget: '',
    start_date: '',
    end_date: '',
  });

  const [linkedItems, setLinkedItems] = useState({
    besoins: 0,
    da: 0,
    bl: 0,
    mouvements: 0,
  });

  const isLogistics = roles.some((r) => ['responsable_logistique', 'agent_logistique'].includes(r));
  const canEdit = isLogistics || isAdmin;
  const canDelete = isAdmin;

  useEffect(() => {
    if (id) {
      fetchProjet();
      fetchLinkedItems();
    }
  }, [id]);

  const fetchProjet = async () => {
    try {
      const { data, error } = await supabase
        .from('projets')
        .select('*, created_by_profile:profiles!projets_created_by_fkey(id, first_name, last_name)')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        toast({ title: 'Erreur', description: 'Projet introuvable.', variant: 'destructive' });
        navigate('/projets');
        return;
      }

      setProjet(data as Projet);
      setEditForm({
        name: data.name || '',
        code: data.code || '',
        description: data.description || '',
        client: data.client || '',
        location: data.location || '',
        status: data.status || 'actif',
        budget: data.budget?.toString() || '',
        start_date: data.start_date || '',
        end_date: data.end_date || '',
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLinkedItems = async () => {
    try {
      const [besoins, da, bl, mouvements] = await Promise.all([
        supabase.from('besoins').select('id', { count: 'exact', head: true }).eq('projet_id', id),
        supabase.from('demandes_achat').select('id', { count: 'exact', head: true }).eq('projet_id', id),
        supabase.from('bons_livraison').select('id', { count: 'exact', head: true }).eq('projet_id', id),
        supabase.from('stock_movements').select('id', { count: 'exact', head: true }).eq('projet_id', id),
      ]);

      setLinkedItems({
        besoins: besoins.count || 0,
        da: da.count || 0,
        bl: bl.count || 0,
        mouvements: mouvements.count || 0,
      });
    } catch (error) {
      console.error('Error fetching linked items:', error);
    }
  };

  const handleSave = async () => {
    if (!projet) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('projets')
        .update({
          name: editForm.name,
          code: editForm.code,
          description: editForm.description || null,
          client: editForm.client || null,
          location: editForm.location || null,
          status: editForm.status,
          budget: editForm.budget ? parseFloat(editForm.budget) : null,
          start_date: editForm.start_date || null,
          end_date: editForm.end_date || null,
        })
        .eq('id', projet.id);

      if (error) throw error;

      toast({ title: 'Projet modifié', description: 'Les modifications ont été enregistrées.' });
      setShowEditDialog(false);
      fetchProjet();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!projet) return;

    try {
      const { error } = await supabase.from('projets').delete().eq('id', projet.id);
      if (error) throw error;

      toast({ title: 'Projet supprimé', description: 'Le projet a été supprimé.' });
      navigate('/projets');
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
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

  if (!projet) return null;

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/projets">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-2xl font-bold text-foreground">{projet.name}</h1>
                <Badge variant="outline">{projet.code}</Badge>
                <Badge className={STATUS_COLORS[projet.status] || 'bg-muted'}>
                  {STATUS_LABELS[projet.status] || projet.status}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Créé le {format(new Date(projet.created_at), 'dd MMMM yyyy', { locale: fr })}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Modifier
              </Button>
            )}
            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </Button>
            )}
          </div>
        </div>

        {/* Statistics */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="rounded-full bg-primary/10 p-2">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{linkedItems.besoins}</p>
                <p className="text-xs text-muted-foreground">Besoins</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="rounded-full bg-warning/10 p-2">
                <Wallet className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{linkedItems.da}</p>
                <p className="text-xs text-muted-foreground">DA</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="rounded-full bg-success/10 p-2">
                <Package className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{linkedItems.bl}</p>
                <p className="text-xs text-muted-foreground">BL</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="rounded-full bg-muted p-2">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{linkedItems.mouvements}</p>
                <p className="text-xs text-muted-foreground">Mouvements</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle>Informations du projet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {projet.client && (
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Client</p>
                    <p className="font-medium">{projet.client}</p>
                  </div>
                </div>
              )}
              {projet.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Localisation</p>
                    <p className="font-medium">{projet.location}</p>
                  </div>
                </div>
              )}
              {projet.budget && (
                <div className="flex items-start gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Budget</p>
                    <p className="font-medium">{projet.budget.toLocaleString()} XOF</p>
                  </div>
                </div>
              )}
              {projet.start_date && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Période</p>
                    <p className="font-medium">
                      {format(new Date(projet.start_date), 'dd MMM yyyy', { locale: fr })}
                      {projet.end_date && ` - ${format(new Date(projet.end_date), 'dd MMM yyyy', { locale: fr })}`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {projet.description && (
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="whitespace-pre-wrap">{projet.description}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le projet</DialogTitle>
            <DialogDescription>Modifiez les informations du projet.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nom *</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Code *</Label>
                <Input
                  value={editForm.code}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Statut</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm({ ...editForm, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="actif">Actif</SelectItem>
                    <SelectItem value="termine">Terminé</SelectItem>
                    <SelectItem value="suspendu">Suspendu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Client</Label>
                <Input
                  value={editForm.client}
                  onChange={(e) => setEditForm({ ...editForm, client: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Localisation</Label>
                <Input
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Budget (XOF)</Label>
              <Input
                type="number"
                value={editForm.budget}
                onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Date début</Label>
                <Input
                  type="date"
                  value={editForm.start_date}
                  onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Date fin</Label>
                <Input
                  type="date"
                  value={editForm.end_date}
                  onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={!editForm.name || !editForm.code || isSaving}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
