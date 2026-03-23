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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Projet, PROJET_STATUS_LABELS } from '@/types/kpm';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  X,
  Info,
  TrendingDown,
  TrendingUp,
  ArrowUpDown,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface CaisseWithSolde {
  id: string;
  code: string;
  name: string;
  devise: string;
  solde_actuel: number;
  solde_initial: number;
}

interface CaisseMouvement {
  id: string;
  reference: string;
  type: string;
  montant: number;
  motif: string;
  created_at: string;
  solde_avant: number;
  solde_apres: number;
}

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
  const [linkedCaisses, setLinkedCaisses] = useState<CaisseWithSolde[]>([]);
  const [availableCaisses, setAvailableCaisses] = useState<CaisseWithSolde[]>([]);
  const [editSelectedCaisses, setEditSelectedCaisses] = useState<string[]>([]);

  // Dépenses totales du projet (mouvements de type sortie liés aux caisses du projet)
  const [totalDepenses, setTotalDepenses] = useState(0);
  const [recentMouvements, setRecentMouvements] = useState<CaisseMouvement[]>([]);

  const isAAL = roles.includes('aal');
  const isDaf = roles.includes('daf');
  const isDG = roles.includes('dg');
  const isLogistics = roles.some((r) => ['responsable_logistique', 'agent_logistique'].includes(r));

  const canEdit = (isAAL && projet?.status === 'brouillon') || (isLogistics && projet?.status === 'brouillon' && projet?.created_by === user?.id) || isAdmin;
  const canDelete = isAdmin;
  const canSubmitToDaf = (isAAL || isAdmin || (isLogistics && projet?.created_by === user?.id)) && projet?.status === 'brouillon';
  const canValidateDaf = (isDaf || isAdmin) && projet?.status === 'soumis_daf';
  const canRejectDaf = (isDaf || isAdmin) && projet?.status === 'soumis_daf';
  const canManageStatus = (isDaf || isAdmin) && projet?.status && ['valide_daf', 'actif', 'termine', 'suspendu'].includes(projet.status);

  // Budget metrics
  const totalCaissesBudget = linkedCaisses.reduce((sum, c) => sum + (c.solde_actuel || 0), 0);
  const budgetUtilise = totalDepenses;
  const budgetRestant = (projet?.budget || totalCaissesBudget) - budgetUtilise;
  const budgetPourcentage = (projet?.budget || totalCaissesBudget) > 0
    ? Math.min(100, (budgetUtilise / (projet?.budget || totalCaissesBudget)) * 100)
    : 0;
  const isOverBudget = budgetRestant < 0;

  // Auto-calc for edit
  const editTotalCaisses = editSelectedCaisses.reduce((sum, cId) => {
    const c = availableCaisses.find((x) => x.id === cId);
    return sum + (c?.solde_actuel || 0);
  }, 0);

  useEffect(() => {
    if (id) {
      fetchProjet();
      fetchLinkedItems();
      fetchLinkedCaisses();
      fetchAvailableCaisses();
    }
  }, [id]);

  useEffect(() => {
    if (linkedCaisses.length > 0 && id) {
      fetchProjectDepenses();
    }
  }, [linkedCaisses, id]);

  const fetchProjectDepenses = async () => {
    try {
      // Get total spent via DA payees linked to this project
      const { data: daData } = await supabase
        .from('demandes_achat')
        .select('total_amount')
        .eq('projet_id', id)
        .eq('status', 'payee');

      const totalDA = (daData || []).reduce((sum, d) => sum + (d.total_amount || 0), 0);

      // Get total spent via notes de frais payées linked to this project
      const { data: nfData } = await supabase
        .from('notes_frais')
        .select('total_amount')
        .eq('projet_id', id)
        .eq('status', 'payee');

      const totalNF = (nfData || []).reduce((sum, d) => sum + (d.total_amount || 0), 0);

      setTotalDepenses(totalDA + totalNF);

      // Fetch recent mouvements from linked caisses
      const caisseIds = linkedCaisses.map((c) => c.id);
      if (caisseIds.length > 0) {
        const { data: mouvData } = await supabase
          .from('caisse_mouvements')
          .select('id, reference, type, montant, motif, created_at, solde_avant, solde_apres')
          .in('caisse_id', caisseIds)
          .order('created_at', { ascending: false })
          .limit(10);

        setRecentMouvements(mouvData || []);
      }
    } catch (e) {
      console.error('Error fetching depenses:', e);
    }
  };

  const fetchLinkedCaisses = async () => {
    try {
      const { data } = await supabase
        .from('projet_caisses')
        .select('caisse_id, caisses(id, code, name, devise, solde_actuel, solde_initial)')
        .eq('projet_id', id);
      const caisses = (data || []).map((d: any) => d.caisses).filter(Boolean);
      setLinkedCaisses(caisses);
      setEditSelectedCaisses(caisses.map((c: any) => c.id));
    } catch (e) {
      console.error('Error fetching linked caisses:', e);
    }
  };

  const fetchAvailableCaisses = async () => {
    try {
      const { data } = await supabase
        .from('caisses')
        .select('id, code, name, devise, solde_actuel, solde_initial')
        .eq('is_active', true)
        .order('code');
      setAvailableCaisses(data || []);
    } catch (e) {
      console.error('Error fetching caisses:', e);
    }
  };

  const toggleEditCaisse = (caisseId: string) => {
    setEditSelectedCaisses((prev) =>
      prev.includes(caisseId) ? prev.filter((id) => id !== caisseId) : [...prev, caisseId]
    );
  };

  // Auto-update edit budget when caisses change
  useEffect(() => {
    if (showEditDialog && editSelectedCaisses.length > 0) {
      setEditForm((prev) => ({ ...prev, budget: Math.ceil(editTotalCaisses).toString() }));
    }
  }, [editSelectedCaisses, editTotalCaisses, showEditDialog]);

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

      // Sync caisses
      await supabase.from('projet_caisses').delete().eq('projet_id', projet.id);
      if (editSelectedCaisses.length > 0) {
        await supabase.from('projet_caisses').insert(
          editSelectedCaisses.map((caisseId) => ({
            projet_id: projet.id,
            caisse_id: caisseId,
            created_by: user?.id,
          }))
        );
      }

      toast({ title: 'Projet modifié', description: 'Les modifications ont été enregistrées.' });
      setShowEditDialog(false);
      fetchProjet();
      fetchLinkedCaisses();
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

        {/* Budget overrun alert (Point 4) */}
        {isOverBudget && linkedCaisses.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-start gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">⚠️ Dépassement de budget</p>
                <p className="text-sm text-muted-foreground">
                  Les dépenses ({Math.ceil(budgetUtilise).toLocaleString()} XOF) dépassent le budget alloué ({Math.ceil(projet.budget || totalCaissesBudget).toLocaleString()} XOF) de{' '}
                  <span className="font-bold text-destructive">{Math.ceil(Math.abs(budgetRestant)).toLocaleString()} XOF</span>.
                </p>
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

        {/* Tableau de bord Caisses (Point 2 & 3) */}
        {linkedCaisses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Caisses associées au projet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Budget progress bar */}
              {(projet.budget || totalCaissesBudget > 0) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Consommation budget</span>
                    <span className={`font-medium ${isOverBudget ? 'text-destructive' : 'text-foreground'}`}>
                      {Math.ceil(budgetPourcentage)}%
                    </span>
                  </div>
                  <Progress
                    value={budgetPourcentage}
                    className={`h-3 ${isOverBudget ? '[&>div]:bg-destructive' : budgetPourcentage > 80 ? '[&>div]:bg-warning' : ''}`}
                  />
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Budget total</p>
                      <p className="font-bold text-foreground">
                        {Math.ceil(projet.budget || totalCaissesBudget).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">XOF</p>
                    </div>
                    <div className="rounded-lg bg-warning/5 p-3">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <TrendingDown className="h-3 w-3" /> Dépensé
                      </p>
                      <p className="font-bold text-warning">
                        {Math.ceil(budgetUtilise).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">XOF</p>
                    </div>
                    <div className={`rounded-lg p-3 ${isOverBudget ? 'bg-destructive/5' : 'bg-success/5'}`}>
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <TrendingUp className="h-3 w-3" /> Restant
                      </p>
                      <p className={`font-bold ${isOverBudget ? 'text-destructive' : 'text-success'}`}>
                        {Math.ceil(budgetRestant).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">XOF</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Caisses detail table */}
              <div>
                <p className="text-sm font-medium mb-3">Détail des caisses</p>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Nom</TableHead>
                        <TableHead>Devise</TableHead>
                        <TableHead className="text-right">Solde initial</TableHead>
                        <TableHead className="text-right">Solde actuel</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linkedCaisses.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-sm">{c.code}</TableCell>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{c.devise}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {Math.ceil(c.solde_initial).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {Math.ceil(c.solde_actuel).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/30 font-bold">
                        <TableCell colSpan={3}>Total</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {Math.ceil(linkedCaisses.reduce((s, c) => s + c.solde_initial, 0)).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {Math.ceil(totalCaissesBudget).toLocaleString()} XOF
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Recent movements */}
              {recentMouvements.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4" />
                    Derniers mouvements
                  </p>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Référence</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Motif</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentMouvements.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="text-sm">
                              {format(new Date(m.created_at), 'dd/MM/yy HH:mm', { locale: fr })}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{m.reference}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={m.type === 'entree' ? 'border-success/30 text-success' : m.type === 'sortie' ? 'border-destructive/30 text-destructive' : ''}
                              >
                                {m.type === 'entree' ? '↑ Entrée' : m.type === 'sortie' ? '↓ Sortie' : m.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm max-w-[200px] truncate">{m.motif}</TableCell>
                            <TableCell className={`text-right font-medium ${m.type === 'entree' ? 'text-success' : 'text-destructive'}`}>
                              {m.type === 'entree' ? '+' : '-'}{Math.ceil(m.montant).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Show message if no caisses linked */}
        {linkedCaisses.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex items-center gap-3 py-6 justify-center text-muted-foreground">
              <Wallet className="h-5 w-5" />
              <p className="text-sm">Aucune caisse associée à ce projet</p>
            </CardContent>
          </Card>
        )}
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
                <div className="flex items-center gap-2">
                  <Label>Budget (XOF)</Label>
                  {editSelectedCaisses.length > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Auto-calculé depuis les caisses</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <Input
                  type="number"
                  value={editForm.budget}
                  onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })}
                />
                {editSelectedCaisses.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    💰 Total caisses : {Math.ceil(editTotalCaisses).toLocaleString()} XOF
                  </p>
                )}
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
            {/* Caisse selector in edit */}
            <div className="grid gap-2">
              <Label className="flex items-center gap-1">
                <Wallet className="h-4 w-4" />
                Caisses associées
              </Label>
              {editSelectedCaisses.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editSelectedCaisses.map((cId) => {
                    const c = availableCaisses.find((x) => x.id === cId);
                    return c ? (
                      <Badge key={cId} variant="secondary" className="gap-1">
                        {c.code} - {c.name}
                        <span className="text-xs font-normal ml-1">
                          ({Math.ceil(c.solde_actuel).toLocaleString()} {c.devise})
                        </span>
                        <X className="h-3 w-3 cursor-pointer" onClick={() => toggleEditCaisse(cId)} />
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
              {availableCaisses.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune caisse disponible</p>
              ) : (
                <div className="max-h-32 overflow-y-auto rounded-md border p-2 space-y-1">
                  {availableCaisses.map((c) => (
                    <label key={c.id} className="flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={editSelectedCaisses.includes(c.id)}
                          onCheckedChange={() => toggleEditCaisse(c.id)}
                        />
                        <span className="text-sm">{c.code} - {c.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {Math.ceil(c.solde_actuel).toLocaleString()} {c.devise}
                      </span>
                    </label>
                  ))}
                </div>
              )}
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
