import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  DA_STATUS_LABELS,
  DA_CATEGORY_LABELS,
  DAStatus,
  Fournisseur,
  SYSCOHADA_CLASSES,
} from '@/types/kpm';
import { AccessDenied } from '@/components/ui/AccessDenied';
import {
  ArrowLeft,
  BookOpen,
  Building2,
  DollarSign,
  FileText,
  ExternalLink,
  Banknote,
  BookX,
  ShieldCheck,
  AlertTriangle,
  Download,
  Wallet,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { exportEcritureToPDF } from '@/utils/pdfExport';
import { DATimeline } from '@/components/ui/DATimeline';
import { SyscohadaFormDynamic } from '@/components/comptabilite/SyscohadaFormDynamic';
import { PaymentFormDynamic } from '@/components/comptabilite/PaymentFormDynamic';

export default function ComptabiliteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, roles, isAdmin } = useAuth();
  const { toast } = useToast();

  const [da, setDA] = useState<DemandeAchat | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Formulaire SYSCOHADA
  const [syscohadaForm, setSyscohadaForm] = useState({
    classe: '',
    compte: '',
    nature_charge: '',
    centre_cout: '',
  });
  
  // Formulaire Paiement
  const [paymentForm, setPaymentForm] = useState({
    category_id: '',
    method_id: '',
    details: {} as Record<string, string>,
  });
  
  // Caisse sélectionnée pour le paiement
  const [selectedCaisseId, setSelectedCaisseId] = useState('');
  
  // Liste des caisses
  const [caisses, setCaisses] = useState<Array<{id: string; code: string; name: string; type: string; solde_actuel: number; devise: string}>>([]);

  const isComptable = roles.includes('comptable');
  const isDG = roles.includes('dg');
  const isDAF = roles.includes('daf');
  const canAccess = isComptable || isAdmin || isDG || isDAF;
  const canProcess = isComptable && da?.status === 'validee_finance';

  useEffect(() => {
    if (id && canAccess) {
      fetchDA();
      fetchCaisses();
    } else if (!canAccess) {
      setIsLoading(false);
    }
  }, [id, canAccess]);

  const fetchCaisses = async () => {
    try {
      const { data, error } = await supabase
        .from('caisses')
        .select('id, code, name, type, solde_actuel, devise')
        .eq('is_active', true)
        .order('type')
        .order('name');
      if (error) throw error;
      setCaisses(data || []);
    } catch (error) {
      console.error('Error fetching caisses:', error);
    }
  };

  const fetchDA = async () => {
    try {
      const { data, error } = await supabase
        .from('demandes_achat')
        .select(`
          *,
          department:departments(id, name),
          selected_fournisseur:fournisseurs(id, name, address, phone, email),
          besoin:besoins(id, title, user_id)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        toast({ 
          title: 'Demande introuvable', 
          description: 'Cette demande d\'achat n\'existe pas ou a été supprimée.',
        });
        navigate('/comptabilite');
        return;
      }

      if (!['validee_finance', 'payee', 'rejetee_comptabilite'].includes(data.status)) {
        toast({ 
          title: 'Accès non autorisé', 
          description: 'Cette DA n\'est pas encore prête pour le traitement comptable.',
        });
        navigate('/comptabilite');
        return;
      }

      // Collect all actor IDs
      const actorIds = [
        data.created_by,
        data.analyzed_by,
        data.priced_by,
        data.submitted_validation_by,
        data.validated_finance_by,
        data.comptabilise_by,
      ].filter(Boolean) as string[];

      // Fetch profiles using the security definer function (bypasses RLS)
      const { data: profilesData } = await supabase.rpc('get_public_profiles', {
        _user_ids: actorIds
      });

      const profilesById: Record<string, { first_name: string | null; last_name: string | null }> = {};
      (profilesData || []).forEach((p: any) => {
        profilesById[p.id] = {
          first_name: p.first_name,
          last_name: p.last_name,
        };
      });

      // Enrich DA with profile data
      const enrichedDA = {
        ...data,
        created_by_profile: profilesById[data.created_by] || null,
        analyzed_by_profile: data.analyzed_by ? profilesById[data.analyzed_by] || null : null,
        priced_by_profile: data.priced_by ? profilesById[data.priced_by] || null : null,
        submitted_validation_by_profile: data.submitted_validation_by ? profilesById[data.submitted_validation_by] || null : null,
        validated_finance_by_profile: data.validated_finance_by ? profilesById[data.validated_finance_by] || null : null,
        comptabilise_by_profile: data.comptabilise_by ? profilesById[data.comptabilise_by] || null : null,
      };

      setDA(enrichedDA as unknown as DemandeAchat);
      
      // Pré-remplir le formulaire si déjà enregistré
      if (data.syscohada_classe) {
        setSyscohadaForm({
          classe: data.syscohada_classe.toString(),
          compte: data.syscohada_compte || '',
          nature_charge: data.syscohada_nature_charge || '',
          centre_cout: data.syscohada_centre_cout || '',
        });
      }
      // Pré-remplir paiement si déjà enregistré
      if (data.payment_category_id) {
        setPaymentForm({
          category_id: data.payment_category_id || '',
          method_id: data.payment_method_id || '',
          details: typeof data.payment_details === 'object' && data.payment_details !== null 
            ? data.payment_details as Record<string, string> 
            : {},
        });
      }
    } catch (error: any) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateForms = (): boolean => {
    if (!syscohadaForm.classe) {
      toast({ title: 'Informations incomplètes', description: 'Veuillez sélectionner une classe SYSCOHADA.' });
      return false;
    }
    if (!syscohadaForm.compte.trim()) {
      toast({ title: 'Informations incomplètes', description: 'Veuillez sélectionner un compte comptable.' });
      return false;
    }
    if (!syscohadaForm.nature_charge.trim()) {
      toast({ title: 'Informations incomplètes', description: 'La nature de charge est requise.' });
      return false;
    }
    if (!paymentForm.category_id) {
      toast({ title: 'Mode de paiement requis', description: 'Veuillez sélectionner une catégorie de paiement.' });
      return false;
    }
    return true;
  };

  const handlePay = async () => {
    if (!da || !validateForms()) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('demandes_achat')
        .update({
          status: 'payee',
          syscohada_classe: parseInt(syscohadaForm.classe),
          syscohada_compte: syscohadaForm.compte.trim(),
          syscohada_nature_charge: syscohadaForm.nature_charge.trim(),
          syscohada_centre_cout: syscohadaForm.centre_cout.trim() || null,
          payment_category_id: paymentForm.category_id || null,
          payment_method_id: paymentForm.method_id || null,
          payment_details: paymentForm.details,
          caisse_id: selectedCaisseId && selectedCaisseId !== '_none' ? selectedCaisseId : null,
          comptabilise_by: user?.id,
          comptabilise_at: new Date().toISOString(),
        })
        .eq('id', da.id);

      if (error) throw error;

      toast({ 
        title: 'Paiement enregistré', 
        description: 'La DA a été marquée comme payée et les écritures comptables ont été créées.' 
      });
      setShowPayDialog(false);
      fetchDA();
    } catch (error: any) {
      toast({ title: 'Erreur lors de l\'enregistrement', description: 'Veuillez réessayer ou contacter l\'administrateur.' });
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
          status: 'rejetee_comptabilite',
          comptabilite_rejection_reason: rejectionReason.trim(),
          comptabilise_by: user?.id,
          comptabilise_at: new Date().toISOString(),
        })
        .eq('id', da.id);

      if (error) throw error;

      toast({ title: 'DA rejetée', description: 'Le DAF et la Logistique ont été notifiés.' });
      setShowRejectDialog(false);
      fetchDA();
    } catch (error: any) {
      toast({ title: 'Erreur lors du rejet', description: 'Veuillez réessayer ou contacter l\'administrateur.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!canAccess) {
    return (
      <AppLayout>
        <AccessDenied />
      </AppLayout>
    );
  }

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

  const statusColor = da.status === 'payee' 
    ? 'bg-success text-success-foreground' 
    : da.status === 'rejetee_comptabilite' 
    ? 'bg-destructive text-destructive-foreground'
    : 'bg-warning text-warning-foreground';

  const handleExportPDF = () => {
    if (da.status !== 'payee' || !da.syscohada_classe) {
      return; // Only export if DA is paid and has SYSCOHADA info
    }
    
    exportEcritureToPDF({
      reference: `EC-${da.reference}`,
      daReference: da.reference,
      libelle: `Paiement ${da.reference} - ${da.selected_fournisseur?.name || 'N/A'}`,
      dateEcriture: da.comptabilise_at 
        ? format(new Date(da.comptabilise_at), 'dd MMMM yyyy', { locale: fr })
        : format(new Date(), 'dd MMMM yyyy', { locale: fr }),
      classesSyscohada: da.syscohada_classe,
      compteComptable: da.syscohada_compte || 'N/A',
      natureCharge: da.syscohada_nature_charge || 'N/A',
      centreCout: da.syscohada_centre_cout || undefined,
      debit: da.total_amount || 0,
      credit: 0,
      devise: da.currency || 'XOF',
      modePaiement: da.mode_paiement || undefined,
      referencePaiement: da.reference_paiement || undefined,
      isValidated: true,
      validatedAt: da.comptabilise_at 
        ? format(new Date(da.comptabilise_at), 'dd MMMM yyyy à HH:mm', { locale: fr })
        : undefined,
      validatedBy: 'Comptable',
      createdAt: format(new Date(da.created_at), 'dd MMMM yyyy', { locale: fr }),
      createdBy: da.created_by_profile 
        ? `${da.created_by_profile.first_name || ''} ${da.created_by_profile.last_name || ''}`.trim()
        : 'N/A',
      observations: undefined,
    });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/comptabilite">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-2xl font-bold text-foreground">{da.reference}</h1>
                <Badge className={statusColor}>
                  {DA_STATUS_LABELS[da.status as DAStatus]}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Traitement comptable
              </p>
            </div>
          </div>
          
          {da.status === 'payee' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
            >
              <Download className="mr-2 h-4 w-4" />
              Exporter PDF
            </Button>
          )}
        </div>

        {/* Bannière statut final */}
        {da.status === 'payee' && (
          <Card className="border-success bg-success/10">
            <CardContent className="flex items-center gap-3 py-4">
              <Banknote className="h-6 w-6 text-success" />
              <div>
                <p className="font-bold text-success">Paiement effectué</p>
                <p className="text-sm text-foreground">
                  Cette DA a été payée le {da.comptabilise_at && format(new Date(da.comptabilise_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}.
                  {da.mode_paiement && ` Mode: ${da.mode_paiement}.`}
                  {da.reference_paiement && ` Réf: ${da.reference_paiement}.`}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {da.status === 'rejetee_comptabilite' && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="flex items-center gap-3 py-4">
              <BookX className="h-6 w-6 text-destructive" />
              <div>
                <p className="font-bold text-destructive">Rejetée par la Comptabilité</p>
                <p className="text-sm text-foreground">
                  {da.comptabilite_rejection_reason || 'Aucun motif spécifié.'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bannière lecture seule pour DAF/DG */}
        {(isDAF || isDG) && !isComptable && !isAdmin && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center gap-3 py-4">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium text-foreground">Mode lecture seule</p>
                <p className="text-sm text-muted-foreground">
                  Vous consultez cette DA en tant que {isDAF ? 'DAF' : 'DG'}. Seul le comptable peut effectuer le traitement comptable.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Panneau d'action pour comptable */}
        {canProcess && (
          <Card className="border-2 border-warning bg-gradient-to-r from-warning/5 to-primary/5">
            <CardContent className="space-y-6 py-6">
              <div className="flex items-center gap-3">
                <BookOpen className="h-8 w-8 text-warning" />
                <div>
                  <p className="text-lg font-bold text-foreground">Rattachement SYSCOHADA obligatoire</p>
                  <p className="text-sm text-muted-foreground">
                    Renseignez les informations comptables avant de procéder au paiement.
                  </p>
                </div>
              </div>

              {/* Formulaire SYSCOHADA dynamique */}
              <div className="rounded-lg border bg-card p-4">
                <SyscohadaFormDynamic
                  value={syscohadaForm}
                  onChange={setSyscohadaForm}
                  disabled={false}
                />
              </div>

              {/* Formulaire Paiement dynamique */}
              <div className="rounded-lg border bg-card p-4">
                <PaymentFormDynamic
                  value={paymentForm}
                  onChange={setPaymentForm}
                  disabled={false}
                />
              </div>

              {/* Sélection de la caisse */}
              <div className="rounded-lg border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Source des fonds (optionnel)</h3>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">
                  Sélectionnez une caisse pour enregistrer automatiquement le mouvement de sortie.
                </p>
                <Select value={selectedCaisseId} onValueChange={setSelectedCaisseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une caisse..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Aucune (paiement externe)</SelectItem>
                    {caisses.map((caisse) => (
                      <SelectItem key={caisse.id} value={caisse.id}>
                        <span className="flex items-center gap-2">
                          {caisse.code} - {caisse.name}
                          <span className="text-xs text-muted-foreground">
                            ({new Intl.NumberFormat('fr-FR').format(caisse.solde_actuel)} {caisse.devise})
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCaisseId && selectedCaisseId !== '_none' && da?.total_amount && (
                  <p className="mt-2 text-sm text-warning">
                    ⚠️ Un mouvement de sortie de {da.total_amount.toLocaleString()} {da.currency} sera créé automatiquement.
                  </p>
                )}
              </div>

              {/* Message d'avertissement */}
              <div className="flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/10 p-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <p className="text-sm text-foreground">
                  Cette opération crée une écriture comptable irréversible. Vérifiez toutes les informations avant de valider.
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={() => setShowPayDialog(true)} 
                  className="bg-success hover:bg-success/90"
                  disabled={isSaving}
                >
                  <Banknote className="mr-2 h-4 w-4" />
                  Enregistrer le paiement
                </Button>
                <Button 
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={isSaving}
                >
                  <BookX className="mr-2 h-4 w-4" />
                  Rejeter
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Récapitulatif montant */}
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="rounded-full bg-primary/10 p-4">
              <DollarSign className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">
                {da.total_amount?.toLocaleString()} {da.currency}
              </p>
              <p className="text-muted-foreground">Montant total à payer</p>
            </div>
          </CardContent>
        </Card>

        {/* Fournisseur */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5" />
              Fournisseur
            </CardTitle>
          </CardHeader>
          <CardContent>
            {da.selected_fournisseur ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Nom</p>
                  <p className="font-medium">{(da.selected_fournisseur as Fournisseur).name}</p>
                </div>
                {(da.selected_fournisseur as Fournisseur).phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Téléphone</p>
                    <p className="font-medium">{(da.selected_fournisseur as Fournisseur).phone}</p>
                  </div>
                )}
                {(da.selected_fournisseur as Fournisseur).email && (
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{(da.selected_fournisseur as Fournisseur).email}</p>
                  </div>
                )}
                {(da.selected_fournisseur as Fournisseur).address && (
                  <div className="sm:col-span-2">
                    <p className="text-sm text-muted-foreground">Adresse</p>
                    <p className="font-medium">{(da.selected_fournisseur as Fournisseur).address}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">Fournisseur non spécifié</p>
            )}
          </CardContent>
        </Card>

        {/* Informations comptables si payée */}
        {da.status === 'payee' && da.syscohada_classe && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5" />
                Rattachement SYSCOHADA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Classe</p>
                  <p className="font-medium">
                    Classe {da.syscohada_classe} - {SYSCOHADA_CLASSES[da.syscohada_classe]}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Compte</p>
                  <p className="font-medium">{da.syscohada_compte}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nature de charge</p>
                  <p className="font-medium">{da.syscohada_nature_charge}</p>
                </div>
                {da.syscohada_centre_cout && (
                  <div>
                    <p className="text-sm text-muted-foreground">Centre de coût</p>
                    <p className="font-medium">{da.syscohada_centre_cout}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Détails DA */}
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
                <p className="text-sm text-muted-foreground">Catégorie</p>
                <Badge variant="outline">{DA_CATEGORY_LABELS[da.category]}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Validée financièrement le</p>
                <p className="font-medium">
                  {da.validated_finance_at 
                    ? format(new Date(da.validated_finance_at), 'dd MMMM yyyy à HH:mm', { locale: fr })
                    : 'N/A'}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm text-muted-foreground">Description</p>
              <p className="whitespace-pre-wrap text-foreground">{da.description}</p>
            </div>

            {da.fournisseur_justification && (
              <div className="border-t pt-4">
                <p className="mb-2 text-sm text-muted-foreground">Justification Achats</p>
                <p className="whitespace-pre-wrap text-foreground">{da.fournisseur_justification}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lien vers besoin source */}
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

        {/* Timeline des actions */}
        <DATimeline da={da as any} />
      </div>

      {/* Dialog confirmation paiement */}
      <AlertDialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-success" />
              Confirmer le paiement ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette opération crée une écriture comptable irréversible. 
              Le montant de <strong>{da.total_amount?.toLocaleString()} {da.currency}</strong> sera 
              enregistré comme payé au fournisseur <strong>{(da.selected_fournisseur as Fournisseur)?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Rattachement comptable</p>
            <p className="font-medium">
              Classe {syscohadaForm.classe} • {syscohadaForm.compte} • {syscohadaForm.nature_charge}
            </p>
            {paymentForm.category_id && (
              <p className="text-sm text-muted-foreground">
                Paiement configuré
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handlePay} 
              className="bg-success text-success-foreground hover:bg-success/90"
              disabled={isSaving}
            >
              Confirmer le paiement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog rejet */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <BookX className="h-5 w-5" />
              Rejeter cette DA
            </DialogTitle>
            <DialogDescription>
              Cette action bloque définitivement la demande. Indiquez le motif du rejet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>Motif du rejet *</Label>
            <Textarea
              placeholder="Expliquez pourquoi cette DA ne peut pas être payée..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Annuler</Button>
            <Button 
              variant="destructive" 
              onClick={handleReject} 
              disabled={!rejectionReason.trim() || isSaving}
            >
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
