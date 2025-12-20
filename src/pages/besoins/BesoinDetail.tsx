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
import { useToast } from '@/hooks/use-toast';
import {
  Besoin,
  BesoinCategory,
  BesoinUrgency,
  BESOIN_CATEGORY_LABELS,
  BESOIN_URGENCY_LABELS,
  BESOIN_STATUS_LABELS,
} from '@/types/kpm';
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Play,
  Check,
  X,
  FileText,
  Package,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const statusColors: Record<string, string> = {
  cree: 'bg-muted text-muted-foreground',
  pris_en_charge: 'bg-warning/10 text-warning border-warning/20',
  accepte: 'bg-success/10 text-success border-success/20',
  refuse: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusIcons: Record<string, React.ElementType> = {
  cree: Clock,
  pris_en_charge: AlertTriangle,
  accepte: CheckCircle,
  refuse: XCircle,
};

export default function BesoinDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, roles, isAdmin } = useAuth();
  const { toast } = useToast();

  const [besoin, setBesoin] = useState<Besoin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [canTransform, setCanTransform] = useState(false);

  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    category: '' as BesoinCategory,
    urgency: 'normale' as BesoinUrgency,
    desired_date: '',
  });

  const isLogistics = roles.some((r) => ['responsable_logistique', 'agent_logistique'].includes(r));
  const isDG = roles.includes('dg');
  const isCreator = besoin?.user_id === user?.id;
  const canEdit = isCreator && besoin?.status === 'cree';
  const canManage = isLogistics || isAdmin;
  const canDelete = isAdmin;

  useEffect(() => {
    if (id) {
      fetchBesoin();
    }
  }, [id]);

  useEffect(() => {
    if (besoin?.status === 'accepte' && id) {
      checkCanTransform();
    }
  }, [besoin?.status, id]);

  const checkCanTransform = async () => {
    const { data } = await supabase.rpc('can_transform_besoin', { _besoin_id: id });
    setCanTransform(data === true);
  };

  const fetchBesoin = async () => {
    try {
      const { data, error } = await supabase
        .from('besoins')
        .select(`
          *,
          department:departments(id, name),
          user:profiles!besoins_user_id_fkey(id, first_name, last_name, email),
          taken_by_profile:profiles!besoins_taken_by_fkey(id, first_name, last_name),
          decided_by_profile:profiles!besoins_decided_by_fkey(id, first_name, last_name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error:', error);
        toast({ title: 'Erreur', description: 'Besoin introuvable.', variant: 'destructive' });
        navigate('/besoins');
        return;
      }

      if (!data) {
        toast({ title: 'Erreur', description: 'Besoin introuvable.', variant: 'destructive' });
        navigate('/besoins');
        return;
      }

      setBesoin(data);
      setEditForm({
        title: data.title,
        description: data.description,
        category: data.category,
        urgency: data.urgency,
        desired_date: data.desired_date || '',
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!besoin) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('besoins')
        .update({
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          category: editForm.category,
          urgency: editForm.urgency,
          desired_date: editForm.desired_date || null,
        })
        .eq('id', besoin.id);

      if (error) throw error;

      toast({ title: 'Besoin modifié', description: 'Les modifications ont été enregistrées.' });
      setIsEditing(false);
      fetchBesoin();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTakeOver = async () => {
    if (!besoin) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('besoins')
        .update({
          status: 'pris_en_charge',
          taken_by: user?.id,
          taken_at: new Date().toISOString(),
        })
        .eq('id', besoin.id);

      if (error) throw error;

      toast({ title: 'Besoin pris en charge', description: 'Vous êtes maintenant responsable de ce besoin.' });
      fetchBesoin();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAccept = async () => {
    if (!besoin) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('besoins')
        .update({
          status: 'accepte',
          decided_by: user?.id,
          decided_at: new Date().toISOString(),
        })
        .eq('id', besoin.id);

      if (error) throw error;

      toast({ title: 'Besoin accepté', description: 'Ce besoin peut désormais faire l\'objet d\'une Demande d\'Achat.' });
      fetchBesoin();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!besoin || !rejectionReason.trim()) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('besoins')
        .update({
          status: 'refuse',
          rejection_reason: rejectionReason.trim(),
          decided_by: user?.id,
          decided_at: new Date().toISOString(),
        })
        .eq('id', besoin.id);

      if (error) throw error;

      toast({ title: 'Besoin refusé', description: 'Le créateur a été notifié du refus.' });
      setShowRejectDialog(false);
      fetchBesoin();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!besoin) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('besoins')
        .delete()
        .eq('id', besoin.id);

      if (error) throw error;

      toast({ title: 'Besoin supprimé', description: 'Le besoin a été supprimé avec succès.' });
      navigate('/besoins');
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
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

  if (!besoin) return null;

  const StatusIcon = statusIcons[besoin.status];

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/besoins">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-2xl font-bold text-foreground">
                  {besoin.title}
                </h1>
                <Badge className={statusColors[besoin.status]}>
                  <StatusIcon className="mr-1 h-3 w-3" />
                  {BESOIN_STATUS_LABELS[besoin.status]}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Créé le {format(new Date(besoin.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {canEdit && !isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
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

        {/* Rejection reason */}
        {besoin.status === 'refuse' && besoin.rejection_reason && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-start gap-3 py-4">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Motif du refus</p>
                <p className="text-sm text-foreground">{besoin.rejection_reason}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Logistics actions */}
        {canManage && besoin.status === 'cree' && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">Action requise</p>
                <p className="text-sm text-muted-foreground">
                  Ce besoin attend d'être pris en charge par la Logistique.
                </p>
              </div>
              <Button onClick={handleTakeOver} disabled={isSaving}>
                <Play className="mr-2 h-4 w-4" />
                Prendre en charge
              </Button>
            </CardContent>
          </Card>
        )}

        {canManage && besoin.status === 'pris_en_charge' && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">Décision requise</p>
                <p className="text-sm text-muted-foreground">
                  Accepter ce besoin pour transformation en Demande d'Achat, ou le refuser.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={isSaving}
                >
                  <X className="mr-2 h-4 w-4" />
                  Refuser
                </Button>
                <Button onClick={handleAccept} disabled={isSaving}>
                  <Check className="mr-2 h-4 w-4" />
                  Accepter
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transformation actions for accepted besoins */}
        {canManage && besoin.status === 'accepte' && canTransform && (
          <Card className="border-success/50 bg-success/5">
            <CardContent className="py-4">
              <div className="mb-3">
                <p className="font-medium text-foreground">Transformation requise</p>
                <p className="text-sm text-muted-foreground">
                  Ce besoin a été accepté. Choisissez comment le traiter :
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link to={`/demandes-achat/nouveau?besoin=${besoin.id}`} className="flex-1">
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="mr-2 h-4 w-4" />
                    <div className="text-left">
                      <p className="font-medium">Transformer en DA</p>
                      <p className="text-xs text-muted-foreground">Achat requis auprès d'un fournisseur</p>
                    </div>
                  </Button>
                </Link>
                <Link to={`/bons-livraison/nouveau?besoin=${besoin.id}`} className="flex-1">
                  <Button variant="outline" className="w-full justify-start">
                    <Package className="mr-2 h-4 w-4" />
                    <div className="text-left">
                      <p className="font-medium">Transformer en BL</p>
                      <p className="text-xs text-muted-foreground">Livraison depuis le stock existant</p>
                    </div>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {canManage && besoin.status === 'accepte' && !canTransform && (
          <Card className="border-muted bg-muted/30">
            <CardContent className="flex items-start gap-3 py-4">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              <div>
                <p className="font-medium text-foreground">Besoin déjà transformé</p>
                <p className="text-sm text-muted-foreground">
                  Ce besoin a déjà été transformé en DA ou BL.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Détails du besoin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isEditing ? (
              <>
                <div className="space-y-2">
                  <Label>Titre</Label>
                  <Input
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={5}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Catégorie</Label>
                    <Select
                      value={editForm.category}
                      onValueChange={(v) => setEditForm({ ...editForm, category: v as BesoinCategory })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(BESOIN_CATEGORY_LABELS) as BesoinCategory[]).map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {BESOIN_CATEGORY_LABELS[cat]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Urgence</Label>
                    <Select
                      value={editForm.urgency}
                      onValueChange={(v) => setEditForm({ ...editForm, urgency: v as BesoinUrgency })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(BESOIN_URGENCY_LABELS) as BesoinUrgency[]).map((urg) => (
                          <SelectItem key={urg} value={urg}>
                            {BESOIN_URGENCY_LABELS[urg]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Date souhaitée</Label>
                  <Input
                    type="date"
                    value={editForm.desired_date}
                    onChange={(e) => setEditForm({ ...editForm, desired_date: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                    Annuler
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Département</p>
                    <p className="font-medium">{besoin.department?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Créé par</p>
                    <p className="font-medium">
                      {besoin.user?.first_name} {besoin.user?.last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Catégorie</p>
                    <Badge variant="outline">{BESOIN_CATEGORY_LABELS[besoin.category]}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Urgence</p>
                    <Badge
                      className={
                        besoin.urgency === 'critique'
                          ? 'bg-destructive/10 text-destructive'
                          : besoin.urgency === 'urgente'
                          ? 'bg-warning/10 text-warning'
                          : 'bg-muted text-muted-foreground'
                      }
                    >
                      {BESOIN_URGENCY_LABELS[besoin.urgency]}
                    </Badge>
                  </div>
                  {besoin.desired_date && (
                    <div>
                      <p className="text-sm text-muted-foreground">Date souhaitée</p>
                      <p className="font-medium">
                        {format(new Date(besoin.desired_date), 'dd MMMM yyyy', { locale: fr })}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-sm text-muted-foreground">Description</p>
                  <p className="whitespace-pre-wrap text-foreground">{besoin.description}</p>
                </div>

                {besoin.taken_by_profile && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground">Pris en charge par</p>
                    <p className="font-medium">
                      {besoin.taken_by_profile.first_name} {besoin.taken_by_profile.last_name}
                      {besoin.taken_at && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          le {format(new Date(besoin.taken_at), 'dd MMM yyyy', { locale: fr })}
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {besoin.decided_by_profile && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground">Décision prise par</p>
                    <p className="font-medium">
                      {besoin.decided_by_profile.first_name} {besoin.decided_by_profile.last_name}
                      {besoin.decided_at && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          le {format(new Date(besoin.decided_at), 'dd MMM yyyy', { locale: fr })}
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser ce besoin</DialogTitle>
            <DialogDescription>
              Veuillez indiquer le motif du refus. Le créateur sera notifié.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motif du refus *</Label>
            <Textarea
              placeholder="Expliquez pourquoi ce besoin est refusé..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || isSaving}
            >
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce besoin ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le besoin sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
