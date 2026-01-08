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
  BesoinLigne,
  BesoinAttachment,
  BESOIN_URGENCY_LABELS,
  BESOIN_STATUS_LABELS,
  BESOIN_LIGNE_CATEGORY_LABELS,
  BESOIN_TYPE_ENUM_LABELS,
  BesoinTypeEnum,
} from '@/types/kpm';
import { UserBadge } from '@/components/ui/UserBadge';
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
  FolderOpen,
  MessageSquareWarning,
  MapPin,
  Truck,
  Wallet,
  Building2,
  Calendar,
  User,
  FileImage,
  File,
  Download,
  ExternalLink,
  Lock,
  Unlock,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BesoinLignesTable } from '@/components/besoins/BesoinLignesTable';
import { BesoinEditLogistique } from '@/components/besoins/BesoinEditLogistique';
import { CancelDialog } from '@/components/ui/CancelDialog';
import { Ban } from 'lucide-react';

const statusColors: Record<string, string> = {
  cree: 'bg-muted text-muted-foreground',
  pris_en_charge: 'bg-warning/10 text-warning border-warning/20',
  accepte: 'bg-success/10 text-success border-success/20',
  refuse: 'bg-destructive/10 text-destructive border-destructive/20',
  retourne: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  annulee: 'bg-muted text-muted-foreground line-through',
};

const statusIcons: Record<string, React.ElementType> = {
  cree: Clock,
  pris_en_charge: AlertTriangle,
  accepte: CheckCircle,
  refuse: XCircle,
  retourne: MessageSquareWarning,
  annulee: XCircle,
};

interface BesoinWithRelations extends Besoin {
  lignes?: BesoinLigne[];
  attachments?: BesoinAttachment[];
}

export default function BesoinDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, roles, isAdmin } = useAuth();
  const { toast } = useToast();

  const [besoin, setBesoin] = useState<BesoinWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [returnComment, setReturnComment] = useState('');
  const [lockReason, setLockReason] = useState('');
  const [canTransform, setCanTransform] = useState(false);

  // Logistique ET Achats partagent les mêmes capacités opérationnelles (mutualisation)
  const isLogistics = roles.some((r) => ['responsable_logistique', 'agent_logistique'].includes(r));
  const isAchats = roles.some((r) => ['responsable_achats', 'agent_achats'].includes(r));
  const isDG = roles.includes('dg');
  const isCreator = besoin?.user_id === user?.id;
  const canEdit = isCreator && (besoin?.status === 'cree' || besoin?.status === 'retourne');
  const canResubmit = isCreator && besoin?.status === 'retourne';
  // Mutualisation: Logistique ET Achats peuvent gérer les besoins
  const canManage = isLogistics || isAchats || isAdmin;
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
      // Fetch besoin with relations
      const { data, error } = await supabase
        .from('besoins')
        .select(`
          *,
          department:departments(id, name),
          user:profiles!besoins_user_id_fkey(id, first_name, last_name, email, photo_url, fonction),
          taken_by_profile:profiles!besoins_taken_by_fkey(id, first_name, last_name, photo_url, fonction),
          decided_by_profile:profiles!besoins_decided_by_fkey(id, first_name, last_name, photo_url, fonction)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        toast({ title: 'Erreur', description: 'Besoin introuvable.', variant: 'destructive' });
        navigate('/besoins');
        return;
      }

      // Fetch lignes
      const { data: lignesData } = await supabase
        .from('besoin_lignes')
        .select('*')
        .eq('besoin_id', id)
        .order('created_at', { ascending: true });

      // Fetch attachments
      const { data: attachmentsData } = await supabase
        .from('besoin_attachments')
        .select('*')
        .eq('besoin_id', id)
        .order('created_at', { ascending: true });

      setBesoin({
        ...data,
        lignes: lignesData || [],
        attachments: attachmentsData || [],
      } as BesoinWithRelations);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
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

      toast({ title: 'Besoin accepté', description: 'Ce besoin peut désormais être transformé en DA ou BL.' });
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

  // Nouvelle fonction: Retourner le besoin (mal formulé) - utilise le VRAI statut 'retourne'
  const handleReturn = async () => {
    if (!besoin || !returnComment.trim()) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('besoins')
        .update({
          status: 'retourne',
          return_comment: returnComment.trim(),
          rejection_reason: null, // Clear any previous rejection reason
          decided_by: user?.id,
          decided_at: new Date().toISOString(),
          // Réinitialiser le workflow pour permettre la correction
          taken_by: null,
          taken_at: null,
        })
        .eq('id', besoin.id);

      if (error) throw error;

      toast({ 
        title: 'Besoin retourné au demandeur', 
        description: 'Le demandeur peut maintenant corriger et resoumettre son besoin.' 
      });
      setShowReturnDialog(false);
      setReturnComment('');
      fetchBesoin();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Fonction pour resoumettre un besoin retourné (par le créateur)
  const handleResubmit = async () => {
    if (!besoin) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('besoins')
        .update({
          status: 'cree',
          return_comment: null, // Clear the return comment
          decided_by: null,
          decided_at: null,
        })
        .eq('id', besoin.id);

      if (error) throw error;

      toast({ 
        title: 'Besoin resoumis', 
        description: 'Votre besoin a été resoumis et sera examiné par la Logistique.' 
      });
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

  const handleToggleLock = async () => {
    if (!besoin) return;
    
    const isLocking = !besoin.is_locked;
    if (isLocking && !lockReason.trim()) {
      toast({ title: 'Erreur', description: 'Veuillez indiquer un motif de verrouillage.', variant: 'destructive' });
      return;
    }
    
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('besoins')
        .update({
          is_locked: isLocking,
          locked_at: isLocking ? new Date().toISOString() : null,
          locked_reason: isLocking ? lockReason.trim() : null,
        })
        .eq('id', besoin.id);

      if (error) throw error;

      toast({ 
        title: isLocking ? 'Besoin verrouillé' : 'Besoin déverrouillé', 
        description: isLocking 
          ? 'Ce besoin ne peut plus être modifié ou converti.' 
          : 'Ce besoin peut maintenant être modifié ou converti.'
      });
      setShowLockDialog(false);
      setLockReason('');
      fetchBesoin();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelBesoin = async (reason: string) => {
    if (!besoin || !user) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('besoins')
        .update({
          status: 'annulee',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
          cancellation_reason: reason,
        })
        .eq('id', besoin.id);

      if (error) throw error;

      toast({
        title: 'Besoin annulé',
        description: 'Le besoin a été annulé avec succès.',
      });
      setShowCancelDialog(false);
      fetchBesoin();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const getFileIcon = (type: string | null) => {
    if (!type) return File;
    if (type.startsWith('image/')) return FileImage;
    if (type === 'application/pdf') return FileText;
    return File;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
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
  const isReturnedBesoin = besoin.status === 'retourne';

  // Transform lignes to the format expected by BesoinLignesTable
  const lignesForDisplay = (besoin.lignes || []).map(l => ({
    id: l.id,
    designation: l.designation,
    category: l.category,
    unit: l.unit,
    quantity: l.quantity,
    urgency: l.urgency,
    justification: l.justification || '',
    article_stock_id: l.article_stock_id || null,
  }));

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
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
                  {besoin.objet_besoin || besoin.title}
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

          <div className="flex flex-wrap gap-2">
            <Link to={`/besoins/${id}/dossier`}>
              <Button variant="outline" size="sm">
                <FolderOpen className="mr-2 h-4 w-4" />
                Dossier
              </Button>
            </Link>
            {canManage && besoin.status === 'accepte' && (
              <Button
                variant="outline"
                size="sm"
                className={besoin.is_locked ? 'text-success hover:bg-success/10' : 'text-warning hover:bg-warning/10'}
                onClick={() => setShowLockDialog(true)}
              >
                {besoin.is_locked ? (
                  <>
                    <Unlock className="mr-2 h-4 w-4" />
                    Déverrouiller
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Verrouiller
                  </>
                )}
              </Button>
            )}
            {isAdmin && ['accepte', 'pris_en_charge'].includes(besoin.status) && besoin.status !== 'annulee' && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => setShowCancelDialog(true)}
              >
                <Ban className="mr-2 h-4 w-4" />
                Annuler
              </Button>
            )}
            {canDelete && ['cree', 'pris_en_charge', 'accepte', 'retourne', 'annulee'].includes(besoin.status) && (
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

        {/* Returned besoin - message and actions for creator */}
        {besoin.status === 'retourne' && (
          <Card className="border-orange-500/50 bg-orange-500/5">
            <CardContent className="flex items-start gap-3 py-4">
              <MessageSquareWarning className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
              <div className="flex-1">
                <p className="font-medium text-orange-600">Besoin à corriger</p>
                {besoin.return_comment && (
                  <p className="text-sm text-foreground whitespace-pre-wrap mt-1 p-2 bg-background rounded border">
                    {besoin.return_comment}
                  </p>
                )}
                {isCreator && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      Vous pouvez modifier les informations ci-dessous puis resoumettre votre besoin.
                    </p>
                    <Button onClick={handleResubmit} disabled={isSaving}>
                      <Play className="mr-2 h-4 w-4" />
                      Resoumettre le besoin
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rejection reason (only for truly rejected besoins) */}
        {besoin.status === 'refuse' && besoin.rejection_reason && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-start gap-3 py-4">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Motif du refus</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{besoin.rejection_reason}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Logistics actions - Créé */}
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

        {/* Logistics actions - Pris en charge */}
        {canManage && besoin.status === 'pris_en_charge' && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="py-4 space-y-4">
              <div>
                <p className="font-medium text-foreground">Décision requise</p>
                <p className="text-sm text-muted-foreground">
                  Accepter ce besoin pour transformation, le refuser, ou le retourner au demandeur si mal formulé.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="text-warning hover:bg-warning/10 border-warning/50"
                  onClick={() => setShowReturnDialog(true)}
                  disabled={isSaving}
                >
                  <MessageSquareWarning className="mr-2 h-4 w-4" />
                  Besoin mal formulé
                </Button>
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
        {canManage && besoin.status === 'accepte' && !besoin.is_locked && canTransform && (
          <Card className="border-success/50 bg-success/5">
            <CardContent className="py-4">
              <div className="mb-3">
                <p className="font-medium text-foreground">Conversion requise</p>
                <p className="text-sm text-muted-foreground">
                  Ce besoin a été accepté. Convertissez-le en DA ou BL.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link to={`/demandes-achat/nouveau?besoin=${besoin.id}`} className="flex-1">
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="mr-2 h-4 w-4" />
                    <div className="text-left">
                      <p className="font-medium">Convertir en DA</p>
                      <p className="text-xs text-muted-foreground">Achat requis auprès d'un fournisseur</p>
                    </div>
                  </Button>
                </Link>
                <Link to={`/bons-livraison/nouveau?besoin=${besoin.id}`} className="flex-1">
                  <Button variant="outline" className="w-full justify-start">
                    <Package className="mr-2 h-4 w-4" />
                    <div className="text-left">
                      <p className="font-medium">Convertir en BL</p>
                      <p className="text-xs text-muted-foreground">Livraison depuis le stock existant</p>
                    </div>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {canManage && besoin.status === 'accepte' && besoin.is_locked && (
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

        {/* Édition logistique pour besoin pris en charge ou accepté */}
        {canManage && (besoin.status === 'pris_en_charge' || besoin.status === 'accepte') && (
          <BesoinEditLogistique
            besoinId={besoin.id}
            besoin={besoin}
            onUpdate={fetchBesoin}
            isLocked={besoin.is_locked}
          />
        )}

        {/* Édition par le créateur pour besoin retourné */}
        {isCreator && besoin.status === 'retourne' && (
          <BesoinEditLogistique
            besoinId={besoin.id}
            besoin={besoin}
            onUpdate={fetchBesoin}
            isLocked={false}
          />
        )}

        {/* Identité du besoin */}
        <Card>
          <CardHeader>
            <CardTitle>Identité du besoin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Demandeur</p>
                <UserBadge
                  userId={(besoin.user as any)?.id}
                  photoUrl={(besoin.user as any)?.photo_url}
                  firstName={(besoin.user as any)?.first_name}
                  lastName={(besoin.user as any)?.last_name}
                  fonction={(besoin.user as any)?.fonction}
                  departmentName={besoin.department?.name}
                  showFonction
                  showDepartment
                  linkToProfile
                />
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Site / Projet</p>
                  <p className="font-medium">{besoin.site_projet || besoin.intended_usage || 'Non spécifié'}</p>
                </div>
              </div>
              {besoin.desired_date && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Date souhaitée</p>
                    <p className="font-medium">
                      {format(new Date(besoin.desired_date), 'dd MMMM yyyy', { locale: fr })}
                    </p>
                  </div>
                </div>
              )}
              {besoin.lieu_livraison && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Lieu de livraison</p>
                    <p className="font-medium">{besoin.lieu_livraison}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Contraintes */}
            <div className="flex flex-wrap gap-2 pt-2">
              {besoin.fournisseur_impose && (
                <Badge variant="outline" className="bg-muted">
                  Fournisseur imposé: {besoin.fournisseur_impose_nom}
                </Badge>
              )}
              {besoin.besoin_vehicule && (
                <Badge variant="outline" className="bg-muted">
                  <Truck className="mr-1 h-3 w-3" />
                  Véhicule requis
                </Badge>
              )}
              {besoin.besoin_avance_caisse && (
                <Badge variant="outline" className="bg-muted">
                  <Wallet className="mr-1 h-3 w-3" />
                  Avance de caisse: {besoin.avance_caisse_montant?.toLocaleString('fr-FR')} XOF
                </Badge>
              )}
            </div>

            {/* Suivi */}
            {(besoin.taken_by_profile || besoin.decided_by_profile) && (
              <div className="border-t pt-4 mt-4 space-y-2">
                {besoin.taken_by_profile && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Pris en charge par </span>
                    <span className="font-medium">
                      {besoin.taken_by_profile.first_name} {besoin.taken_by_profile.last_name}
                    </span>
                    {besoin.taken_at && (
                      <span className="text-muted-foreground">
                        {' '}le {format(new Date(besoin.taken_at), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    )}
                  </p>
                )}
                {besoin.decided_by_profile && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Décision par </span>
                    <span className="font-medium">
                      {besoin.decided_by_profile.first_name} {besoin.decided_by_profile.last_name}
                    </span>
                    {besoin.decided_at && (
                      <span className="text-muted-foreground">
                        {' '}le {format(new Date(besoin.decided_at), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lignes de besoin */}
        {lignesForDisplay.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Lignes de besoin ({lignesForDisplay.length})</CardTitle>
              <CardDescription>Articles et services demandés</CardDescription>
            </CardHeader>
            <CardContent>
              <BesoinLignesTable lignes={lignesForDisplay} onChange={() => {}} readOnly />
            </CardContent>
          </Card>
        )}

        {/* Legacy description if no lignes */}
        {lignesForDisplay.length === 0 && besoin.description && (
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-foreground">{besoin.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Pièces jointes multiples */}
        {((besoin.attachments && besoin.attachments.length > 0) || besoin.attachment_url) && (
          <Card>
            <CardHeader>
              <CardTitle>
                Pièces jointes ({(besoin.attachments?.length || 0) + (besoin.attachment_url && !besoin.attachments?.length ? 1 : 0)})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* New attachments table */}
              {besoin.attachments && besoin.attachments.length > 0 && (
                besoin.attachments.map((attachment) => {
                  const FileIcon = getFileIcon(attachment.file_type);
                  return (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <FileIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{attachment.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.file_size)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={attachment.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="sm">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Ouvrir
                          </Button>
                        </a>
                        <a
                          href={attachment.file_url}
                          download={attachment.file_name}
                        >
                          <Button variant="default" size="sm">
                            <Download className="mr-2 h-4 w-4" />
                            Télécharger
                          </Button>
                        </a>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Legacy single attachment */}
              {besoin.attachment_url && (!besoin.attachments || besoin.attachments.length === 0) && (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <File className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{besoin.attachment_name || 'Fichier joint'}</p>
                    <p className="text-xs text-muted-foreground">Document attaché au besoin</p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={besoin.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Ouvrir
                      </Button>
                    </a>
                    <a
                      href={besoin.attachment_url}
                      download={besoin.attachment_name || 'fichier'}
                    >
                      <Button variant="default" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger
                      </Button>
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
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

      {/* Return Dialog (Besoin mal formulé) */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareWarning className="h-5 w-5 text-warning" />
              Besoin mal formulé
            </DialogTitle>
            <DialogDescription>
              Retournez ce besoin au demandeur pour qu'il le corrige. 
              Un commentaire obligatoire sera joint pour l'aider.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Commentaire explicatif *</Label>
            <Textarea
              placeholder="Indiquez ce qui doit être corrigé ou précisé (ex: désignation trop vague, quantité manquante, site non précisé...)"
              value={returnComment}
              onChange={(e) => setReturnComment(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnDialog(false)}>
              Annuler
            </Button>
            <Button
              variant="default"
              className="bg-warning text-warning-foreground hover:bg-warning/90"
              onClick={handleReturn}
              disabled={!returnComment.trim() || isSaving}
            >
              Retourner au demandeur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lock/Unlock Dialog */}
      <Dialog open={showLockDialog} onOpenChange={setShowLockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {besoin?.is_locked ? (
                <>
                  <Unlock className="h-5 w-5 text-success" />
                  Déverrouiller ce besoin
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5 text-warning" />
                  Verrouiller ce besoin
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {besoin?.is_locked 
                ? 'Le déverrouillage permettra à nouveau de modifier ou convertir ce besoin.'
                : 'Le verrouillage empêchera toute modification ou conversion ultérieure.'
              }
            </DialogDescription>
          </DialogHeader>
          {!besoin?.is_locked && (
            <div className="space-y-2">
              <Label>Motif du verrouillage *</Label>
              <Textarea
                placeholder="Ex: Besoin déjà converti en DA-2025-001, correction terminée..."
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
                rows={3}
              />
            </div>
          )}
          {besoin?.is_locked && besoin.locked_reason && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm text-muted-foreground">Motif du verrouillage actuel :</p>
              <p className="text-sm font-medium">{besoin.locked_reason}</p>
              {besoin.locked_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Verrouillé le {format(new Date(besoin.locked_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowLockDialog(false); setLockReason(''); }}>
              Annuler
            </Button>
            <Button
              variant={besoin?.is_locked ? 'default' : 'secondary'}
              className={besoin?.is_locked ? '' : 'bg-warning text-warning-foreground hover:bg-warning/90'}
              onClick={handleToggleLock}
              disabled={(!besoin?.is_locked && !lockReason.trim()) || isSaving}
            >
              {besoin?.is_locked ? 'Déverrouiller' : 'Verrouiller'}
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

      {/* Cancel Dialog */}
      <CancelDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onConfirm={handleCancelBesoin}
        entityType="besoin"
        isLoading={isSaving}
      />
    </AppLayout>
  );
}
