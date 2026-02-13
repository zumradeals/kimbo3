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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Projet, PROJET_STATUS_LABELS } from '@/types/kpm';
import {
  ArrowLeft,
  Edit,
  Trash2,
  MapPin,
  Calendar,
  DollarSign,
  Building2,
  FileText,
  Package,
  Wallet,
  AlertTriangle,
  Send,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_COLORS: Record<string, string> = {
  brouillon: 'bg-muted text-muted-foreground',
  soumis_daf: 'bg-warning/10 text-warning border-warning/20',
  valide_daf: 'bg-primary/10 text-primary border-primary/20',
  actif: 'bg-success/10 text-success border-success/20',
  termine: 'bg-muted text-muted-foreground',
  suspendu: 'bg-warning/10 text-warning border-warning/20',
};

export default function ProjetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, roles, isAdmin } = useAuth();
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
    status: 'brouillon',
    budget: '',
    start_date: '',
    end_date: '',
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [linkedItems, setLinkedItems] = useState({
    besoins: 0,
    da: 0,
    bl: 0,
    mouvements: 0,
  });

  const isAAL = roles.includes('aal');
  const isDaf = roles.includes('daf');
  const isDG = roles.includes('dg');

  // AAL can edit only in brouillon
  const canEdit = (isAAL && projet?.status === 'brouillon') || isAdmin;
  const canDelete = isAdmin;
  const canSubmitToDaf = (isAAL || isAdmin) && projet?.status === 'brouillon';
  const canValidateDaf = (isDaf || isAdmin) && projet?.status === 'soumis_daf';
  const canRejectDaf = (isDaf || isAdmin) && projet?.status === 'soumis_daf';
  // DAF can manage operational status after validation
  const canManageStatus = (isDaf || isAdmin) && projet?.status && ['valide_daf', 'actif', 'termine', 'suspendu'].includes(projet.status);

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
        status: data.status || 'brouillon',
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

  const handleSubmitToDaf = async () => {
    if (!projet || !user) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('projets')
        .update({
          status: 'soumis_daf',
          submitted_daf_at: new Date().toISOString(),
          submitted_daf_by: user.id,
        })
        .eq('id', projet.id);

      if (error) throw error;
      toast({ title: 'Projet soumis', description: 'Le projet a été soumis au DAF pour validation.' });
      fetchProjet();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleValidateDaf = async () => {
    if (!projet || !user) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('projets')
        .update({
          status: 'valide_daf',
          validated_daf_at: new Date().toISOString(),
          validated_daf_by: user.id,
        })
        .eq('id', projet.id);

      if (error) throw error;
      toast({ title: 'Projet validé', description: 'Le projet a été validé par le DAF.' });
      fetchProjet();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectDaf = async () => {
    if (!projet || !user || !rejectionReason.trim()) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('projets')
        .update({
          status: 'brouillon',
          rejected_by: user.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: rejectionReason.trim(),
        })
        .eq('id', projet.id);

      if (error) throw error;
      toast({ title: 'Projet refusé', description: 'Le projet a été renvoyé à l\'AAL avec un motif de refus.' });
      setShowRejectDialog(false);
      setRejectionReason('');
      fetchProjet();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeOperationalStatus = async (newStatus: string) => {
    if (!projet) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('projets')
        .update({ status: newStatus })
        .eq('id', projet.id);

      if (error) throw error;
      toast({ title: 'Statut mis à jour', description: `Le projet est maintenant "${PROJET_STATUS_LABELS[newStatus as keyof typeof PROJET_STATUS_LABELS]}".` });
      fetchProjet();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!projet) return;

    const totalLinked = linkedItems.besoins + linkedItems.da + linkedItems.bl + linkedItems.mouvements;
    if (totalLinked > 0) {
      const details = [];
      if (linkedItems.besoins > 0) details.push(`${linkedItems.besoins} besoin(s)`);
      if (linkedItems.da > 0) details.push(`${linkedItems.da} DA`);
      if (linkedItems.bl > 0) details.push(`${linkedItems.bl} BL`);
      if (linkedItems.mouvements > 0) details.push(`${linkedItems.mouvements} mouvement(s)`);

      toast({
        title: 'Suppression impossible',
        description: `Ce projet est rattaché à : ${details.join(', ')}. Veuillez d'abord détacher ces éléments.`,
        variant: 'destructive',
      });
      setShowDeleteDialog(false);
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase.from('projets').delete().eq('id', projet.id);
      if (error) throw error;

      toast({ title: 'Projet supprimé', description: 'Le projet a été supprimé.' });
      navigate('/projets');
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
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
                  {PROJET_STATUS_LABELS[projet.status] || projet.status}
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
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </Button>
            )}
          </div>
        </div>

        {/* Rejection reason banner */}
        {projet.rejection_reason && projet.status === 'brouillon' && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-start gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Projet refusé par le DAF</p>
                <p className="text-sm text-muted-foreground">{projet.rejection_reason}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action buttons for workflow */}
        {(canSubmitToDaf || canValidateDaf || canManageStatus) && (
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 py-4">
              {canSubmitToDaf && (
                <Button onClick={handleSubmitToDaf} disabled={isSubmitting}>
                  <Send className="mr-2 h-4 w-4" />
                  Soumettre au DAF
                </Button>
              )}
              {canValidateDaf && (
                <>
                  <Button onClick={handleValidateDaf} disabled={isSubmitting} className="bg-success text-success-foreground hover:bg-success/90">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Valider
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={isSubmitting}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Refuser
                  </Button>
                </>
              )}
              {canManageStatus && (
                <Select
                  value={projet.status}
                  onValueChange={handleChangeOperationalStatus}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="actif">Actif</SelectItem>
                    <SelectItem value="termine">Terminé</SelectItem>
                    <SelectItem value="suspendu">Suspendu</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        )}

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
              {projet.budget != null && (
                <div className="flex items-start gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Budget</p>
                    <p className="font-medium">{Math.ceil(projet.budget).toLocaleString()} XOF</p>
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
                <Label>Client</Label>
                <Input
                  value={editForm.client}
                  onChange={(e) => setEditForm({ ...editForm, client: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Localisation</Label>
                <Input
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Budget (XOF)</Label>
                <Input
                  type="number"
                  value={editForm.budget}
                  onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })}
                />
              </div>
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

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Refuser le projet
            </DialogTitle>
            <DialogDescription>
              Le projet sera renvoyé à l'AAL pour correction.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Motif de refus *</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Indiquez le motif de refus..."
              rows={4}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectDaf}
              disabled={!rejectionReason.trim() || isSubmitting}
            >
              Refuser le projet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Supprimer ce projet ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {linkedItems.besoins + linkedItems.da + linkedItems.bl + linkedItems.mouvements > 0 ? (
                <span className="text-destructive">
                  Ce projet est rattaché à :
                  {linkedItems.besoins > 0 && ` ${linkedItems.besoins} besoin(s),`}
                  {linkedItems.da > 0 && ` ${linkedItems.da} DA,`}
                  {linkedItems.bl > 0 && ` ${linkedItems.bl} BL,`}
                  {linkedItems.mouvements > 0 && ` ${linkedItems.mouvements} mouvement(s)`}
                  . La suppression est impossible.
                </span>
              ) : (
                'Cette action est irréversible. Le projet sera définitivement supprimé.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            {linkedItems.besoins + linkedItems.da + linkedItems.bl + linkedItems.mouvements === 0 && (
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? 'Suppression...' : 'Supprimer'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
