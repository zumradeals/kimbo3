import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { NoteFrais, NoteFraisLigne, NoteFraisStatus, NOTE_FRAIS_STATUS_LABELS, PaymentMethod, SYSCOHADA_CLASSES } from '@/types/kpm';
import { UserBadge } from '@/components/ui/UserBadge';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  Wallet,
  FileCheck,
  User,
  Calendar,
  FolderKanban,
  FileText,
  Edit,
  Trash2,
  Building2,
} from 'lucide-react';
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
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { exportDechargeComptableToPDF } from '@/utils/pdfExport';
import { PaymentFormDynamic } from '@/components/comptabilite/PaymentFormDynamic';
import { CompteComptableAutocomplete } from '@/components/ui/CompteComptableAutocomplete';
import { CorrectionCaisseDialog } from '@/components/caisse/CorrectionCaisseDialog';

const statusColors: Record<NoteFraisStatus, string> = {
  brouillon: 'bg-muted text-muted-foreground',
  soumise: 'bg-warning/10 text-warning border-warning/20',
  validee_daf: 'bg-primary/10 text-primary border-primary/20',
  payee: 'bg-success/10 text-success border-success/20',
  rejetee: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusIcons: Record<NoteFraisStatus, React.ElementType> = {
  brouillon: Clock,
  soumise: FileCheck,
  validee_daf: CheckCircle,
  payee: Wallet,
  rejetee: XCircle,
};

interface NoteFraisWithRelations extends NoteFrais {
  lignes?: NoteFraisLigne[];
}

interface Caisse {
  id: string;
  code: string;
  name: string;
  solde_actuel: number;
  devise: string;
}

export default function NoteFraisDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, roles, isAdmin } = useAuth();
  const { toast } = useToast();

  const [note, setNote] = useState<NoteFraisWithRelations | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [caisses, setCaisses] = useState<Caisse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // SYSCOHADA form state
  const [syscohadaData, setSyscohadaData] = useState({
    classe: 0,
    compte: '',
    nature_charge: '',
    centre_cout: '',
  });

  // Payment form state (compatible with PaymentFormDynamic)
  const [paymentFormData, setPaymentFormData] = useState<{
    category_id: string;
    method_id: string;
    details: Record<string, string>;
    caisse_id?: string;
    payment_class?: 'REGLEMENT' | 'DEPENSE';
  }>({
    category_id: '',
    method_id: '',
    details: {},
    caisse_id: undefined,
    payment_class: 'REGLEMENT',
  });

  // Additional payment fields
  const [referencePaiement, setReferencePaiement] = useState('');

  const isDAF = roles.includes('daf');
  const isComptable = roles.includes('comptable');
  const isDG = roles.includes('dg');
  const isCreator = note?.user_id === user?.id;

  useEffect(() => {
    if (id) {
      fetchNote();
      fetchPaymentMethods();
      fetchCaisses();
    }
  }, [id]);

  const fetchNote = async () => {
    try {
      const { data, error } = await supabase
        .from('notes_frais')
        .select(`
          *,
          user:profiles!notes_frais_user_id_fkey(id, first_name, last_name, email, photo_url, fonction),
          department:departments(id, name),
          projet:projets(id, code, name),
          validated_daf_by_profile:profiles!notes_frais_validated_daf_by_fkey(id, first_name, last_name, photo_url, fonction),
          paid_by_profile:profiles!notes_frais_paid_by_fkey(id, first_name, last_name, photo_url, fonction),
          rejected_by_profile:profiles!notes_frais_rejected_by_fkey(id, first_name, last_name, photo_url, fonction)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        toast({ title: 'Erreur', description: 'Note de frais introuvable.', variant: 'destructive' });
        navigate('/notes-frais');
        return;
      }

      // Fetch lignes
      const { data: lignesData } = await supabase
        .from('note_frais_lignes')
        .select('*, projet:projets(id, code, name)')
        .eq('note_frais_id', id)
        .order('date_depense');

      // Load existing SYSCOHADA data if present
      const noteData = data as any;
      if (noteData.syscohada_classe) {
        setSyscohadaData({
          classe: noteData.syscohada_classe || 0,
          compte: noteData.syscohada_compte || '',
          nature_charge: noteData.syscohada_nature_charge || '',
          centre_cout: noteData.syscohada_centre_cout || '',
        });
      }

      setNote({
        ...data,
        lignes: lignesData || [],
      } as unknown as NoteFraisWithRelations);
    } catch (error: any) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPaymentMethods = async () => {
    const { data } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    setPaymentMethods((data as PaymentMethod[]) || []);
  };

  const fetchCaisses = async () => {
    const { data } = await supabase
      .from('caisses')
      .select('id, code, name, solde_actuel, devise')
      .eq('is_active', true)
      .order('name');
    setCaisses((data as Caisse[]) || []);
  };

  const handleSubmit = async () => {
    if (!note) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('notes_frais')
        .update({
          status: 'soumise',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', note.id);

      if (error) throw error;

      toast({ title: 'Note soumise', description: 'Votre note de frais a été soumise pour validation.' });
      fetchNote();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidateDAF = async () => {
    if (!note) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('notes_frais')
        .update({
          status: 'validee_daf',
          validated_daf_by: user?.id,
          validated_daf_at: new Date().toISOString(),
        })
        .eq('id', note.id);

      if (error) throw error;

      toast({ title: 'Note validée', description: 'La note de frais a été validée.' });
      fetchNote();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!note || !rejectionReason.trim()) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('notes_frais')
        .update({
          status: 'rejetee',
          rejection_reason: rejectionReason.trim(),
          rejected_by: user?.id,
          rejected_at: new Date().toISOString(),
        })
        .eq('id', note.id);

      if (error) throw error;

      toast({ title: 'Note rejetée', description: 'La note de frais a été rejetée.' });
      setShowRejectDialog(false);
      fetchNote();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const validateForms = () => {
    // Validate SYSCOHADA
    if (!syscohadaData.classe || !syscohadaData.compte || !syscohadaData.nature_charge) {
      toast({
        title: 'Champs manquants',
        description: 'Veuillez remplir tous les champs SYSCOHADA obligatoires.',
        variant: 'destructive',
      });
      return false;
    }
    // Validate payment
    if (!paymentFormData.category_id || !paymentFormData.method_id) {
      toast({
        title: 'Champs manquants',
        description: 'Veuillez sélectionner une catégorie et un mode de paiement.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const handlePay = async () => {
    if (!note || !user) return;
    if (!validateForms()) return;

    setIsSaving(true);

    try {
      // Get payment method details
      const selectedMethod = paymentMethods.find((m) => m.id === paymentFormData.method_id);

      // Build payment details JSON
      const paymentDetailsJson: Record<string, string> = {
        ...paymentFormData.details,
        category_id: paymentFormData.category_id,
        method_id: paymentFormData.method_id,
      };
      if (paymentFormData.caisse_id) {
        paymentDetailsJson.caisse_id = paymentFormData.caisse_id;
        // We'll fetch caisse info for the PDF later
        const { data: caisseData } = await supabase
          .from('caisses')
          .select('name, code')
          .eq('id', paymentFormData.caisse_id)
          .single();
        if (caisseData) {
          paymentDetailsJson.caisse_name = caisseData.name;
          paymentDetailsJson.caisse_code = caisseData.code;
        }
      }

      // Update note with SYSCOHADA + payment info
      const { error: noteError } = await supabase
        .from('notes_frais')
        .update({
          status: 'payee',
          syscohada_classe: syscohadaData.classe,
          syscohada_compte: syscohadaData.compte,
          syscohada_nature_charge: syscohadaData.nature_charge,
          syscohada_centre_cout: syscohadaData.centre_cout || null,
          caisse_id: paymentFormData.caisse_id || null,
          mode_paiement: selectedMethod?.label || null,
          reference_paiement: referencePaiement || null,
          payment_category_id: paymentFormData.category_id,
          payment_method_id: paymentFormData.method_id,
          payment_details: paymentDetailsJson,
          payment_class: paymentFormData.payment_class || 'REGLEMENT',
          paid_by: user.id,
          paid_at: new Date().toISOString(),
          comptabilise_by: user.id,
          comptabilise_at: new Date().toISOString(),
        })
        .eq('id', note.id);

      if (noteError) throw noteError;

      // Generate accounting entry reference
      const { data: refData } = await supabase.rpc('generate_ecriture_reference');
      const ecritureRef = refData || `EC-NDF-${note.reference}`;

      // Create accounting entry
      const { error: ecritureError } = await supabase.from('ecritures_comptables').insert({
        note_frais_id: note.id,
        reference: ecritureRef,
        libelle: `Remboursement frais: ${note.title}`,
        classe_syscohada: syscohadaData.classe,
        compte_comptable: syscohadaData.compte,
        nature_charge: syscohadaData.nature_charge,
        centre_cout: syscohadaData.centre_cout || null,
        debit: note.total_amount || 0,
        credit: 0,
        devise: note.currency || 'XOF',
        mode_paiement: selectedMethod?.label || null,
        reference_paiement: referencePaiement || null,
        date_ecriture: new Date().toISOString(),
        created_by: user.id,
        is_validated: true,
        validated_by: user.id,
        validated_at: new Date().toISOString(),
      });

      if (ecritureError) {
        console.error('Erreur écriture comptable:', ecritureError);
        // Non-blocking - continue even if accounting entry fails
      }

      toast({ title: 'Paiement effectué', description: 'La note de frais a été payée et comptabilisée.' });
      setShowPayDialog(false);
      fetchNote();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!note) return;
    setIsSaving(true);

    try {
      // Delete lignes first
      const { error: lignesError } = await supabase
        .from('note_frais_lignes')
        .delete()
        .eq('note_frais_id', note.id);

      if (lignesError) throw lignesError;

      // Delete note
      const { error } = await supabase
        .from('notes_frais')
        .delete()
        .eq('id', note.id);

      if (error) throw error;

      toast({ title: 'Note supprimée', description: 'La note de frais a été supprimée.' });
      navigate('/notes-frais');
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
      setShowDeleteDialog(false);
    }
  };

  const canEdit = isCreator && (note?.status === 'brouillon' || note?.status === 'rejetee');
  // Admin peut supprimer toute note non payée ; le créateur peut supprimer brouillon/rejetée
  const canDelete = (isAdmin && note?.status !== 'payee') || (isCreator && ['brouillon', 'rejetee'].includes(note?.status || ''));

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!note) return null;

  const StatusIcon = statusIcons[note.status];

  // ARRONDI COMPTABLE DAF: arrondi au supérieur pour les montants
  const formatAmount = (amount: number, currency: string = 'XOF') => {
    const rounded = Math.ceil(amount);
    return new Intl.NumberFormat('fr-FR').format(rounded) + ' ' + currency;
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/notes-frais">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-2xl font-bold text-foreground">
                  {note.reference}
                </h1>
                <Badge className={statusColors[note.status]}>
                  <StatusIcon className="mr-1 h-3 w-3" />
                  {NOTE_FRAIS_STATUS_LABELS[note.status]}
                </Badge>
              </div>
              <p className="text-muted-foreground">{note.title}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <FileCheck className="mr-2 h-4 w-4" />
              Imprimer
            </Button>
            {canEdit && (
              <Link to={`/notes-frais/${note.id}/modifier`}>
                <Button variant="outline" size="sm">
                  <Edit className="mr-2 h-4 w-4" />
                  Modifier
                </Button>
              </Link>
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
        {note.status === 'rejetee' && note.rejection_reason && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-start gap-3 py-4">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Motif du rejet</p>
                <p className="text-sm text-foreground">{note.rejection_reason}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {isCreator && note.status === 'brouillon' && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="font-medium text-foreground">Brouillon</p>
                <p className="text-sm text-muted-foreground">
                  Soumettez cette note pour validation DAF.
                </p>
              </div>
              <Button onClick={handleSubmit} disabled={isSaving}>
                <FileCheck className="mr-2 h-4 w-4" />
                Soumettre
              </Button>
            </CardContent>
          </Card>
        )}

        {(isDAF || isAdmin) && note.status === 'soumise' && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="font-medium text-foreground">Validation requise</p>
                <p className="text-sm text-muted-foreground">
                  Validez ou rejetez cette demande de remboursement.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={isSaving}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Rejeter
                </Button>
                <Button onClick={handleValidateDAF} disabled={isSaving}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Valider
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {(isComptable || isAdmin) && note.status === 'validee_daf' && (
          <Card className="border-success/50 bg-success/5">
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="font-medium text-foreground">Paiement requis</p>
                <p className="text-sm text-muted-foreground">
                  Procédez au paiement de cette note de frais validée.
                </p>
              </div>
              <Button onClick={() => setShowPayDialog(true)} disabled={isSaving}>
                <Wallet className="mr-2 h-4 w-4" />
                Marquer comme payée
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Paid status - show discharge PDF button */}
        {note.status === 'payee' && (
          <Card className="border-success/50 bg-success/5">
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-success" />
                <div>
                  <p className="font-medium text-success">Paiement effectué</p>
                  <p className="text-sm text-muted-foreground">
                    {note.paid_at
                      ? `Payée le ${format(new Date(note.paid_at), 'dd MMMM yyyy', { locale: fr })}`
                      : 'Cette note de frais a été payée.'}
                  </p>
                </div>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  // Récupérer le nom du comptable
                  const comptableProfile = (note as any).paid_by_profile;
                  const comptableFullName = comptableProfile
                    ? `${comptableProfile.first_name || ''} ${comptableProfile.last_name || ''}`.trim()
                    : user?.email?.split('@')[0] || 'Comptable';
                  
                  // Récupérer les infos de caisse si disponible (payment_details existe en DB mais pas dans le type TS)
                  const noteAny = note as any;
                  const paymentDetails = typeof noteAny.payment_details === 'object' && noteAny.payment_details !== null
                    ? noteAny.payment_details as Record<string, string>
                    : {};
                  
                  exportDechargeComptableToPDF({
                    type: 'NOTE_FRAIS',
                    reference: note.reference,
                    montant: note.total_amount || 0,
                    currency: note.currency || 'XOF',
                    caisseName: paymentDetails.caisse_name || 'Caisse',
                    caisseCode: paymentDetails.caisse_code || 'N/A',
                    comptableName: comptableFullName,
                    paidAt: note.paid_at || new Date().toISOString(),
                    beneficiaire: note.user
                      ? `${note.user.first_name || ''} ${note.user.last_name || ''}`.trim()
                      : undefined,
                    description: note.title,
                    modePaiement: note.mode_paiement || undefined,
                    referencePaiement: note.reference_paiement || undefined,
                    articles: (note.lignes || []).map((ligne: any) => ({
                      designation: ligne.motif,
                      montant: ligne.montant,
                      date: ligne.date_depense,
                    })),
                  });
                }}
              >
                <FileText className="mr-2 h-4 w-4" />
                Décharge PDF
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Demandeur</CardTitle>
            </CardHeader>
            <CardContent>
              <UserBadge
                userId={(note.user as any)?.id}
                photoUrl={(note.user as any)?.photo_url}
                firstName={(note.user as any)?.first_name}
                lastName={(note.user as any)?.last_name}
                fonction={(note.user as any)?.fonction}
                departmentName={note.department?.name}
                showFonction
                showDepartment
                linkToProfile
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Montant total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">
                {formatAmount(note.total_amount, note.currency)}
              </p>
            </CardContent>
          </Card>
        </div>

        {note.projet && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Projet rattaché</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <FolderKanban className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-mono font-medium">{note.projet.code}</p>
                <p className="text-sm text-muted-foreground">{note.projet.name}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lignes */}
        <Card>
          <CardHeader>
            <CardTitle>Détail des dépenses</CardTitle>
            <CardDescription>{note.lignes?.length || 0} ligne(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Projet</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Observations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(note.lignes || []).map((ligne) => (
                    <TableRow key={ligne.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(ligne.date_depense), 'dd MMM yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell className="font-medium">{ligne.motif}</TableCell>
                      <TableCell>
                        {ligne.projet ? (
                          <span className="font-mono text-sm">{ligne.projet.code}</span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatAmount(ligne.montant)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ligne.observations || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Historique</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                Créée le {format(new Date(note.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
              </span>
            </div>
            {note.submitted_at && (
              <div className="flex items-center gap-3 text-sm">
                <FileCheck className="h-4 w-4 text-warning" />
                <span>
                  Soumise le {format(new Date(note.submitted_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                </span>
              </div>
            )}
            {note.validated_daf_at && note.validated_daf_by_profile && (
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>
                  Validée par {note.validated_daf_by_profile.first_name} {note.validated_daf_by_profile.last_name} le{' '}
                  {format(new Date(note.validated_daf_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                </span>
              </div>
            )}
            {note.paid_at && note.paid_by_profile && (
              <div className="flex items-center gap-3 text-sm">
                <Wallet className="h-4 w-4 text-success" />
                <span>
                  Payée par {note.paid_by_profile.first_name} {note.paid_by_profile.last_name} le{' '}
                  {format(new Date(note.paid_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                  {note.mode_paiement && ` (${note.mode_paiement})`}
                </span>
              </div>
            )}
            {note.rejected_at && note.rejected_by_profile && (
              <div className="flex items-center gap-3 text-sm">
                <XCircle className="h-4 w-4 text-destructive" />
                <span>
                  Rejetée par {note.rejected_by_profile.first_name} {note.rejected_by_profile.last_name} le{' '}
                  {format(new Date(note.rejected_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter la note de frais</DialogTitle>
            <DialogDescription>
              Indiquez le motif du rejet.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rejection">Motif du rejet *</Label>
            <Textarea
              id="rejection"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Raison du rejet..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isSaving || !rejectionReason.trim()}
            >
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Dialog - Enhanced with SYSCOHADA and Payment Forms */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Traitement comptable et paiement</DialogTitle>
            <DialogDescription>
              Configurez les informations SYSCOHADA et le mode de paiement pour {formatAmount(note.total_amount, note.currency)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* SYSCOHADA Section */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Imputation SYSCOHADA
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Classe comptable *</Label>
                  <Select
                    value={syscohadaData.classe?.toString() || ''}
                    onValueChange={(v) => setSyscohadaData({ ...syscohadaData, classe: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une classe" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SYSCOHADA_CLASSES).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          Classe {key} - {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Compte comptable *</Label>
                  <CompteComptableAutocomplete
                    value={syscohadaData.compte}
                    onChange={(code) => setSyscohadaData({ ...syscohadaData, compte: code })}
                    placeholder="Rechercher un compte..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nature de la charge *</Label>
                  <Input
                    value={syscohadaData.nature_charge}
                    onChange={(e) => setSyscohadaData({ ...syscohadaData, nature_charge: e.target.value })}
                    placeholder="Ex: Frais de déplacement"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Centre de coût</Label>
                  <Input
                    value={syscohadaData.centre_cout}
                    onChange={(e) => setSyscohadaData({ ...syscohadaData, centre_cout: e.target.value })}
                    placeholder="Ex: Département, Projet..."
                  />
                </div>
              </div>
            </div>

            {/* Payment Section */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Mode de paiement
              </h3>
              <PaymentFormDynamic
                value={paymentFormData}
                onChange={setPaymentFormData}
                showPaymentClass={true}
              />

              <div className="space-y-2">
                <Label>Référence paiement</Label>
                <Input
                  value={referencePaiement}
                  onChange={(e) => setReferencePaiement(e.target.value)}
                  placeholder="N° transaction, chèque..."
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handlePay}
              disabled={isSaving || !paymentFormData.category_id || !paymentFormData.method_id || !syscohadaData.classe || !syscohadaData.compte}
            >
              {isSaving ? 'Traitement...' : 'Valider et payer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la note de frais ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La note {note.reference} et toutes ses lignes seront définitivement supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSaving}
            >
              {isSaving ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog correction caisse */}
      {note && note.caisse_id && (isDAF || isAdmin) && (
        <CorrectionCaisseDialog
          open={showCorrectionDialog}
          onOpenChange={setShowCorrectionDialog}
          type="note_frais"
          entityId={note.id}
          entityReference={note.reference}
          currentCaisseId={note.caisse_id}
          currentCaisseName={caisses.find(c => c.id === note.caisse_id)?.name || 'Caisse inconnue'}
          amount={note.total_amount || 0}
          devise={note.currency || 'XOF'}
          onSuccess={() => fetchNote()}
        />
      )}
    </AppLayout>
  );
}
