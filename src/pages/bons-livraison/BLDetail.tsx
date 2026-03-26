import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  BonLivraison, BLArticle, BL_STATUS_LABELS, BLStatus, OPERATIONAL_ROLES, DA_CATEGORY_LABELS,
} from '@/types/kpm';
import {
  ArrowLeft, Clock, CheckCircle, Truck, FileCheck, Trash2, FileText,
  ExternalLink, AlertTriangle, XCircle, PackageCheck, Download, ShoppingCart,
  Ban, Edit, Send, ShieldCheck, Lock,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { exportBLToPDF } from '@/utils/pdfExport';
import { CancelDialog } from '@/components/ui/CancelDialog';
import { SignaturePad } from '@/components/bons-livraison/SignaturePad';
import { ReadOnlyBadge } from '@/components/ui/ReadOnlyBadge';

const statusColors: Record<BLStatus, string> = {
  brouillon: 'bg-muted text-muted-foreground',
  prepare: 'bg-muted text-muted-foreground',
  soumis_aal: 'bg-warning/10 text-warning border-warning/20',
  soumis_daf: 'bg-warning/10 text-warning border-warning/20',
  en_attente_validation: 'bg-warning/10 text-warning border-warning/20',
  valide_daf: 'bg-primary/10 text-primary border-primary/20',
  pret_a_livrer: 'bg-success/10 text-success border-success/20',
  valide: 'bg-primary/10 text-primary border-primary/20',
  livre: 'bg-success/10 text-success border-success/20',
  livree_partiellement: 'bg-warning/10 text-warning border-warning/20',
  refuse_daf: 'bg-destructive/10 text-destructive border-destructive/20',
  refusee: 'bg-destructive/10 text-destructive border-destructive/20',
  annulee: 'bg-muted text-muted-foreground line-through',
  cloture: 'bg-muted text-muted-foreground',
};

const statusIcons: Record<BLStatus, React.ElementType> = {
  brouillon: Edit,
  prepare: Clock,
  soumis_aal: FileCheck,
  soumis_daf: FileCheck,
  en_attente_validation: FileCheck,
  valide_daf: ShieldCheck,
  pret_a_livrer: PackageCheck,
  valide: CheckCircle,
  livre: Truck,
  livree_partiellement: AlertTriangle,
  refuse_daf: XCircle,
  refusee: XCircle,
  annulee: XCircle,
  cloture: Lock,
};

interface DeliveryFormArticle {
  id: string;
  designation: string;
  quantity_ordered: number;
  quantity_delivered: number;
  ecart_reason: string;
}

export default function BLDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, roles, isAdmin } = useAuth();
  const { toast } = useToast();

  const [bl, setBL] = useState<BonLivraison | null>(null);
  const [articles, setArticles] = useState<BLArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeliveryDialog, setShowDeliveryDialog] = useState(false);
  const [showReliquatDialog, setShowReliquatDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSource, setRejectSource] = useState<'aal' | 'daf'>('daf');
  const [deliveryArticles, setDeliveryArticles] = useState<DeliveryFormArticle[]>([]);
  const [isCreatingDA, setIsCreatingDA] = useState(false);
  const [receiverName, setReceiverName] = useState('');
  const [deliverySignature, setDeliverySignature] = useState<string | null>(null);
  const [deliveryObs, setDeliveryObs] = useState('');

  const isOperational = roles.some((r) => OPERATIONAL_ROLES.includes(r));
  const isDAF = roles.includes('daf');
  const isAAL = roles.includes('aal');

  // NEW WORKFLOW permissions
  // Logistique soumet le BL brouillon → soumis_aal
  const canSubmitToAAL = (isOperational || isAdmin) && (bl?.status === 'brouillon' || bl?.status === 'prepare');
  // AAL valide → soumis_daf  OR  rejette → brouillon
  const canValidateAAL = (isAAL || isAdmin) && bl?.status === 'soumis_aal';
  // DAF valide → valide_daf  OR  refuse → refuse_daf (retour AAL)
  const canValidateDAF = (isDAF || isAdmin) && bl?.status === 'soumis_daf';
  // Logistique marque prêt à livrer
  const canMarkReady = (isOperational || isAdmin) && bl?.status === 'valide_daf';
  // Logistique enregistre la livraison
  const canDeliver = (isOperational || isAdmin) && bl?.status === 'pret_a_livrer';
  // Clôture après livraison
  const canClose = (isOperational || isAdmin) && bl?.status === 'livre';
  // AAL can resubmit after DAF refusal
  const canResubmitAfterRefuse = (isAAL || isAdmin) && bl?.status === 'refuse_daf';
  
  const canDelete = isAdmin;

  // Legacy compat
  const canRequestValidation = (isOperational || isAdmin) && bl?.status === 'en_attente_validation';
  const canValidateLegacy = (isDAF || isAdmin) && bl?.status === 'en_attente_validation';
  const canDeliverLegacy = (isOperational || isAdmin) && bl?.status === 'valide';

  const reliquatArticles = articles.filter((art) => {
    const ordered = art.quantity_ordered || art.quantity;
    const delivered = art.quantity_delivered || 0;
    return delivered < ordered && delivered > 0;
  });
  const hasReliquat = bl?.status === 'livree_partiellement' && reliquatArticles.length > 0;
  const canCreateDAFromReliquat = (isOperational || isAdmin) && hasReliquat;

  useEffect(() => {
    if (id) { fetchBL(); fetchArticles(); }
  }, [id]);

  const fetchBL = async () => {
    try {
      const { data, error } = await supabase
        .from('bons_livraison')
        .select(`*, department:departments(id, name), besoin:besoins(id, title)`)
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        toast({ title: 'Erreur', description: 'BL introuvable.', variant: 'destructive' });
        navigate('/bons-livraison');
        return;
      }

      const actorIds = [
        data.created_by, data.validated_by, data.delivered_by, data.rejected_by,
        data.validated_aal_by, data.validated_daf_by,
      ].filter(Boolean) as string[];

      const { data: profilesData } = await supabase.rpc('get_public_profiles', { _user_ids: actorIds });
      const profilesById: Record<string, any> = {};
      (profilesData || []).forEach((p: any) => { profilesById[p.id] = p; });

      const enrichedBL = {
        ...data,
        created_by_profile: profilesById[data.created_by] || null,
        validated_by_profile: data.validated_by ? profilesById[data.validated_by] || null : null,
        validated_aal_by_profile: data.validated_aal_by ? profilesById[data.validated_aal_by] || null : null,
        validated_daf_by_profile: data.validated_daf_by ? profilesById[data.validated_daf_by] || null : null,
        delivered_by_profile: data.delivered_by ? profilesById[data.delivered_by] || null : null,
        rejected_by_profile: data.rejected_by ? profilesById[data.rejected_by] || null : null,
      };
      setBL(enrichedBL as BonLivraison);
    } catch (error: any) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchArticles = async () => {
    const { data } = await supabase.from('bl_articles').select('*').eq('bl_id', id).order('created_at');
    setArticles((data as BLArticle[]) || []);
  };

  const updateStatus = async (newStatus: BLStatus, extraUpdates: Record<string, any> = {}) => {
    if (!bl) return;
    setIsSaving(true);
    try {
      const updates: any = { status: newStatus, ...extraUpdates };
      const { error } = await supabase.from('bons_livraison').update(updates).eq('id', bl.id);
      if (error) throw error;
      toast({ title: 'Statut mis à jour', description: BL_STATUS_LABELS[newStatus] });
      fetchBL();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Submit to AAL
  const handleSubmitToAAL = () => updateStatus('soumis_aal');

  // AAL validates → soumis_daf
  const handleAALValidate = () => updateStatus('soumis_daf', {
    validated_aal_by: user?.id,
    validated_aal_at: new Date().toISOString(),
  });

  // AAL rejects → brouillon
  const handleAALReject = async () => {
    if (!rejectReason.trim()) {
      toast({ title: 'Motif requis', description: 'Veuillez indiquer un motif de rejet.', variant: 'destructive' });
      return;
    }
    await updateStatus('brouillon', { aal_rejection_reason: rejectReason });
    setShowRejectDialog(false);
    setRejectReason('');
  };

  // DAF validates → valide_daf
  const handleDAFValidate = () => updateStatus('valide_daf', {
    validated_daf_by: user?.id,
    validated_daf_at: new Date().toISOString(),
  });

  // DAF refuses → refuse_daf
  const handleDAFReject = async () => {
    if (!rejectReason.trim()) {
      toast({ title: 'Motif requis', description: 'Veuillez indiquer un motif de refus.', variant: 'destructive' });
      return;
    }
    await updateStatus('refuse_daf', {
      daf_rejection_reason: rejectReason,
      rejected_by: user?.id,
      rejected_at: new Date().toISOString(),
    });
    setShowRejectDialog(false);
    setRejectReason('');
  };

  // AAL resubmits after DAF refusal
  const handleResubmitToDAF = () => updateStatus('soumis_daf', {
    validated_aal_by: user?.id,
    validated_aal_at: new Date().toISOString(),
    daf_rejection_reason: null,
  });

  // Mark ready to deliver
  const handleMarkReady = () => updateStatus('pret_a_livrer');

  // Close BL
  const handleClose = () => updateStatus('cloture');

  const openRejectDialog = (source: 'aal' | 'daf') => {
    setRejectSource(source);
    setRejectReason('');
    setShowRejectDialog(true);
  };

  const openDeliveryDialog = () => {
    setDeliveryArticles(
      articles.map((art) => ({
        id: art.id,
        designation: art.designation,
        quantity_ordered: art.quantity_ordered || art.quantity,
        quantity_delivered: art.quantity_delivered || 0,
        ecart_reason: art.ecart_reason || '',
      }))
    );
    setShowDeliveryDialog(true);
  };

  const handleDelivery = async () => {
    if (!bl || !user) return;
    if (!receiverName.trim()) {
      toast({ title: 'Nom du réceptionnaire requis', description: 'Veuillez saisir le nom de la personne qui réceptionne.', variant: 'destructive' });
      return;
    }
    if (!deliverySignature) {
      toast({ title: 'Signature requise', description: 'Veuillez apposer une signature de réception.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      for (const art of deliveryArticles) {
        await supabase.from('bl_articles').update({
          quantity_delivered: art.quantity_delivered,
          ecart_reason: art.ecart_reason || null,
        }).eq('id', art.id);
      }
      const isPartial = deliveryArticles.some((art) => art.quantity_delivered < art.quantity_ordered);
      const newStatus: BLStatus = isPartial ? 'livree_partiellement' : 'livre';
      const { error } = await supabase.from('bons_livraison').update({
        status: newStatus,
        delivered_by: user.id,
        delivered_at: new Date().toISOString(),
        receiver_name: receiverName.trim(),
        delivery_signature: deliverySignature,
        delivery_observations: deliveryObs.trim() || null,
      }).eq('id', bl.id);
      if (error) throw error;

      toast({
        title: isPartial ? 'Livraison partielle' : 'Livraison complète',
        description: 'Le stock a été mis à jour. Le PDF de décharge est en cours de génération...',
      });
      setShowDeliveryDialog(false);

      // Auto-generate discharge PDF
      setTimeout(() => {
        const deliveredByName = user ? `${(user as any).first_name || ''} ${(user as any).last_name || ''}`.trim() || user.email || 'N/A' : 'N/A';
        exportBLToPDF({
          reference: bl.reference,
          status: newStatus,
          statusLabel: BL_STATUS_LABELS[newStatus],
          department: bl.department?.name || 'N/A',
          warehouse: bl.warehouse || undefined,
          blType: bl.bl_type === 'interne' ? 'Depuis stock' : 'Fournisseur externe',
          deliveryDate: bl.delivery_date || undefined,
          createdAt: bl.created_at,
          createdBy: bl.created_by_profile ? `${bl.created_by_profile.first_name || ''} ${bl.created_by_profile.last_name || ''}`.trim() : 'N/A',
          deliveredBy: deliveredByName,
          deliveredAt: new Date().toISOString(),
          validatedBy: bl.validated_daf_by_profile ? `${bl.validated_daf_by_profile.first_name || ''} ${bl.validated_daf_by_profile.last_name || ''}`.trim() : undefined,
          validatedAt: bl.validated_daf_at || bl.validated_at || undefined,
          besoinTitle: (bl.besoin as any)?.title || 'N/A',
          observations: bl.observations || undefined,
          articles: articles.map(art => {
            const da = deliveryArticles.find(d => d.id === art.id);
            return {
              designation: art.designation,
              quantityOrdered: art.quantity_ordered || art.quantity,
              quantityDelivered: da?.quantity_delivered || art.quantity_delivered || 0,
              unit: art.unit,
              ecartReason: da?.ecart_reason || art.ecart_reason || undefined,
            };
          }),
          receiverName: receiverName.trim(),
          signatureDataUrl: deliverySignature,
          deliveryObservations: deliveryObs.trim() || undefined,
        });
      }, 500);

      fetchBL();
      fetchArticles();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelBL = async (reason: string) => {
    if (!bl || !user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('bons_livraison').update({
        status: 'annulee',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancellation_reason: reason,
      }).eq('id', bl.id);
      if (error) throw error;
      toast({ title: 'BL annulé' });
      setShowCancelDialog(false);
      fetchBL();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateDAFromReliquat = async () => {
    if (!bl || !user || reliquatArticles.length === 0) return;
    setIsCreatingDA(true);
    try {
      const { data: besoinData, error: besoinError } = await supabase
        .from('besoins').select('id, title, department_id, desired_date, projet_id').eq('id', bl.besoin_id).single();
      if (besoinError || !besoinData) throw new Error('Besoin source introuvable');
      const { data: refData, error: refError } = await supabase.rpc('generate_da_reference');
      if (refError || !refData) throw new Error('Impossible de générer la référence DA');

      const reliquatItems = reliquatArticles.map((art) => ({
        designation: art.designation,
        quantity: (art.quantity_ordered || art.quantity) - (art.quantity_delivered || 0),
        unit: art.unit,
        observations: `Reliquat BL ${bl.reference}`,
      }));

      const daInsertData: any = {
        reference: refData,
        besoin_id: besoinData.id,
        department_id: besoinData.department_id,
        created_by: user.id,
        category: 'materiel',
        priority: 'normale',
        desired_date: besoinData.desired_date,
        projet_id: besoinData.projet_id,
        status: 'brouillon',
        description: `Reliquat BL ${bl.reference}`,
      };
      const { data: daData, error: daError } = await supabase.from('demandes_achat').insert(daInsertData).select().single();
      if (daError || !daData) throw daError || new Error('Impossible de créer la DA');

      await supabase.from('da_articles').insert(reliquatItems.map((item) => ({
        da_id: daData.id, ...item,
      })));

      toast({ title: 'DA créée pour le reliquat', description: `${refData} créée.` });
      setShowReliquatDialog(false);
      navigate(`/demandes-achat/${daData.id}`);
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsCreatingDA(false);
    }
  };

  const handleDelete = async () => {
    if (!bl) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('bons_livraison').delete().eq('id', bl.id);
      if (error) throw error;
      toast({ title: 'BL supprimé' });
      navigate('/bons-livraison');
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></AppLayout>;
  }
  if (!bl) return null;

  const StatusIcon = statusIcons[bl.status];

  const handleExportPDF = () => {
    exportBLToPDF({
      reference: bl.reference,
      status: bl.status,
      statusLabel: BL_STATUS_LABELS[bl.status],
      department: bl.department?.name || 'N/A',
      warehouse: bl.warehouse || undefined,
      blType: bl.bl_type === 'interne' ? 'Depuis stock' : 'Fournisseur externe',
      deliveryDate: bl.delivery_date || undefined,
      createdAt: bl.created_at,
      createdBy: bl.created_by_profile ? `${bl.created_by_profile.first_name || ''} ${bl.created_by_profile.last_name || ''}`.trim() : 'N/A',
      deliveredBy: bl.delivered_by_profile ? `${bl.delivered_by_profile.first_name || ''} ${bl.delivered_by_profile.last_name || ''}`.trim() : undefined,
      deliveredAt: bl.delivered_at || undefined,
      validatedBy: bl.validated_daf_by_profile ? `${bl.validated_daf_by_profile.first_name || ''} ${bl.validated_daf_by_profile.last_name || ''}`.trim() : bl.validated_by_profile ? `${bl.validated_by_profile.first_name || ''} ${bl.validated_by_profile.last_name || ''}`.trim() : undefined,
      validatedAt: bl.validated_daf_at || bl.validated_at || undefined,
      besoinTitle: (bl.besoin as any)?.title || 'N/A',
      besoinReference: undefined,
      observations: bl.observations || undefined,
      articles: articles.map(art => ({
        designation: art.designation,
        quantityOrdered: art.quantity_ordered || art.quantity,
        quantityDelivered: art.quantity_delivered || 0,
        unit: art.unit,
        ecartReason: art.ecart_reason || undefined,
      })),
    });
  };

  // Workflow steps for timeline
  const workflowSteps = [
    { label: 'Brouillon', done: true },
    { label: 'Soumis AAL', done: !['brouillon', 'prepare'].includes(bl.status) },
    { label: 'Soumis DAF', done: !['brouillon', 'prepare', 'soumis_aal'].includes(bl.status) && bl.status !== 'refuse_daf' },
    { label: 'Validé DAF', done: ['valide_daf', 'pret_a_livrer', 'livre', 'livree_partiellement', 'cloture'].includes(bl.status) },
    { label: 'Prêt à livrer', done: ['pret_a_livrer', 'livre', 'livree_partiellement', 'cloture'].includes(bl.status) },
    { label: 'Livré', done: ['livre', 'livree_partiellement', 'cloture'].includes(bl.status) },
  ];

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/bons-livraison">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-2xl font-bold text-foreground">{bl.reference}</h1>
                <Badge className={statusColors[bl.status]}>
                  <StatusIcon className="mr-1 h-3 w-3" />
                  {BL_STATUS_LABELS[bl.status]}
                </Badge>
                {['livre', 'cloture'].includes(bl.status) && <ReadOnlyBadge />}
              </div>
              <p className="text-muted-foreground">
                Créé le {format(new Date(bl.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <FileText className="mr-2 h-4 w-4" />Imprimer
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <Download className="mr-2 h-4 w-4" />PDF
            </Button>
            {isAdmin && !['annulee', 'cloture'].includes(bl.status) && ['livre', 'livree_partiellement', 'valide_daf', 'valide', 'pret_a_livrer'].includes(bl.status) && (
              <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setShowCancelDialog(true)}>
                <Ban className="mr-2 h-4 w-4" />Annuler
              </Button>
            )}
            {canDelete && ['brouillon', 'prepare'].includes(bl.status) && (
              <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="mr-2 h-4 w-4" />Supprimer
              </Button>
            )}
          </div>
        </div>

        {/* Workflow Progress */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-1">
              {workflowSteps.map((step, i) => (
                <div key={i} className="flex flex-1 items-center">
                  <div className={`flex flex-col items-center gap-1 ${step.done ? 'text-primary' : 'text-muted-foreground'}`}>
                    <div className={`h-3 w-3 rounded-full ${step.done ? 'bg-primary' : 'bg-muted'}`} />
                    <span className="text-[10px] text-center leading-tight">{step.label}</span>
                  </div>
                  {i < workflowSteps.length - 1 && (
                    <div className={`mx-1 h-0.5 flex-1 ${step.done ? 'bg-primary' : 'bg-muted'}`} />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Rejection reasons display */}
        {bl.status === 'refuse_daf' && bl.daf_rejection_reason && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="py-4">
              <p className="font-medium text-destructive">Refusé par le DAF</p>
              <p className="text-sm text-muted-foreground mt-1">{bl.daf_rejection_reason}</p>
            </CardContent>
          </Card>
        )}

        {bl.aal_rejection_reason && ['brouillon', 'prepare'].includes(bl.status) && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="py-4">
              <p className="font-medium text-warning">Retour AAL</p>
              <p className="text-sm text-muted-foreground mt-1">{bl.aal_rejection_reason}</p>
            </CardContent>
          </Card>
        )}

        {/* === ACTION CARDS === */}

        {/* Logistique: Soumettre à AAL */}
        {canSubmitToAAL && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">BL en brouillon</p>
                <p className="text-sm text-muted-foreground">Soumettez ce BL à l'AAL pour validation.</p>
              </div>
              <Button onClick={handleSubmitToAAL} disabled={isSaving}>
                <Send className="mr-2 h-4 w-4" />Soumettre à l'AAL
              </Button>
            </CardContent>
          </Card>
        )}

        {/* AAL: Valider ou Rejeter */}
        {canValidateAAL && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">Validation AAL requise</p>
                <p className="text-sm text-muted-foreground">Validez pour transmettre au DAF, ou rejetez avec motif.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => openRejectDialog('aal')} disabled={isSaving}>
                  <XCircle className="mr-2 h-4 w-4" />Rejeter
                </Button>
                <Button onClick={handleAALValidate} disabled={isSaving}>
                  <CheckCircle className="mr-2 h-4 w-4" />Valider AAL
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* DAF: Valider ou Refuser */}
        {canValidateDAF && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">Validation DAF requise</p>
                <p className="text-sm text-muted-foreground">Validez ce BL pour autoriser la livraison.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => openRejectDialog('daf')} disabled={isSaving}>
                  <XCircle className="mr-2 h-4 w-4" />Refuser
                </Button>
                <Button onClick={handleDAFValidate} disabled={isSaving}>
                  <ShieldCheck className="mr-2 h-4 w-4" />Valider DAF
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AAL: Resubmit after DAF refusal */}
        {canResubmitAfterRefuse && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">BL refusé par le DAF</p>
                <p className="text-sm text-muted-foreground">Corrigez et resoumetez au DAF, ou renvoyez à la logistique.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => updateStatus('brouillon')} disabled={isSaving}>
                  Renvoyer à la logistique
                </Button>
                <Button onClick={handleResubmitToDAF} disabled={isSaving}>
                  <Send className="mr-2 h-4 w-4" />Resoumettre au DAF
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Logistique: Marquer prêt à livrer */}
        {canMarkReady && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">Validé par le DAF ✓</p>
                <p className="text-sm text-muted-foreground">Marquez ce BL comme prêt à livrer/enlever.</p>
              </div>
              <Button onClick={handleMarkReady} disabled={isSaving}>
                <PackageCheck className="mr-2 h-4 w-4" />Marquer prêt à livrer
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Logistique: Livrer */}
        {canDeliver && (
          <Card className="border-success/50 bg-success/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">Prêt pour livraison / enlèvement</p>
                <p className="text-sm text-muted-foreground">
                  Confirmez la livraison. ⚠️ Le stock sera décrémenté automatiquement.
                </p>
              </div>
              <Button onClick={openDeliveryDialog} disabled={isSaving}>
                <Truck className="mr-2 h-4 w-4" />Enregistrer livraison
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Legacy: valide → deliver */}
        {canDeliverLegacy && (
          <Card className="border-success/50 bg-success/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">Prêt pour livraison</p>
                <p className="text-sm text-muted-foreground">Confirmez la livraison.</p>
              </div>
              <Button onClick={openDeliveryDialog} disabled={isSaving}>
                <PackageCheck className="mr-2 h-4 w-4" />Enregistrer livraison
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Clôturer */}
        {canClose && (
          <Card className="border-muted bg-muted/30">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">Livraison confirmée</p>
                <p className="text-sm text-muted-foreground">Clôturez ce BL pour archivage.</p>
              </div>
              <Button variant="outline" onClick={handleClose} disabled={isSaving}>
                <Lock className="mr-2 h-4 w-4" />Clôturer
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Reliquat */}
        {canCreateDAFromReliquat && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Livraison partielle - Reliquat
                </p>
                <p className="text-sm text-muted-foreground">
                  {reliquatArticles.length} article(s) non livré(s). Créez une DA pour le reliquat.
                </p>
              </div>
              <Button variant="outline" onClick={() => setShowReliquatDialog(true)} disabled={isCreatingDA} className="border-warning text-warning hover:bg-warning/10">
                <ShoppingCart className="mr-2 h-4 w-4" />Créer DA reliquat
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Besoin source */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5" />Besoin source</CardTitle></CardHeader>
          <CardContent>
            <Link to={`/besoins/${bl.besoin_id}`} className="flex items-center gap-2 text-primary hover:underline">
              {(bl.besoin as any)?.title || 'Voir le besoin'} <ExternalLink className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        {/* Details */}
        <Card>
          <CardHeader><CardTitle>Détails du bon</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="text-sm text-muted-foreground">Département</p><p className="font-medium">{bl.department?.name || 'N/A'}</p></div>
              <div><p className="text-sm text-muted-foreground">Créé par</p><p className="font-medium">{bl.created_by_profile?.first_name} {bl.created_by_profile?.last_name}</p></div>
              <div><p className="text-sm text-muted-foreground">Type</p><p className="font-medium">{bl.bl_type === 'interne' ? 'Interne (stock)' : 'Fournisseur'}</p></div>
              {bl.warehouse && <div><p className="text-sm text-muted-foreground">Lieu de livraison</p><p className="font-medium">{bl.warehouse}</p></div>}
              {bl.delivery_date && <div><p className="text-sm text-muted-foreground">Date prévue</p><p className="font-medium">{format(new Date(bl.delivery_date), 'dd MMMM yyyy', { locale: fr })}</p></div>}
            </div>
            {bl.observations && <div><p className="mb-2 text-sm text-muted-foreground">Observations</p><p className="whitespace-pre-wrap text-foreground">{bl.observations}</p></div>}

            {/* Validation timeline */}
            {bl.validated_aal_by_profile && (
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground">Validé AAL par</p>
                <p className="font-medium">
                  {bl.validated_aal_by_profile.first_name} {bl.validated_aal_by_profile.last_name}
                  {bl.validated_aal_at && <span className="ml-2 text-sm text-muted-foreground">le {format(new Date(bl.validated_aal_at), 'dd MMM yyyy', { locale: fr })}</span>}
                </p>
              </div>
            )}
            {bl.validated_daf_by_profile && (
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground">Validé DAF par</p>
                <p className="font-medium">
                  {bl.validated_daf_by_profile.first_name} {bl.validated_daf_by_profile.last_name}
                  {bl.validated_daf_at && <span className="ml-2 text-sm text-muted-foreground">le {format(new Date(bl.validated_daf_at), 'dd MMM yyyy', { locale: fr })}</span>}
                </p>
              </div>
            )}
            {bl.delivered_by_profile && (
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground">Livré par</p>
                <p className="font-medium">
                  {bl.delivered_by_profile.first_name} {bl.delivered_by_profile.last_name}
                  {bl.delivered_at && <span className="ml-2 text-sm text-muted-foreground">le {format(new Date(bl.delivered_at), 'dd MMM yyyy', { locale: fr })}</span>}
                </p>
              </div>
            )}

            {/* Receiver & Signature for delivered BLs */}
            {['livre', 'livree_partiellement', 'cloture'].includes(bl.status) && (bl as any).receiver_name && (
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm text-muted-foreground">Réceptionné par</p>
                <p className="font-medium">{(bl as any).receiver_name}</p>
                {(bl as any).delivery_observations && (
                  <div>
                    <p className="text-sm text-muted-foreground">Observations livraison</p>
                    <p className="text-sm">{(bl as any).delivery_observations}</p>
                  </div>
                )}
                {(bl as any).delivery_signature && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Signature de réception</p>
                    <img src={(bl as any).delivery_signature} alt="Signature" className="h-16 rounded border bg-background p-1" />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Articles */}
        <Card>
          <CardHeader><CardTitle>Articles ({articles.length})</CardTitle></CardHeader>
          <CardContent>
            {articles.length === 0 ? <p className="text-muted-foreground">Aucun article.</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Désignation</TableHead>
                    <TableHead className="text-right">Commandé</TableHead>
                    <TableHead className="text-right">Livré</TableHead>
                    <TableHead>Unité</TableHead>
                    <TableHead>Écart</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map((art) => {
                    const ordered = art.quantity_ordered || art.quantity;
                    const delivered = art.quantity_delivered || 0;
                    const hasEcart = delivered > 0 && delivered !== ordered;
                    return (
                      <TableRow key={art.id} className={hasEcart ? 'bg-warning/5' : undefined}>
                        <TableCell className="font-medium">{art.designation}</TableCell>
                        <TableCell className="text-right font-mono">{ordered}</TableCell>
                        <TableCell className="text-right font-mono">{delivered > 0 ? delivered : '-'}{hasEcart && <AlertTriangle className="ml-2 inline h-4 w-4 text-warning" />}</TableCell>
                        <TableCell>{art.unit}</TableCell>
                        <TableCell className="text-muted-foreground">{art.ecart_reason || art.observations || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce BL ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog (AAL or DAF) */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{rejectSource === 'aal' ? 'Rejeter le BL (AAL)' : 'Refuser le BL (DAF)'}</DialogTitle>
            <DialogDescription>
              {rejectSource === 'aal' ? 'Le BL sera renvoyé à la logistique pour correction.' : 'Le BL sera renvoyé à l\'AAL.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Label>Motif du {rejectSource === 'aal' ? 'rejet' : 'refus'} *</Label>
            <Textarea placeholder="Indiquez le motif..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Annuler</Button>
            <Button variant="destructive" onClick={rejectSource === 'aal' ? handleAALReject : handleDAFReject} disabled={isSaving || !rejectReason.trim()}>
              {isSaving ? 'En cours...' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery Dialog */}
      <Dialog open={showDeliveryDialog} onOpenChange={setShowDeliveryDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enregistrer la livraison</DialogTitle>
            <DialogDescription>⚠️ Le stock sera décrémenté automatiquement. La signature et le nom du réceptionnaire sont obligatoires.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            {/* Articles */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Articles</Label>
              {deliveryArticles.map((art, index) => (
                <div key={art.id} className="rounded-lg border p-4">
                  <p className="mb-3 font-medium">{art.designation}</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Quantité commandée</Label>
                      <Input value={art.quantity_ordered} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantité livrée</Label>
                      <Input type="number" min={0} max={art.quantity_ordered} value={art.quantity_delivered} onChange={(e) => {
                        const newArticles = [...deliveryArticles];
                        newArticles[index].quantity_delivered = Number(e.target.value);
                        setDeliveryArticles(newArticles);
                      }} />
                    </div>
                  </div>
                  {art.quantity_delivered < art.quantity_ordered && (
                    <div className="mt-3 space-y-2">
                      <Label className="flex items-center gap-2 text-warning"><AlertTriangle className="h-4 w-4" />Motif de l'écart</Label>
                      <Textarea placeholder="Expliquez..." value={art.ecart_reason} onChange={(e) => {
                        const newArticles = [...deliveryArticles];
                        newArticles[index].ecart_reason = e.target.value;
                        setDeliveryArticles(newArticles);
                      }} rows={2} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Observations livraison */}
            <div className="space-y-2">
              <Label>Observations de livraison (optionnel)</Label>
              <Textarea
                placeholder="Remarques sur la livraison..."
                value={deliveryObs}
                onChange={(e) => setDeliveryObs(e.target.value)}
                rows={2}
              />
            </div>

            {/* Réceptionnaire */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Réceptionnaire *</Label>
              <Input
                placeholder="Nom complet de la personne qui réceptionne"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
              />
            </div>

            {/* Signature */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Signature de réception *</Label>
              <SignaturePad onSignatureChange={setDeliverySignature} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeliveryDialog(false)}>Annuler</Button>
            <Button onClick={handleDelivery} disabled={isSaving || !receiverName.trim() || !deliverySignature}>
              {isSaving ? 'Enregistrement...' : 'Confirmer la livraison'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reliquat Dialog */}
      <Dialog open={showReliquatDialog} onOpenChange={setShowReliquatDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-warning" />Créer une DA pour le reliquat</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2 max-h-60 overflow-y-auto">
            {reliquatArticles.map((art) => {
              const reliquat = (art.quantity_ordered || art.quantity) - (art.quantity_delivered || 0);
              return (
                <div key={art.id} className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                  <span className="font-medium">{art.designation}</span>
                  <span className="text-sm text-muted-foreground"><span className="text-warning font-mono">{reliquat}</span> {art.unit}</span>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReliquatDialog(false)}>Annuler</Button>
            <Button onClick={handleCreateDAFromReliquat} disabled={isCreatingDA}>{isCreatingDA ? 'Création...' : 'Créer la DA'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CancelDialog open={showCancelDialog} onOpenChange={setShowCancelDialog} onConfirm={handleCancelBL} entityType="bl" isLoading={isSaving} />
    </AppLayout>
  );
}
