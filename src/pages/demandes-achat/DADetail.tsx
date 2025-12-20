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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
} from '@/types/kpm';
import {
  ArrowLeft,
  Clock,
  Send,
  XCircle,
  Trash2,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const statusColors: Record<DAStatus, string> = {
  brouillon: 'bg-muted text-muted-foreground',
  soumise: 'bg-primary/10 text-primary border-primary/20',
  rejetee: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusIcons: Record<DAStatus, React.ElementType> = {
  brouillon: Clock,
  soumise: Send,
  rejetee: XCircle,
};

export default function DADetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, roles, isAdmin } = useAuth();
  const { toast } = useToast();

  const [da, setDA] = useState<DemandeAchat | null>(null);
  const [articles, setArticles] = useState<DAArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const isLogistics = roles.some((r) => LOGISTICS_ROLES.includes(r));
  const isAchats = roles.some((r) => ACHATS_ROLES.includes(r));
  const isDG = roles.includes('dg');
  
  const canSubmit = (isLogistics || isAdmin) && da?.status === 'brouillon';
  const canReject = (isAchats || isAdmin) && da?.status === 'soumise';
  const canDelete = isAdmin;

  useEffect(() => {
    if (id) {
      fetchDA();
      fetchArticles();
    }
  }, [id]);

  const fetchDA = async () => {
    try {
      const { data, error } = await supabase
        .from('demandes_achat')
        .select(`
          *,
          department:departments(id, name),
          created_by_profile:profiles!demandes_achat_created_by_fkey(id, first_name, last_name),
          rejected_by_profile:profiles!demandes_achat_rejected_by_fkey(id, first_name, last_name),
          besoin:besoins(id, title, user_id)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        toast({ title: 'Erreur', description: 'DA introuvable.', variant: 'destructive' });
        navigate('/demandes-achat');
        return;
      }

      setDA(data as DemandeAchat);
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
    setArticles((data as DAArticle[]) || []);
  };

  const handleSubmit = async () => {
    if (!da) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('demandes_achat')
        .update({
          status: 'soumise',
          submitted_at: new Date().toISOString(),
        })
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

      toast({ title: 'DA rejetée', description: 'La demande a été rejetée.' });
      setShowRejectDialog(false);
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

      toast({ title: 'DA supprimée', description: 'La demande a été supprimée.' });
      navigate('/demandes-achat');
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

  if (!da) return null;

  const StatusIcon = statusIcons[da.status];

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
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
                <h1 className="font-serif text-2xl font-bold text-foreground">
                  {da.reference}
                </h1>
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

        {/* Actions */}
        {canSubmit && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">Prêt à soumettre</p>
                <p className="text-sm text-muted-foreground">
                  Cette DA sera transmise au Service Achats pour traitement.
                </p>
              </div>
              <Button onClick={handleSubmit} disabled={isSaving}>
                <Send className="mr-2 h-4 w-4" />
                Soumettre aux Achats
              </Button>
            </CardContent>
          </Card>
        )}

        {canReject && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">DA en attente de traitement</p>
                <p className="text-sm text-muted-foreground">
                  Vous pouvez rejeter cette demande si elle ne peut être traitée.
                </p>
              </div>
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => setShowRejectDialog(true)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Rejeter
              </Button>
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
            <Link
              to={`/besoins/${da.besoin_id}`}
              className="flex items-center gap-2 text-primary hover:underline"
            >
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
                <Badge
                  className={
                    da.priority === 'urgente'
                      ? 'bg-destructive/10 text-destructive'
                      : da.priority === 'haute'
                      ? 'bg-warning/10 text-warning'
                      : 'bg-muted text-muted-foreground'
                  }
                >
                  {DA_PRIORITY_LABELS[da.priority]}
                </Badge>
              </div>
              {da.desired_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Date souhaitée</p>
                  <p className="font-medium">
                    {format(new Date(da.desired_date), 'dd MMMM yyyy', { locale: fr })}
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
          </CardContent>
        </Card>

        {/* Articles */}
        <Card>
          <CardHeader>
            <CardTitle>Articles / Services ({articles.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {articles.length === 0 ? (
              <p className="text-muted-foreground">Aucun article.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Désignation</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead>Unité</TableHead>
                    <TableHead>Observations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map((art) => (
                    <TableRow key={art.id}>
                      <TableCell className="font-medium">{art.designation}</TableCell>
                      <TableCell className="text-right">{art.quantity}</TableCell>
                      <TableCell>{art.unit}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {art.observations || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter cette DA</DialogTitle>
            <DialogDescription>
              Indiquez le motif du rejet. La Logistique sera notifiée.
            </DialogDescription>
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
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Annuler
            </Button>
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

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette DA ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
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
