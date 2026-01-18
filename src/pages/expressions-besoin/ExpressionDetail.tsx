import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  FileText,
  ExternalLink,
  Send,
  Loader2,
  FileEdit,
  Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { UserBadge } from '@/components/ui/UserBadge';
import { ActionTimeline, TimelineEvent } from '@/components/ui/ActionTimeline';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import {
  ExpressionBesoinStatus,
  EXPRESSION_STATUS_LABELS,
  EXPRESSION_STATUS_COLORS,
  EXPRESSION_STATUS_DESCRIPTIONS,
  ExpressionUserRole,
  getExpressionActions,
} from '@/types/expression-besoin';

const STATUS_ICONS: Record<ExpressionBesoinStatus, React.ElementType> = {
  brouillon: FileEdit,
  soumis: Clock,
  en_examen: Eye,
  valide_departement: CheckCircle,
  rejete_departement: XCircle,
  envoye_logistique: Send,
};

export default function ExpressionDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Validation form state
  const [showValidateDialog, setShowValidateDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [quantite, setQuantite] = useState('');
  const [unite, setUnite] = useState('unité');
  const [precisionTechnique, setPrecisionTechnique] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch expression
  const { data: expression, isLoading, error } = useQuery({
    queryKey: ['expression-besoin', id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expressions_besoin')
        .select(`
          *,
          user:profiles!expressions_besoin_user_id_fkey(
            id, first_name, last_name, email, photo_url, fonction, chef_hierarchique_id,
            department:departments(name)
          ),
          department:departments(id, name),
          chef_validateur:profiles!expressions_besoin_chef_validateur_id_fkey(
            id, first_name, last_name, photo_url, fonction
          ),
          besoin:besoins(id, title, status)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id && !authLoading,
  });

  // Permission check (server-side)
  const { data: canValidate, isLoading: isCheckingPermission } = useQuery({
    queryKey: ['can-validate-expression', id, user?.id],
    queryFn: async () => {
      if (!id || !user?.id) return false;
      const { data, error } = await supabase.rpc('can_validate_expression', { _expression_id: id });
      if (error) {
        console.error('can_validate_expression error:', error);
        return false;
      }
      return !!data;
    },
    enabled: !!id && !!user?.id && !authLoading,
  });

  // Determine user role in context of this expression
  const getUserRole = (): ExpressionUserRole => {
    if (!expression || !user?.id) return 'viewer';
    if (expression.user_id === user.id) return 'owner';
    if (canValidate) return 'manager';
    return 'viewer';
  };

  const userRole = getUserRole();
  const status = expression?.status as ExpressionBesoinStatus;
  const actions = status ? getExpressionActions(status, userRole) : null;

  // Handle submit for validation (owner brouillon -> soumis)
  const handleSubmitForValidation = async () => {
    if (!id) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase.rpc('submit_expression_for_validation', {
        _expression_id: id,
      });

      if (error) throw error;

      toast({
        title: 'Expression soumise',
        description: 'Votre expression a été soumise à votre responsable pour validation.',
      });

      queryClient.invalidateQueries({ queryKey: ['expression-besoin', id] });
      queryClient.invalidateQueries({ queryKey: ['expressions-besoin'] });
    } catch (error: any) {
      console.error('Submit error:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de soumettre l\'expression.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle validate (manager)
  const handleValidate = async () => {
    if (!id || !quantite || parseInt(quantite) <= 0) {
      toast({
        title: 'Erreur',
        description: 'La quantité est obligatoire et doit être supérieure à 0.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase.rpc('validate_expression_by_manager', {
        _expression_id: id,
        _quantite: parseInt(quantite),
        _unite: unite,
        _precision_technique: precisionTechnique.trim() || null,
      });

      if (error) throw error;

      toast({
        title: 'Expression validée',
        description: 'L\'expression a été validée. Vous pouvez maintenant la transmettre à la logistique.',
      });

      queryClient.invalidateQueries({ queryKey: ['expression-besoin', id] });
      queryClient.invalidateQueries({ queryKey: ['expressions-besoin'] });
      setShowValidateDialog(false);
      setQuantite('');
      setPrecisionTechnique('');
    } catch (error: any) {
      console.error('Validation error:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de valider l\'expression.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle reject (manager)
  const handleReject = async () => {
    if (!id || !rejectionReason.trim()) {
      toast({
        title: 'Erreur',
        description: 'Le motif de rejet est obligatoire.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase.rpc('reject_expression_by_manager', {
        _expression_id: id,
        _rejection_reason: rejectionReason.trim(),
      });

      if (error) throw error;

      toast({
        title: 'Expression rejetée',
        description: 'Le demandeur a été notifié du rejet.',
      });

      queryClient.invalidateQueries({ queryKey: ['expression-besoin', id] });
      queryClient.invalidateQueries({ queryKey: ['expressions-besoin'] });
      setShowRejectDialog(false);
      setRejectionReason('');
    } catch (error: any) {
      console.error('Rejection error:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de rejeter l\'expression.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle submit to logistics (manager after validation)
  const handleSubmitToLogistics = async () => {
    if (!id) return;

    setIsProcessing(true);
    try {
      const { data: besoinId, error } = await supabase.rpc('submit_expression_to_logistics', {
        _expression_id: id,
      });

      if (error) throw error;

      toast({
        title: 'Expression transmise',
        description: 'Le besoin a été créé et transmis à la logistique.',
      });

      queryClient.invalidateQueries({ queryKey: ['expression-besoin', id] });
      queryClient.invalidateQueries({ queryKey: ['expressions-besoin'] });

      // Navigate to the created besoin
      if (besoinId) {
        navigate(`/besoins/${besoinId}`);
      }
    } catch (error: any) {
      console.error('Submit to logistics error:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de transmettre à la logistique.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Build timeline
  const buildTimeline = (): TimelineEvent[] => {
    if (!expression) return [];
    const events: TimelineEvent[] = [];

    // Creation event
    events.push({
      id: 'created',
      action: 'created',
      actionLabel: 'Expression créée',
      timestamp: expression.created_at,
      user: {
        id: expression.user?.id,
        photoUrl: expression.user?.photo_url,
        firstName: expression.user?.first_name,
        lastName: expression.user?.last_name,
        fonction: expression.user?.fonction,
        departmentName: expression.user?.department?.name,
      },
      variant: 'info',
    });

    // Submission event
    if (expression.submitted_at && status !== 'brouillon') {
      events.push({
        id: 'submitted',
        action: 'submitted',
        actionLabel: 'Expression soumise pour validation',
        timestamp: expression.submitted_at,
        user: {
          id: expression.user?.id,
          photoUrl: expression.user?.photo_url,
          firstName: expression.user?.first_name,
          lastName: expression.user?.last_name,
        },
        variant: 'info',
      });
    }

    // Validation event
    if (status === 'valide_departement' || status === 'envoye_logistique') {
      if (expression.validated_at || expression.reviewed_at) {
        events.push({
          id: 'validated',
          action: 'validated',
          actionLabel: `Validée - Quantité: ${expression.quantite} ${expression.unite || 'unité(s)'}`,
          timestamp: expression.validated_at || expression.reviewed_at!,
          user: {
            id: expression.chef_validateur?.id,
            photoUrl: expression.chef_validateur?.photo_url,
            firstName: expression.chef_validateur?.first_name,
            lastName: expression.chef_validateur?.last_name,
            fonction: expression.chef_validateur?.fonction,
          },
          comment: expression.precision_technique,
          variant: 'success',
        });
      }
    }

    // Rejection event
    if (status === 'rejete_departement' && expression.rejected_at) {
      events.push({
        id: 'rejected',
        action: 'rejected',
        actionLabel: 'Expression rejetée',
        timestamp: expression.rejected_at,
        user: {
          id: expression.chef_validateur?.id,
          photoUrl: expression.chef_validateur?.photo_url,
          firstName: expression.chef_validateur?.first_name,
          lastName: expression.chef_validateur?.last_name,
          fonction: expression.chef_validateur?.fonction,
        },
        comment: expression.rejection_reason,
        variant: 'destructive',
      });
    }

    // Sent to logistics event
    if (status === 'envoye_logistique' && expression.sent_to_logistics_at) {
      events.push({
        id: 'sent_logistics',
        action: 'sent_logistics',
        actionLabel: 'Transmise à la logistique',
        timestamp: expression.sent_to_logistics_at,
        user: {
          id: expression.chef_validateur?.id,
          photoUrl: expression.chef_validateur?.photo_url,
          firstName: expression.chef_validateur?.first_name,
          lastName: expression.chef_validateur?.last_name,
          fonction: expression.chef_validateur?.fonction,
        },
        variant: 'success',
      });
    }

    return events;
  };

  if (authLoading || isLoading) {
    return (
      <AppLayout>
        <ListSkeleton rows={6} columns={2} />
      </AppLayout>
    );
  }

  if (error || !expression) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-lg font-medium">Expression non trouvée</h2>
          <p className="text-muted-foreground mb-4">
            Cette expression n'existe pas ou vous n'y avez pas accès.
          </p>
          <Link to="/expressions-besoin">
            <Button>Retour à la liste</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const StatusIcon = STATUS_ICONS[status];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/expressions-besoin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-2xl font-bold text-foreground">
                {expression.nom_article}
              </h1>
              <Badge className={EXPRESSION_STATUS_COLORS[status]}>
                <StatusIcon className="mr-1 h-3 w-3" />
                {EXPRESSION_STATUS_LABELS[status]}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Créée le {format(new Date(expression.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
            </p>
          </div>
        </div>

        {/* Status description banner */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <p className="text-sm text-foreground">
              {EXPRESSION_STATUS_DESCRIPTIONS[status]}
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Expression details */}
            <Card>
              <CardHeader>
                <CardTitle>Détails de l'expression</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Nom de l'article</Label>
                  <p className="text-lg font-medium">{expression.nom_article}</p>
                </div>

                {expression.commentaire && (
                  <div>
                    <Label className="text-muted-foreground">Commentaire</Label>
                    <p className="mt-1 text-foreground whitespace-pre-wrap">
                      {expression.commentaire}
                    </p>
                  </div>
                )}

                {/* Validation info */}
                {(status === 'valide_departement' || status === 'envoye_logistique') && (
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm font-medium text-success mb-3">
                      Informations de validation
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="text-muted-foreground">Quantité</Label>
                        <p className="text-lg font-medium">
                          {expression.quantite} {expression.unite || 'unité(s)'}
                        </p>
                      </div>
                    </div>
                    {expression.precision_technique && (
                      <div className="mt-4">
                        <Label className="text-muted-foreground">Précisions techniques</Label>
                        <p className="mt-1 text-foreground whitespace-pre-wrap">
                          {expression.precision_technique}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Rejection info */}
                {status === 'rejete_departement' && expression.rejection_reason && (
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm font-medium text-destructive mb-2">Motif du rejet</p>
                    <p className="text-foreground bg-destructive/5 p-3 rounded-md">
                      {expression.rejection_reason}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Link to created besoin */}
            {expression.besoin && (
              <Card className="border-success/30 bg-success/5">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-success" />
                    <div>
                      <p className="font-medium text-foreground">
                        Besoin interne créé
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {expression.besoin.title}
                      </p>
                    </div>
                  </div>
                  <Link to={`/besoins/${expression.besoin.id}`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Voir le besoin
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Demandeur */}
            <Card>
              <CardHeader>
                <CardTitle>Demandeur</CardTitle>
              </CardHeader>
              <CardContent>
                <UserBadge
                  userId={expression.user?.id}
                  photoUrl={expression.user?.photo_url}
                  firstName={expression.user?.first_name}
                  lastName={expression.user?.last_name}
                  fonction={expression.user?.fonction}
                  departmentName={expression.department?.name}
                  showFonction
                  showDepartment
                  linkToProfile
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions card */}
            {actions && !isCheckingPermission && (
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                  <CardDescription>
                    {userRole === 'owner' && 'Actions disponibles pour votre expression'}
                    {userRole === 'manager' && 'Actions de validation disponibles'}
                    {userRole === 'viewer' && 'Consultation uniquement'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Owner actions */}
                  {actions.canSubmit && (
                    <Button 
                      className="w-full" 
                      onClick={handleSubmitForValidation}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Soumettre pour validation
                    </Button>
                  )}

                  {/* Manager validation actions */}
                  {actions.canValidate && (
                    <>
                      <Button 
                        className="w-full" 
                        onClick={() => setShowValidateDialog(true)}
                        disabled={isProcessing}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Valider et préciser
                      </Button>
                      <Button 
                        variant="destructive" 
                        className="w-full"
                        onClick={() => setShowRejectDialog(true)}
                        disabled={isProcessing}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Rejeter
                      </Button>
                    </>
                  )}

                  {/* Send to logistics */}
                  {actions.canSendToLogistics && (
                    <Button 
                      className="w-full" 
                      onClick={handleSubmitToLogistics}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Transmettre à la logistique
                    </Button>
                  )}

                  {/* No actions available message */}
                  {!actions.canSubmit && !actions.canValidate && !actions.canReject && !actions.canSendToLogistics && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Aucune action disponible pour cette expression.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {isCheckingPermission && (
              <Card className="border-muted">
                <CardContent className="py-4">
                  <p className="text-muted-foreground text-sm text-center">
                    Vérification des permissions...
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Historique</CardTitle>
              </CardHeader>
              <CardContent>
                <ActionTimeline events={buildTimeline()} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Validate Dialog */}
      <Dialog open={showValidateDialog} onOpenChange={setShowValidateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Valider l'expression</DialogTitle>
            <DialogDescription>
              Précisez la quantité et les informations techniques avant validation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quantite">Quantité *</Label>
                <Input
                  id="quantite"
                  type="number"
                  min="1"
                  value={quantite}
                  onChange={(e) => setQuantite(e.target.value)}
                  placeholder="Ex: 10"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unite">Unité</Label>
                <Select value={unite} onValueChange={setUnite}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unité">Unité</SelectItem>
                    <SelectItem value="pièce">Pièce</SelectItem>
                    <SelectItem value="kg">Kilogramme</SelectItem>
                    <SelectItem value="litre">Litre</SelectItem>
                    <SelectItem value="mètre">Mètre</SelectItem>
                    <SelectItem value="boîte">Boîte</SelectItem>
                    <SelectItem value="lot">Lot</SelectItem>
                    <SelectItem value="carton">Carton</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="precision">Précisions techniques (optionnel)</Label>
              <Textarea
                id="precision"
                value={precisionTechnique}
                onChange={(e) => setPrecisionTechnique(e.target.value)}
                placeholder="Spécifications, références, marque préférée..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowValidateDialog(false)} disabled={isProcessing}>
              Annuler
            </Button>
            <Button onClick={handleValidate} disabled={isProcessing || !quantite}>
              {isProcessing ? 'Validation...' : 'Valider'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeter l'expression</DialogTitle>
            <DialogDescription>
              Indiquez le motif du rejet. Le demandeur sera notifié.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Motif du rejet *</Label>
              <Textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Expliquez pourquoi cette expression est rejetée..."
                rows={4}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={isProcessing}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isProcessing || !rejectionReason.trim()}>
              {isProcessing ? 'Rejet...' : 'Rejeter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
