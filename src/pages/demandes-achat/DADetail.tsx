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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DemandeAchat,
  DAArticle,
  DA_STATUS_LABELS,
  DA_CATEGORY_LABELS,
  DA_PRIORITY_LABELS,
  DAStatus,
  LOGISTICS_ROLES,
  ACHATS_ROLES,
  Fournisseur,
  DAArticlePrice,
} from '@/types/kpm';
import {
  ArrowLeft,
  Clock,
  Send,
  XCircle,
  Trash2,
  FileText,
  ExternalLink,
  BarChart3,
  CheckCircle,
  FileCheck,
  Plus,
  Calculator,
  Building2,
  DollarSign,
  Ban,
  RotateCcw,
  ShieldCheck,
  Banknote,
  BookX,
  Download,
  Upload,
  Paperclip,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { exportDAToPDF } from '@/utils/pdfExport';
import { DATimeline } from '@/components/ui/DATimeline';

const statusColors: Record<DAStatus, string> = {
  brouillon: 'bg-muted text-muted-foreground',
  soumise: 'bg-primary/10 text-primary border-primary/20',
  en_analyse: 'bg-warning/10 text-warning border-warning/20',
  chiffree: 'bg-success/10 text-success border-success/20',
  soumise_validation: 'bg-accent/10 text-accent-foreground border-accent/20',
  validee_finance: 'bg-success text-success-foreground',
  refusee_finance: 'bg-destructive text-destructive-foreground',
  en_revision_achats: 'bg-warning text-warning-foreground',
  rejetee: 'bg-destructive/10 text-destructive border-destructive/20',
  payee: 'bg-success text-success-foreground',
  rejetee_comptabilite: 'bg-destructive text-destructive-foreground',
};

const statusIcons: Record<DAStatus, React.ElementType> = {
  brouillon: Clock,
  soumise: Send,
  en_analyse: BarChart3,
  chiffree: CheckCircle,
  soumise_validation: FileCheck,
  validee_finance: ShieldCheck,
  refusee_finance: Ban,
  en_revision_achats: RotateCcw,
  rejetee: XCircle,
  payee: Banknote,
  rejetee_comptabilite: BookX,
};

export default function DADetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, roles, isAdmin } = useAuth();
  const { toast } = useToast();

  const [da, setDA] = useState<DemandeAchat | null>(null);
  const [articles, setArticles] = useState<DAArticle[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [articlePrices, setArticlePrices] = useState<Record<string, DAArticlePrice[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [showFinanceRefuseDialog, setShowFinanceRefuseDialog] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [showValidateDialog, setShowValidateDialog] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [justification, setJustification] = useState('');
  const [financeComment, setFinanceComment] = useState('');
  const [revisionComment, setRevisionComment] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [priceForm, setPriceForm] = useState({
    fournisseur_id: '',
    unit_price: '',
    currency: 'XOF',
    delivery_delay: '',
    conditions: '',
  });

  const isLogistics = roles.some((r) => LOGISTICS_ROLES.includes(r));
  const isAchats = roles.some((r) => ACHATS_ROLES.includes(r));
  const isDG = roles.includes('dg');
  const isDAF = roles.includes('daf');
  const canValidateFinance = (isDG || isDAF || isAdmin) && da?.status === 'soumise_validation';

  const canSubmitToAchats = (isLogistics || isAdmin) && da?.status === 'brouillon';
  const canAnalyze = (isAchats || isAdmin) && da?.status === 'soumise';
  const canPrice = (isAchats || isAdmin) && ['soumise', 'en_analyse', 'en_revision_achats'].includes(da?.status || '');
  const canSubmitToValidation = (isAchats || isAdmin) && (da?.status === 'chiffree' || da?.status === 'en_revision_achats');
  const canReject = (isAchats || isAdmin) && ['soumise', 'en_analyse'].includes(da?.status || '');
  const canDelete = isAdmin;
  const canUploadAttachment = (isAchats || isAdmin) && ['en_analyse', 'chiffree', 'soumise_validation', 'en_revision_achats'].includes(da?.status || '');

  useEffect(() => {
    if (id) {
      fetchDA();
      fetchArticles();
      fetchFournisseurs();
    }
  }, [id]);

  const fetchDA = async () => {
    try {
      const { data, error } = await supabase
        .from('demandes_achat')
        .select(`
          *,
          department:departments(id, name),
          created_by_profile:profiles!demandes_achat_created_by_fkey(id, first_name, last_name, department:departments(name)),
          rejected_by_profile:profiles!demandes_achat_rejected_by_fkey(id, first_name, last_name, department:departments(name)),
          analyzed_by_profile:profiles!demandes_achat_analyzed_by_fkey(id, first_name, last_name, department:departments(name)),
          priced_by_profile:profiles!demandes_achat_priced_by_fkey(id, first_name, last_name, department:departments(name)),
          submitted_validation_by_profile:profiles!demandes_achat_submitted_validation_by_fkey(id, first_name, last_name, department:departments(name)),
          validated_finance_by_profile:profiles!demandes_achat_validated_finance_by_fkey(id, first_name, last_name, department:departments(name)),
          revision_requested_by_profile:profiles!demandes_achat_revision_requested_by_fkey(id, first_name, last_name, department:departments(name)),
          comptabilise_by_profile:profiles!demandes_achat_comptabilise_by_fkey(id, first_name, last_name, department:departments(name)),
          selected_fournisseur:fournisseurs(id, name, address, phone, email),
          besoin:besoins(id, title, user_id)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        toast({ title: 'Erreur', description: 'DA introuvable.', variant: 'destructive' });
        navigate('/demandes-achat');
        return;
      }

      // Fetch roles for each actor
      const actorIds = [
        data.created_by,
        data.rejected_by,
        data.analyzed_by,
        data.priced_by,
        data.submitted_validation_by,
        data.validated_finance_by,
        data.revision_requested_by,
        data.comptabilise_by,
      ].filter(Boolean);

      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', actorIds);

      const rolesByUser: Record<string, string[]> = {};
      (rolesData || []).forEach((r) => {
        if (!rolesByUser[r.user_id]) rolesByUser[r.user_id] = [];
        rolesByUser[r.user_id].push(r.role);
      });

      // Enrich DA with roles and department info for timeline
      const enrichedDA = {
        ...data,
        created_by_roles: rolesByUser[data.created_by] || [],
        created_by_department: (data.created_by_profile as any)?.department?.name,
        rejected_by_roles: data.rejected_by ? rolesByUser[data.rejected_by] || [] : [],
        rejected_by_department: (data.rejected_by_profile as any)?.department?.name,
        analyzed_by_roles: data.analyzed_by ? rolesByUser[data.analyzed_by] || [] : [],
        analyzed_by_department: (data.analyzed_by_profile as any)?.department?.name,
        priced_by_roles: data.priced_by ? rolesByUser[data.priced_by] || [] : [],
        priced_by_department: (data.priced_by_profile as any)?.department?.name,
        submitted_validation_by_roles: data.submitted_validation_by ? rolesByUser[data.submitted_validation_by] || [] : [],
        submitted_validation_by_department: (data.submitted_validation_by_profile as any)?.department?.name,
        validated_finance_by_roles: data.validated_finance_by ? rolesByUser[data.validated_finance_by] || [] : [],
        validated_finance_by_department: (data.validated_finance_by_profile as any)?.department?.name,
        revision_requested_by_roles: data.revision_requested_by ? rolesByUser[data.revision_requested_by] || [] : [],
        revision_requested_by_department: (data.revision_requested_by_profile as any)?.department?.name,
        comptabilise_by_roles: data.comptabilise_by ? rolesByUser[data.comptabilise_by] || [] : [],
        comptabilise_by_department: (data.comptabilise_by_profile as any)?.department?.name,
      };

      setDA(enrichedDA as unknown as DemandeAchat);
      setJustification(data.fournisseur_justification || '');
    } catch (error: any) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchArticles = async () => {
    const { data } = await supabase
      .from('da_articles')
      .select('*')
      .eq('da_id', id)
      .order('created_at');
    const arts = (data as DAArticle[]) || [];
    setArticles(arts);

    // Fetch prices for each article
    for (const art of arts) {
      fetchArticlePrices(art.id);
    }
  };

  const fetchArticlePrices = async (articleId: string) => {
    const { data } = await supabase
      .from('da_article_prices')
      .select('*, fournisseur:fournisseurs(id, name)')
      .eq('da_article_id', articleId)
      .order('created_at');
    setArticlePrices((prev) => ({ ...prev, [articleId]: (data as DAArticlePrice[]) || [] }));
  };

  const fetchFournisseurs = async () => {
    const { data } = await supabase
      .from('fournisseurs')
      .select('*')
      .eq('is_active', true)
      .order('name');
    setFournisseurs((data as Fournisseur[]) || []);
  };

  const handleTakeAnalysis = async () => {
    if (!da) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('demandes_achat')
        .update({
          status: 'en_analyse',
          analyzed_by: user?.id,
          analyzed_at: new Date().toISOString(),
        })
        .eq('id', da.id);
      if (error) throw error;
      toast({ title: 'DA prise en charge', description: 'Vous pouvez maintenant ajouter les prix.' });
      fetchDA();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitToAchats = async () => {
    if (!da) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('demandes_achat')
        .update({ status: 'soumise', submitted_at: new Date().toISOString() })
        .eq('id', da.id);
      if (error) throw error;
      toast({ title: 'DA soumise', description: 'La demande a été transmise au Service Achats.' });
      fetchDA();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddPrice = async () => {
    if (!selectedArticleId || !priceForm.fournisseur_id || !priceForm.unit_price) {
      toast({ title: 'Erreur', description: 'Fournisseur et prix requis.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('da_article_prices').insert({
        da_article_id: selectedArticleId,
        fournisseur_id: priceForm.fournisseur_id,
        unit_price: parseFloat(priceForm.unit_price),
        currency: priceForm.currency,
        delivery_delay: priceForm.delivery_delay || null,
        conditions: priceForm.conditions || null,
        created_by: user?.id,
      });
      if (error) throw error;
      toast({ title: 'Prix ajouté' });
      setShowPriceDialog(false);
      setPriceForm({ fournisseur_id: '', unit_price: '', currency: 'XOF', delivery_delay: '', conditions: '' });
      fetchArticlePrices(selectedArticleId);
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectPrice = async (priceId: string, articleId: string, fournisseurId: string) => {
    setIsSaving(true);
    try {
      // Deselect all prices for this article
      await supabase
        .from('da_article_prices')
        .update({ is_selected: false })
        .eq('da_article_id', articleId);
      // Select this price
      await supabase
        .from('da_article_prices')
        .update({ is_selected: true })
        .eq('id', priceId);
      
      fetchArticlePrices(articleId);
      toast({ title: 'Prix sélectionné' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const calculateTotal = (): number => {
    let total = 0;
    for (const art of articles) {
      const prices = articlePrices[art.id] || [];
      const selectedPrice = prices.find((p) => p.is_selected);
      if (selectedPrice) {
        total += selectedPrice.unit_price * art.quantity;
      }
    }
    return total;
  };

  const handleMarkAsChiffree = async () => {
    if (!da) return;
    const total = calculateTotal();
    if (total === 0) {
      toast({ title: 'Erreur', description: 'Aucun prix sélectionné.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      // Find selected fournisseur (most common one)
      const fournisseurCounts: Record<string, number> = {};
      for (const art of articles) {
        const prices = articlePrices[art.id] || [];
        const selectedPrice = prices.find((p) => p.is_selected);
        if (selectedPrice) {
          fournisseurCounts[selectedPrice.fournisseur_id] = (fournisseurCounts[selectedPrice.fournisseur_id] || 0) + 1;
        }
      }
      const topFournisseur = Object.entries(fournisseurCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

      const { error } = await supabase
        .from('demandes_achat')
        .update({
          status: 'chiffree',
          total_amount: total,
          currency: 'XOF',
          selected_fournisseur_id: topFournisseur || null,
          priced_by: user?.id,
          priced_at: new Date().toISOString(),
        })
        .eq('id', da.id);
      if (error) throw error;
      toast({ title: 'DA chiffrée', description: `Montant total: ${total.toLocaleString()} XOF` });
      fetchDA();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitToValidation = async () => {
    if (!da) return;
    if (fournisseurs.length > 1 && !justification.trim()) {
      toast({ title: 'Erreur', description: 'Justification du choix de fournisseur requise.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('demandes_achat')
        .update({
          status: 'soumise_validation',
          fournisseur_justification: justification.trim() || null,
          submitted_validation_by: user?.id,
          submitted_validation_at: new Date().toISOString(),
        })
        .eq('id', da.id);
      if (error) throw error;
      toast({ title: 'DA soumise à validation', description: 'Le DAF et DG ont été notifiés.' });
      fetchDA();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!da || !rejectionReason.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('demandes_achat')
        .update({
          status: 'rejetee',
          rejection_reason: rejectionReason.trim(),
          rejected_by: user?.id,
          rejected_at: new Date().toISOString(),
        })
        .eq('id', da.id);
      if (error) throw error;
      toast({ title: 'DA rejetée' });
      setShowRejectDialog(false);
      fetchDA();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // === VALIDATION FINANCIÈRE ===
  const handleValidateFinance = async () => {
    if (!da) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('demandes_achat')
        .update({
          status: 'validee_finance',
          validated_finance_by: user?.id,
          validated_finance_at: new Date().toISOString(),
          finance_decision_comment: financeComment.trim() || null,
        })
        .eq('id', da.id);
      if (error) throw error;
      toast({ title: 'DA validée financièrement', description: 'La Comptabilité a été notifiée.' });
      setShowValidateDialog(false);
      setFinanceComment('');
      fetchDA();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefuseFinance = async () => {
    if (!da || !financeComment.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('demandes_achat')
        .update({
          status: 'refusee_finance',
          validated_finance_by: user?.id,
          validated_finance_at: new Date().toISOString(),
          finance_decision_comment: financeComment.trim(),
        })
        .eq('id', da.id);
      if (error) throw error;
      toast({ title: 'DA refusée', description: 'Les parties concernées ont été notifiées.' });
      setShowFinanceRefuseDialog(false);
      setFinanceComment('');
      fetchDA();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!da || !revisionComment.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('demandes_achat')
        .update({
          status: 'en_revision_achats',
          revision_requested_by: user?.id,
          revision_requested_at: new Date().toISOString(),
          revision_comment: revisionComment.trim(),
        })
        .eq('id', da.id);
      if (error) throw error;
      toast({ title: 'Révision demandée', description: 'Le Service Achats a été notifié.' });
      setShowRevisionDialog(false);
      setRevisionComment('');
      fetchDA();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!da) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('demandes_achat').delete().eq('id', da.id);
      if (error) throw error;
      toast({ title: 'DA supprimée' });
      navigate('/demandes-achat');
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!da || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'Erreur', description: 'Format non supporté. Utilisez PDF ou image.', variant: 'destructive' });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Erreur', description: 'Fichier trop volumineux (max 5 Mo).', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${da.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('da-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('da-attachments')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('demandes_achat')
        .update({
          attachment_url: urlData.publicUrl,
          attachment_name: file.name,
        })
        .eq('id', da.id);

      if (updateError) throw updateError;

      toast({ title: 'Pièce jointe ajoutée', description: file.name });
      fetchDA();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = async () => {
    if (!da || !da.attachment_url) return;
    setIsUploading(true);
    try {
      // Extract file path from URL
      const url = new URL(da.attachment_url);
      const pathParts = url.pathname.split('/da-attachments/');
      if (pathParts.length > 1) {
        await supabase.storage.from('da-attachments').remove([pathParts[1]]);
      }

      const { error } = await supabase
        .from('demandes_achat')
        .update({ attachment_url: null, attachment_name: null })
        .eq('id', da.id);

      if (error) throw error;
      toast({ title: 'Pièce jointe supprimée' });
      fetchDA();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
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

  if (!da) return null;

  const StatusIcon = statusIcons[da.status];
  const total = calculateTotal();

  const handleExportPDF = () => {
    const articlesWithPrices = articles.map(art => {
      const prices = articlePrices[art.id] || [];
      const selectedPrice = prices.find(p => p.is_selected);
      return {
        designation: art.designation,
        quantity: art.quantity,
        unit: art.unit,
        unitPrice: selectedPrice?.unit_price,
        total: selectedPrice ? selectedPrice.unit_price * art.quantity : undefined,
      };
    });

    exportDAToPDF({
      reference: da.reference,
      status: da.status,
      statusLabel: DA_STATUS_LABELS[da.status],
      department: da.department?.name || 'N/A',
      category: DA_CATEGORY_LABELS[da.category],
      priority: DA_PRIORITY_LABELS[da.priority],
      description: da.description,
      createdAt: da.created_at,
      createdBy: da.created_by_profile 
        ? `${da.created_by_profile.first_name || ''} ${da.created_by_profile.last_name || ''}`.trim() 
        : 'N/A',
      desiredDate: da.desired_date || undefined,
      totalAmount: da.total_amount,
      currency: da.currency || 'XOF',
      fournisseur: da.selected_fournisseur?.name,
      fournisseurAddress: da.selected_fournisseur?.address || undefined,
      fournisseurPhone: da.selected_fournisseur?.phone || undefined,
      fournisseurEmail: da.selected_fournisseur?.email || undefined,
      justification: da.fournisseur_justification || undefined,
      analyzedBy: da.analyzed_by_profile ? `${da.analyzed_by_profile.first_name || ''} ${da.analyzed_by_profile.last_name || ''}`.trim() : undefined,
      analyzedAt: da.analyzed_at || undefined,
      pricedBy: da.priced_by_profile ? `${da.priced_by_profile.first_name || ''} ${da.priced_by_profile.last_name || ''}`.trim() : undefined,
      pricedAt: da.priced_at || undefined,
      validatedFinanceBy: da.validated_finance_by_profile ? `${da.validated_finance_by_profile.first_name || ''} ${da.validated_finance_by_profile.last_name || ''}`.trim() : undefined,
      validatedFinanceAt: da.validated_finance_at || undefined,
      comptabiliseBy: da.comptabilise_by_profile ? `${da.comptabilise_by_profile.first_name || ''} ${da.comptabilise_by_profile.last_name || ''}`.trim() : undefined,
      comptabiliseAt: da.comptabilise_at || undefined,
      articles: articlesWithPrices,
    });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/demandes-achat">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-2xl font-bold text-foreground">{da.reference}</h1>
                <Badge className={statusColors[da.status]}>
                  <StatusIcon className="mr-1 h-3 w-3" />
                  {DA_STATUS_LABELS[da.status]}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Créée le {format(new Date(da.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
            >
              <Download className="mr-2 h-4 w-4" />
              Exporter PDF
            </Button>
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

        {/* Bannière lecture seule pour DAF/DG hors validation */}
        {(isDAF || isDG) && !isAdmin && !canValidateFinance && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center gap-3 py-4">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium text-foreground">Mode lecture seule</p>
                <p className="text-sm text-muted-foreground">
                  Vous consultez cette DA en tant que {isDAF ? 'DAF' : 'DG'}. 
                  {da.status === 'soumise_validation' 
                    ? ' Vous pouvez valider ou refuser cette demande.'
                    : ' Les actions de validation ne sont disponibles qu\'au statut "Soumise à validation".'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rejection reason */}
        {da.status === 'rejetee' && da.rejection_reason && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-start gap-3 py-4">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Motif du rejet</p>
                <p className="text-sm text-foreground">{da.rejection_reason}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info banner: document administratif */}
        {['soumise', 'en_analyse'].includes(da.status) && (
          <Card className="border-warning/20 bg-warning/5">
            <CardContent className="flex items-start gap-3 py-4">
              <Calculator className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div>
                <p className="font-medium text-foreground">Document en cours de qualification</p>
                <p className="text-sm text-muted-foreground">
                  Cette DA n'est pas encore validée financièrement. Les prix sont en cours d'analyse.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions: Logistique soumet aux Achats */}
        {canSubmitToAchats && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">Prêt à soumettre</p>
                <p className="text-sm text-muted-foreground">Cette DA sera transmise au Service Achats.</p>
              </div>
              <Button onClick={handleSubmitToAchats} disabled={isSaving}>
                <Send className="mr-2 h-4 w-4" />
                Soumettre aux Achats
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Actions: Achats prend en charge */}
        {canAnalyze && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">DA en attente d'analyse</p>
                <p className="text-sm text-muted-foreground">Prenez cette DA en charge pour commencer l'analyse.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => setShowRejectDialog(true)}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Rejeter
                </Button>
                <Button onClick={handleTakeAnalysis} disabled={isSaving}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Prendre en charge
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions: Achats marque comme chiffrée */}
        {da.status === 'en_analyse' && canPrice && (
          <Card className="border-success/50 bg-success/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">Prêt à chiffrer ?</p>
                <p className="text-sm text-muted-foreground">
                  Sélectionnez un prix par article puis validez. Total actuel: {total.toLocaleString()} XOF
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => setShowRejectDialog(true)}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Rejeter
                </Button>
                <Button onClick={handleMarkAsChiffree} disabled={isSaving || total === 0}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Valider chiffrage
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions: Submit to validation */}
        {canSubmitToValidation && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="space-y-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-foreground">DA chiffrée: {da.total_amount?.toLocaleString()} {da.currency}</p>
                  <p className="text-sm text-muted-foreground">Soumettez à validation financière (DAF/DG).</p>
                </div>
                <Button onClick={handleSubmitToValidation} disabled={isSaving}>
                  <FileCheck className="mr-2 h-4 w-4" />
                  Soumettre à validation
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Justification du choix de fournisseur</Label>
                <Textarea
                  placeholder="Expliquez pourquoi ce(s) fournisseur(s) ont été retenus..."
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* PANNEAU VALIDATION FINANCIÈRE (DAF/DG) */}
        {canValidateFinance && (
          <Card className="border-2 border-primary bg-gradient-to-r from-primary/5 to-accent/5">
            <CardContent className="space-y-4 py-6">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-lg font-bold text-foreground">Validation Financière Requise</p>
                  <p className="text-sm text-muted-foreground">
                    Cette décision engage la responsabilité financière de l'entreprise.
                  </p>
                </div>
              </div>

              {/* Récapitulatif */}
              <div className="rounded-lg border bg-card p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Montant total</p>
                    <p className="text-xl font-bold text-foreground">
                      {da.total_amount?.toLocaleString()} {da.currency}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fournisseur</p>
                    <p className="font-medium">{(da.selected_fournisseur as Fournisseur)?.name || 'Multiple'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Priorité</p>
                    <Badge className={da.priority === 'urgente' ? 'bg-destructive/10 text-destructive' : da.priority === 'haute' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'}>
                      {DA_PRIORITY_LABELS[da.priority]}
                    </Badge>
                  </div>
                </div>
                {da.fournisseur_justification && (
                  <div className="mt-3 border-t pt-3">
                    <p className="text-xs text-muted-foreground">Justification Achats</p>
                    <p className="text-sm">{da.fournisseur_justification}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={() => setShowValidateDialog(true)} 
                  className="bg-success hover:bg-success/90"
                  disabled={isSaving}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Valider financièrement
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowRevisionDialog(true)}
                  disabled={isSaving}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Demander révision
                </Button>
                <Button 
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setShowFinanceRefuseDialog(true)}
                  disabled={isSaving}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Refuser
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bannière si validée financièrement */}
        {da.status === 'validee_finance' && (
          <Card className="border-success bg-success/10">
            <CardContent className="flex items-center gap-3 py-4">
              <ShieldCheck className="h-6 w-6 text-success" />
              <div>
                <p className="font-bold text-success">Validée financièrement</p>
                <p className="text-sm text-foreground">
                  Cette DA est autorisée et transmise à la Comptabilité.
                  {da.finance_decision_comment && ` — ${da.finance_decision_comment}`}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bannière si refusée financièrement */}
        {da.status === 'refusee_finance' && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="flex items-center gap-3 py-4">
              <Ban className="h-6 w-6 text-destructive" />
              <div>
                <p className="font-bold text-destructive">Refusée par la Direction</p>
                <p className="text-sm text-foreground">
                  {da.finance_decision_comment || 'Aucun motif spécifié.'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bannière si en révision Achats */}
        {da.status === 'en_revision_achats' && (
          <Card className="border-warning bg-warning/10">
            <CardContent className="flex items-center gap-3 py-4">
              <RotateCcw className="h-6 w-6 text-warning" />
              <div>
                <p className="font-bold text-warning">Révision demandée</p>
                <p className="text-sm text-foreground">
                  {da.revision_comment || 'La Direction demande une révision de cette DA.'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Total if priced */}
        {da.total_amount && !['validee_finance', 'refusee_finance'].includes(da.status) && (
          <Card className="border-success/50 bg-success/5">
            <CardContent className="flex items-center gap-3 py-4">
              <DollarSign className="h-6 w-6 text-success" />
              <div>
                <p className="text-lg font-bold text-foreground">
                  {da.total_amount.toLocaleString()} {da.currency}
                </p>
                <p className="text-sm text-muted-foreground">Montant total estimé</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Besoin source */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              Besoin source
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link to={`/besoins/${da.besoin_id}`} className="flex items-center gap-2 text-primary hover:underline">
              {(da.besoin as any)?.title || 'Voir le besoin'}
              <ExternalLink className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle>Détails de la demande</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Département</p>
                <p className="font-medium">{da.department?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Créée par</p>
                <p className="font-medium">
                  {da.created_by_profile?.first_name} {da.created_by_profile?.last_name}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Catégorie</p>
                <Badge variant="outline">{DA_CATEGORY_LABELS[da.category]}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Priorité</p>
                <Badge className={da.priority === 'urgente' ? 'bg-destructive/10 text-destructive' : da.priority === 'haute' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'}>
                  {DA_PRIORITY_LABELS[da.priority]}
                </Badge>
              </div>
              {da.desired_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Date souhaitée</p>
                  <p className="font-medium">{format(new Date(da.desired_date), 'dd MMMM yyyy', { locale: fr })}</p>
                </div>
              )}
              {da.selected_fournisseur && (
                <div>
                  <p className="text-sm text-muted-foreground">Fournisseur retenu</p>
                  <p className="flex items-center gap-2 font-medium">
                    <Building2 className="h-4 w-4" />
                    {(da.selected_fournisseur as Fournisseur).name}
                  </p>
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm text-muted-foreground">Description</p>
              <p className="whitespace-pre-wrap text-foreground">{da.description}</p>
            </div>

            {da.observations && (
              <div>
                <p className="mb-2 text-sm text-muted-foreground">Observations techniques</p>
                <p className="whitespace-pre-wrap text-foreground">{da.observations}</p>
              </div>
            )}

            {da.fournisseur_justification && (
              <div className="border-t pt-4">
                <p className="mb-2 text-sm text-muted-foreground">Justification fournisseur</p>
                <p className="whitespace-pre-wrap text-foreground">{da.fournisseur_justification}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pièces jointes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Paperclip className="h-5 w-5" />
              Pièces jointes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {da.attachment_url ? (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{da.attachment_name || 'Pièce jointe'}</p>
                    <a 
                      href={da.attachment_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Télécharger
                    </a>
                  </div>
                </div>
                {canUploadAttachment && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-destructive hover:bg-destructive/10"
                    onClick={handleRemoveAttachment}
                    disabled={isUploading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">Aucune pièce jointe.</p>
            )}

            {canUploadAttachment && !da.attachment_url && (
              <div className="flex items-center gap-4">
                <label className="cursor-pointer">
                  <input 
                    type="file" 
                    className="hidden" 
                    accept=".pdf,.jpg,.jpeg,.png,.gif"
                    onChange={handleUploadAttachment}
                    disabled={isUploading}
                  />
                  <Button variant="outline" asChild disabled={isUploading}>
                    <span>
                      <Upload className="mr-2 h-4 w-4" />
                      {isUploading ? 'Envoi...' : 'Ajouter une pièce jointe'}
                    </span>
                  </Button>
                </label>
                <p className="text-xs text-muted-foreground">PDF ou image (max 5 Mo)</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline des actions */}
        <DATimeline da={da as any} />

        {/* Articles with prices */}
        <Card>
          <CardHeader>
            <CardTitle>Articles / Services ({articles.length})</CardTitle>
            <CardDescription>
              {canPrice ? 'Cliquez sur un article pour ajouter des prix fournisseurs.' : 'Liste des articles demandés.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {articles.length === 0 ? (
              <p className="text-muted-foreground">Aucun article.</p>
            ) : (
              articles.map((art) => {
                const prices = articlePrices[art.id] || [];
                const selectedPrice = prices.find((p) => p.is_selected);
                return (
                  <div key={art.id} className="rounded-lg border p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <p className="font-medium">{art.designation}</p>
                        <p className="text-sm text-muted-foreground">
                          {art.quantity} {art.unit}
                          {selectedPrice && (
                            <span className="ml-2 text-success">
                              → {(selectedPrice.unit_price * art.quantity).toLocaleString()} {selectedPrice.currency}
                            </span>
                          )}
                        </p>
                      </div>
                      {canPrice && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setSelectedArticleId(art.id); setShowPriceDialog(true); }}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Prix
                        </Button>
                      )}
                    </div>
                    {prices.length > 0 && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fournisseur</TableHead>
                            <TableHead className="text-right">Prix unitaire</TableHead>
                            <TableHead className="text-right">Total ligne</TableHead>
                            <TableHead>Délai</TableHead>
                            {canPrice && <TableHead className="text-right">Sélection</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {prices.map((price) => (
                            <TableRow key={price.id} className={price.is_selected ? 'bg-success/5' : ''}>
                              <TableCell className="font-medium">
                                {(price.fournisseur as Fournisseur)?.name || 'N/A'}
                              </TableCell>
                              <TableCell className="text-right">
                                {price.unit_price.toLocaleString()} {price.currency}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {(price.unit_price * art.quantity).toLocaleString()} {price.currency}
                              </TableCell>
                              <TableCell>{price.delivery_delay || '-'}</TableCell>
                              {canPrice && (
                                <TableCell className="text-right">
                                  {price.is_selected ? (
                                    <Badge className="bg-success/10 text-success">Retenu</Badge>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleSelectPrice(price.id, art.id, price.fournisseur_id)}
                                      disabled={isSaving}
                                    >
                                      Sélectionner
                                    </Button>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Price Dialog */}
      <Dialog open={showPriceDialog} onOpenChange={setShowPriceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un prix fournisseur</DialogTitle>
            <DialogDescription>Renseignez le prix proposé par un fournisseur.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Fournisseur *</Label>
              <Select value={priceForm.fournisseur_id} onValueChange={(v) => setPriceForm({ ...priceForm, fournisseur_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un fournisseur" />
                </SelectTrigger>
                <SelectContent>
                  {fournisseurs.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Prix unitaire *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceForm.unit_price}
                  onChange={(e) => setPriceForm({ ...priceForm, unit_price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Devise</Label>
                <Select value={priceForm.currency} onValueChange={(v) => setPriceForm({ ...priceForm, currency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XOF">XOF (FCFA)</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Délai de livraison</Label>
              <Input
                placeholder="Ex: 5 jours ouvrés"
                value={priceForm.delivery_delay}
                onChange={(e) => setPriceForm({ ...priceForm, delivery_delay: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Conditions</Label>
              <Textarea
                placeholder="Conditions particulières..."
                value={priceForm.conditions}
                onChange={(e) => setPriceForm({ ...priceForm, conditions: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPriceDialog(false)}>Annuler</Button>
            <Button onClick={handleAddPrice} disabled={isSaving}>
              {isSaving ? 'Ajout...' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter cette DA</DialogTitle>
            <DialogDescription>Indiquez le motif du rejet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motif du rejet *</Label>
            <Textarea
              placeholder="Expliquez pourquoi cette DA est rejetée..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectionReason.trim() || isSaving}>
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finance Validate Dialog */}
      <AlertDialog open={showValidateDialog} onOpenChange={setShowValidateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-success" />
              Valider financièrement cette DA ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette décision engage la responsabilité financière de l'entreprise. 
              La DA sera transmise à la Comptabilité pour traitement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground">Montant autorisé</p>
              <p className="text-xl font-bold">{da?.total_amount?.toLocaleString()} {da?.currency}</p>
            </div>
            <div className="space-y-2">
              <Label>Commentaire (optionnel)</Label>
              <Textarea
                placeholder="Ajouter un commentaire de validation..."
                value={financeComment}
                onChange={(e) => setFinanceComment(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleValidateFinance} 
              className="bg-success text-success-foreground hover:bg-success/90"
              disabled={isSaving}
            >
              Confirmer la validation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Finance Refuse Dialog */}
      <Dialog open={showFinanceRefuseDialog} onOpenChange={setShowFinanceRefuseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" />
              Refuser cette DA
            </DialogTitle>
            <DialogDescription>
              Cette action bloque définitivement la demande. Le motif sera communiqué aux parties concernées.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>Motif du refus *</Label>
            <Textarea
              placeholder="Expliquez pourquoi cette DA est refusée..."
              value={financeComment}
              onChange={(e) => setFinanceComment(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinanceRefuseDialog(false)}>Annuler</Button>
            <Button 
              variant="destructive" 
              onClick={handleRefuseFinance} 
              disabled={!financeComment.trim() || isSaving}
            >
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revision Dialog */}
      <Dialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-warning" />
              Demander une révision
            </DialogTitle>
            <DialogDescription>
              La DA sera renvoyée au Service Achats pour révision. Expliquez ce qui doit être modifié.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>Commentaire de révision *</Label>
            <Textarea
              placeholder="Indiquez les éléments à réviser (prix, fournisseur, justification...)..."
              value={revisionComment}
              onChange={(e) => setRevisionComment(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevisionDialog(false)}>Annuler</Button>
            <Button 
              onClick={handleRequestRevision} 
              disabled={!revisionComment.trim() || isSaving}
            >
              Demander la révision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette DA ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
