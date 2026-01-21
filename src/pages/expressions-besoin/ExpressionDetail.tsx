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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  User,
  Info,
  Package,
  FolderOpen,
  MapPin,
  Calendar,
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
  EXPRESSION_STATUS_DESCRIPTIONS_BY_ROLE,
  ExpressionUserRole,
  getExpressionActions,
  PublicProfile,
  formatFullName,
} from '@/types/expression-besoin';

const STATUS_ICONS: Record<ExpressionBesoinStatus, React.ElementType> = {
  brouillon: FileEdit,
  soumis: Clock,
  en_examen: Eye,
  valide_departement: CheckCircle,
  rejete_departement: XCircle,
  envoye_logistique: Send,
};

// Interface pour les lignes
interface ExpressionLigne {
  id: string;
  nom_article: string;
  quantite: number | null;
  unite: string | null;
  precision_technique: string | null;
  justification: string | null;
  status: string;
  rejection_reason: string | null;
}

// Interface pour l'état de validation des lignes
interface LigneValidationState {
  id: string;
  quantite: string;
  unite: string;
  precision_technique: string;
}

export default function ExpressionDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: authLoading, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Dialog states
  const [showValidateDialog, setShowValidateDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Validation state for each ligne
  const [lignesValidation, setLignesValidation] = useState<LigneValidationState[]>([]);

  // Fetch expression with lignes
  const { data, isLoading, error } = useQuery({
    queryKey: ['expression-besoin', id, user?.id],
    queryFn: async () => {
      // 1. Fetch expression with department, projet and lignes
      const { data: expression, error: expError } = await supabase
        .from('expressions_besoin')
        .select(`
          *,
          department:departments(id, name),
          projet:projets(id, code, name, location),
          besoin:besoins(id, title, status),
          lignes:expressions_besoin_lignes(id, nom_article, quantite, unite, precision_technique, justification, status, rejection_reason)
        `)
        .eq('id', id)
        .single();

      if (expError || !expression) throw expError || new Error('Expression non trouvée');

      // 2. Collect user IDs to fetch via RPC
      const userIds = [
        expression.user_id,
        expression.chef_validateur_id,
      ].filter(Boolean) as string[];

      // 3. Fetch public profiles via RPC
      const { data: publicProfiles } = await supabase.rpc('get_public_profiles', {
        _user_ids: userIds,
      });

      const profilesMap = new Map<string, PublicProfile>(
        (publicProfiles || []).map((p: PublicProfile) => [p.id, p])
      );

      return {
        expression,
        profiles: profilesMap,
        lignes: expression.lignes as ExpressionLigne[] || [],
      };
    },
    enabled: !!id && !authLoading,
  });

  const expression = data?.expression;
  const profiles = data?.profiles;
  const lignes = data?.lignes || [];

  // Initialize validation state when lignes are loaded
  const initValidationState = () => {
    setLignesValidation(lignes.map(l => ({
      id: l.id,
      quantite: l.quantite?.toString() || '',
      unite: l.unite || 'unité',
      precision_technique: l.precision_technique || '',
    })));
  };

  // Permission check
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

  // Get enriched profile data
  const getProfile = (userId: string | null | undefined): PublicProfile | null => {
    if (!userId || !profiles) return null;
    return profiles.get(userId) || null;
  };

  const demandeur = getProfile(expression?.user_id);
  const validateur = getProfile(expression?.chef_validateur_id);

  // Determine user role
  const getUserRole = (): ExpressionUserRole => {
    if (!expression || !user?.id) return 'viewer';
    if (expression.user_id === user.id) return 'owner';
    if (canValidate) return 'manager';
    return 'viewer';
  };

  const userRole = getUserRole();
  const status = expression?.status as ExpressionBesoinStatus;
  const actions = status ? getExpressionActions(status, userRole) : null;

  const getStatusDescription = (): string => {
    if (!status) return '';
    const descriptions = EXPRESSION_STATUS_DESCRIPTIONS_BY_ROLE[status];
    return descriptions[userRole];
  };

  // Update validation state for a ligne
  const updateLigneValidation = (ligneId: string, field: keyof LigneValidationState, value: string) => {
    setLignesValidation(prev => prev.map(l => 
      l.id === ligneId ? { ...l, [field]: value } : l
    ));
  };

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
        description: `Votre expression avec ${lignes.length} article(s) a été soumise pour validation.`,
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

  // Handle validate all lignes
  const handleValidate = async () => {
    if (!id) return;

    // Validate that all lignes have a quantity
    const invalidLignes = lignesValidation.filter(l => !l.quantite || parseInt(l.quantite) <= 0);
    if (invalidLignes.length > 0) {
      toast({
        title: 'Erreur',
        description: 'Toutes les lignes doivent avoir une quantité supérieure à 0.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Update each ligne with validation data
      for (const ligne of lignesValidation) {
        const { error } = await supabase
          .from('expressions_besoin_lignes')
          .update({
            quantite: parseInt(ligne.quantite),
            unite: ligne.unite,
            precision_technique: ligne.precision_technique.trim() || null,
            status: 'validated',
          })
          .eq('id', ligne.id);
        
        if (error) throw error;
      }

      // Update main expression status
      const { error: expError } = await supabase
        .from('expressions_besoin')
        .update({
          status: 'valide_departement',
          chef_validateur_id: user?.id,
          validated_at: new Date().toISOString(),
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (expError) throw expError;

      toast({
        title: 'Expression validée',
        description: `Les ${lignes.length} article(s) ont été validés.`,
      });

      queryClient.invalidateQueries({ queryKey: ['expression-besoin', id] });
      queryClient.invalidateQueries({ queryKey: ['expressions-besoin'] });
      setShowValidateDialog(false);
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

  // Handle reject
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
        description: `${formatFullName(demandeur?.first_name, demandeur?.last_name)} a été notifié(e) du rejet.`,
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

  // Handle submit to logistics
  const handleSubmitToLogistics = async () => {
    if (!id) return;

    setIsProcessing(true);
    try {
      const { data: besoinId, error } = await supabase.rpc('submit_expression_to_logistics', {
        _expression_id: id,
      });

      if (error) throw error;

      toast({
        title: 'Transmission réussie',
        description: besoinId 
          ? `Le besoin interne avec ${lignes.length} article(s) a été créé et transmis à la logistique.`
          : 'Expression transmise à la logistique.',
      });

      queryClient.invalidateQueries({ queryKey: ['expression-besoin', id] });
      queryClient.invalidateQueries({ queryKey: ['expressions-besoin'] });
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

    events.push({
      id: 'created',
      action: 'created',
      actionLabel: `Expression créée avec ${lignes.length} article(s)`,
      timestamp: expression.created_at,
      user: demandeur ? {
        id: demandeur.id,
        photoUrl: demandeur.photo_url,
        firstName: demandeur.first_name,
        lastName: demandeur.last_name,
        fonction: demandeur.fonction,
        departmentName: demandeur.department_name,
      } : undefined,
      variant: 'info',
    });

    if (expression.submitted_at && status !== 'brouillon') {
      events.push({
        id: 'submitted',
        action: 'submitted',
        actionLabel: 'Soumise pour validation',
        timestamp: expression.submitted_at,
        user: demandeur ? {
          id: demandeur.id,
          photoUrl: demandeur.photo_url,
          firstName: demandeur.first_name,
          lastName: demandeur.last_name,
        } : undefined,
        variant: 'info',
      });
    }

    if (status === 'valide_departement' || status === 'envoye_logistique') {
      if (expression.validated_at || expression.reviewed_at) {
        events.push({
          id: 'validated',
          action: 'validated',
          actionLabel: `${lignes.length} article(s) validé(s)`,
          timestamp: expression.validated_at || expression.reviewed_at!,
          user: validateur ? {
            id: validateur.id,
            photoUrl: validateur.photo_url,
            firstName: validateur.first_name,
            lastName: validateur.last_name,
            fonction: validateur.fonction,
          } : undefined,
          variant: 'success',
        });
      }
    }

    if (status === 'rejete_departement' && expression.rejected_at) {
      events.push({
        id: 'rejected',
        action: 'rejected',
        actionLabel: 'Rejetée',
        timestamp: expression.rejected_at,
        user: validateur ? {
          id: validateur.id,
          photoUrl: validateur.photo_url,
          firstName: validateur.first_name,
          lastName: validateur.last_name,
          fonction: validateur.fonction,
        } : undefined,
        comment: expression.rejection_reason,
        variant: 'destructive',
      });
    }

    if (status === 'envoye_logistique' && expression.sent_to_logistics_at) {
      events.push({
        id: 'sent_logistics',
        action: 'sent_logistics',
        actionLabel: 'Transmise à la logistique',
        timestamp: expression.sent_to_logistics_at,
        user: validateur ? {
          id: validateur.id,
          photoUrl: validateur.photo_url,
          firstName: validateur.first_name,
          lastName: validateur.last_name,
          fonction: validateur.fonction,
        } : undefined,
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
                {expression.titre || `Expression #${expression.id.slice(0, 8)}`}
              </h1>
              <Badge className={EXPRESSION_STATUS_COLORS[status]}>
                <StatusIcon className="mr-1 h-3 w-3" />
                {EXPRESSION_STATUS_LABELS[status]}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {lignes.length} article(s) • Créée le {format(new Date(expression.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
            </p>
          </div>
        </div>

        {/* Status description banner */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 py-4">
            <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground">
              {getStatusDescription()}
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Projet, Lieu et Date souhaitée */}
            {(expression.projet || expression.lieu_projet || expression.date_souhaitee) && (
              <Card>
                <CardContent className="pt-6">
                  <div className="grid gap-4 sm:grid-cols-3">
                    {expression.projet && (
                      <div className="flex items-start gap-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Projet</p>
                          <p className="font-medium">{expression.projet.code} - {expression.projet.name}</p>
                        </div>
                      </div>
                    )}
                    {expression.lieu_projet && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Lieu</p>
                          <p className="font-medium">{expression.lieu_projet}</p>
                        </div>
                      </div>
                    )}
                    {expression.date_souhaitee && (
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Date souhaitée</p>
                          <p className="font-medium">
                            {format(new Date(expression.date_souhaitee), 'd MMMM yyyy', { locale: fr })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Articles list */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Articles demandés ({lignes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Article</TableHead>
                      <TableHead>Quantité</TableHead>
                      <TableHead>Unité</TableHead>
                      <TableHead>Justification</TableHead>
                      {(status === 'valide_departement' || status === 'envoye_logistique') && (
                        <TableHead>Précisions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lignes.map((ligne) => (
                      <TableRow key={ligne.id}>
                        <TableCell className="font-medium">
                          {ligne.nom_article}
                        </TableCell>
                        <TableCell>
                          {ligne.quantite ? (
                            <span className="font-medium">{ligne.quantite}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {ligne.unite || 'unité'}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {ligne.justification ? (
                            <span className="text-sm">{ligne.justification}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        {(status === 'valide_departement' || status === 'envoye_logistique') && (
                          <TableCell>
                            {ligne.precision_technique || '—'}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Commentaire global */}
            {expression.commentaire && (
              <Card>
                <CardHeader>
                  <CardTitle>Commentaire</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground whitespace-pre-wrap">
                    {expression.commentaire}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Rejection info */}
            {status === 'rejete_departement' && expression.rejection_reason && (
              <Card className="border-destructive/30">
                <CardHeader>
                  <CardTitle className="text-destructive">Motif du rejet</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground bg-destructive/5 p-3 rounded-md">
                    {expression.rejection_reason}
                  </p>
                </CardContent>
              </Card>
            )}

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
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Demandeur
                </CardTitle>
              </CardHeader>
              <CardContent>
                <UserBadge
                  userId={demandeur?.id}
                  photoUrl={demandeur?.photo_url}
                  firstName={demandeur?.first_name}
                  lastName={demandeur?.last_name}
                  fonction={demandeur?.fonction}
                  departmentName={demandeur?.department_name || expression.department?.name}
                  showFonction
                  showDepartment
                  linkToProfile
                />
              </CardContent>
            </Card>

            {/* Validateur */}
            {validateur && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-success" />
                    {status === 'rejete_departement' ? 'Rejeté par' : 'Validé par'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <UserBadge
                    userId={validateur.id}
                    photoUrl={validateur.photo_url}
                    firstName={validateur.first_name}
                    lastName={validateur.last_name}
                    fonction={validateur.fonction}
                    departmentName={validateur.department_name}
                    showFonction
                    showDepartment
                    linkToProfile
                  />
                </CardContent>
              </Card>
            )}
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
                    {userRole === 'manager' && `Actions sur l'expression de ${formatFullName(demandeur?.first_name, demandeur?.last_name)}`}
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
                        onClick={() => {
                          initValidationState();
                          setShowValidateDialog(true);
                        }}
                        disabled={isProcessing}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Valider {lignes.length > 1 ? `les ${lignes.length} articles` : 'l\'article'}
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

      {/* Validate Dialog - with all lignes */}
      <Dialog open={showValidateDialog} onOpenChange={setShowValidateDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Valider l'expression</DialogTitle>
            <DialogDescription>
              Précisez la quantité pour chaque article demandé par {formatFullName(demandeur?.first_name, demandeur?.last_name)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {lignesValidation.map((ligne, index) => {
              const originalLigne = lignes.find(l => l.id === ligne.id);
              return (
                <Card key={ligne.id} className="p-4">
                  <div className="space-y-3">
                    <p className="font-medium">{originalLigne?.nom_article}</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Quantité *</Label>
                        <Input
                          type="number"
                          min="1"
                          value={ligne.quantite}
                          onChange={(e) => updateLigneValidation(ligne.id, 'quantite', e.target.value)}
                          placeholder="Ex: 10"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Unité</Label>
                        <Select 
                          value={ligne.unite} 
                          onValueChange={(v) => updateLigneValidation(ligne.id, 'unite', v)}
                        >
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
                      <div className="space-y-1 sm:col-span-3 lg:col-span-1">
                        <Label className="text-xs">Précisions (optionnel)</Label>
                        <Input
                          value={ligne.precision_technique}
                          onChange={(e) => updateLigneValidation(ligne.id, 'precision_technique', e.target.value)}
                          placeholder="Marque, référence..."
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowValidateDialog(false)} disabled={isProcessing}>
              Annuler
            </Button>
            <Button 
              onClick={handleValidate} 
              disabled={isProcessing || lignesValidation.some(l => !l.quantite || parseInt(l.quantite) <= 0)}
            >
              {isProcessing ? 'Validation...' : `Valider ${lignes.length} article(s)`}
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
              Rejetez l'expression de <strong>{formatFullName(demandeur?.first_name, demandeur?.last_name)}</strong> ({lignes.length} article(s)).
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
