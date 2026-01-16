import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { UserBadge } from '@/components/ui/UserBadge';
import { ActionTimeline, TimelineEvent } from '@/components/ui/ActionTimeline';
import { ListSkeleton } from '@/components/ui/ListSkeleton';

type ExpressionStatus = 'en_attente' | 'validee' | 'rejetee';

const STATUS_LABELS: Record<ExpressionStatus, string> = {
  en_attente: 'En attente de validation',
  validee: 'Validée',
  rejetee: 'Rejetée',
};

const statusColors: Record<ExpressionStatus, string> = {
  en_attente: 'bg-warning/10 text-warning',
  validee: 'bg-success/10 text-success',
  rejetee: 'bg-destructive/10 text-destructive',
};

const statusIcons: Record<ExpressionStatus, React.ElementType> = {
  en_attente: Clock,
  validee: CheckCircle,
  rejetee: XCircle,
};

export default function ExpressionDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Permission check (server-side) to avoid relying on direct profiles reads
  const { data: canValidate, isLoading: isCheckingPermission } = useQuery({
    queryKey: ['can-validate-expression', id, user?.id],
    queryFn: async () => {
      if (!id || !user?.id) return false;
      const { data, error } = await supabase.rpc('can_validate_expression', { _expression_id: id });
      if (error) {
        console.error('can_validate_expression error:', error);
        return false;
      }
      console.log('can_validate_expression result:', data, 'for user:', user.id, 'expression:', id);
      return !!data;
    },
    enabled: !!id && !!user?.id && !authLoading,
  });

  const handleValidate = async () => {
    if (!profile?.id) {
      toast({
        title: 'Erreur',
        description: 'Profil utilisateur introuvable. Veuillez vous reconnecter.',
        variant: 'destructive',
      });
      return;
    }

    if (!quantite || parseInt(quantite) <= 0) {
      toast({
        title: 'Erreur',
        description: 'La quantité est obligatoire et doit être supérieure à 0.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Update expression status
      const { error: updateError } = await supabase
        .from('expressions_besoin')
        .update({
          status: 'validee',
          validated_at: new Date().toISOString(),
          chef_validateur_id: profile?.id,
          quantite: parseInt(quantite),
          unite: unite,
          precision_technique: precisionTechnique.trim() || null,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // 2. Create the formal besoin
      const { data: besoinData, error: besoinError } = await supabase
        .from('besoins')
        .insert({
          title: expression.nom_article,
          description: [
            expression.commentaire,
            precisionTechnique && `Précisions techniques: ${precisionTechnique}`,
          ].filter(Boolean).join('\n\n'),
          category: 'materiel',
          urgency: 'normale',
          user_id: expression.user_id,
          department_id: expression.department_id,
          objet_besoin: expression.nom_article,
          estimated_quantity: parseInt(quantite),
          unit: unite,
        })
        .select()
        .single();

      if (besoinError) throw besoinError;

      // 3. Create besoin ligne
      await supabase
        .from('besoin_lignes')
        .insert({
          besoin_id: besoinData.id,
          designation: expression.nom_article,
          category: 'materiel',
          quantity: parseInt(quantite),
          unit: unite,
          urgency: 'normale',
        });

      // 4. Link expression to besoin
      await supabase
        .from('expressions_besoin')
        .update({ besoin_id: besoinData.id })
        .eq('id', id);

      toast({
        title: 'Expression validée',
        description: 'Un besoin interne a été créé à partir de cette expression.',
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

  const handleReject = async () => {
    if (!profile?.id) {
      toast({
        title: 'Erreur',
        description: 'Profil utilisateur introuvable. Veuillez vous reconnecter.',
        variant: 'destructive',
      });
      return;
    }

    if (!rejectionReason.trim()) {
      toast({
        title: 'Erreur',
        description: 'Le motif de rejet est obligatoire.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('expressions_besoin')
        .update({
          status: 'rejetee',
          rejected_at: new Date().toISOString(),
          chef_validateur_id: profile?.id,
          rejection_reason: rejectionReason.trim(),
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Expression rejetée',
        description: 'Le demandeur a été notifié du rejet.',
      });

      queryClient.invalidateQueries({ queryKey: ['expression-besoin', id] });
      queryClient.invalidateQueries({ queryKey: ['expressions-besoin'] });
      setShowRejectDialog(false);
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

  // Build timeline
  const buildTimeline = (): TimelineEvent[] => {
    if (!expression) return [];
    const events: TimelineEvent[] = [];

    // Creation event
    events.push({
      id: 'created',
      action: 'created',
      actionLabel: 'Expression de besoin créée',
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

    // Validation event
    if (expression.status === 'validee' && expression.validated_at) {
      events.push({
        id: 'validated',
        action: 'validated',
        actionLabel: `Expression validée avec quantité: ${expression.quantite} ${expression.unite || 'unité(s)'}`,
        timestamp: expression.validated_at,
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

    // Rejection event
    if (expression.status === 'rejetee' && expression.rejected_at) {
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

    return events;
  };

  if (authLoading) {
    return (
      <AppLayout>
        <ListSkeleton rows={6} columns={2} />
      </AppLayout>
    );
  }

  if (isLoading) {
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

  const StatusIcon = statusIcons[expression.status as ExpressionStatus];
  const isPending = expression.status === 'en_attente';

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
              <Badge className={statusColors[expression.status as ExpressionStatus]}>
                <StatusIcon className="mr-1 h-3 w-3" />
                {STATUS_LABELS[expression.status as ExpressionStatus]}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Créée le {format(new Date(expression.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
            </p>
          </div>
        </div>

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

                {expression.status === 'validee' && (
                  <>
                    <div className="border-t pt-4 mt-4">
                      <p className="text-sm font-medium text-success mb-3">
                        Informations ajoutées à la validation
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
                  </>
                )}

                {expression.status === 'rejetee' && expression.rejection_reason && (
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

            {/* Actions for manager */}
            {isPending && isCheckingPermission && (
              <Card className="border-muted">
                <CardContent className="py-4">
                  <p className="text-muted-foreground text-sm">Vérification des permissions...</p>
                </CardContent>
              </Card>
            )}
            {canValidate && isPending && !isCheckingPermission && (
              <Card className="border-warning/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    Action requise
                  </CardTitle>
                  <CardDescription>
                    En tant que responsable hiérarchique, vous pouvez valider ou rejeter cette expression.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex gap-3">
                  <Button onClick={() => setShowValidateDialog(true)}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Valider et préciser
                  </Button>
                  <Button variant="destructive" onClick={() => setShowRejectDialog(true)}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Rejeter
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Timeline */}
          <div className="space-y-6">
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
              Un besoin interne sera créé automatiquement.
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
