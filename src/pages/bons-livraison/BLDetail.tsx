import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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
  BonLivraison,
  BLArticle,
  BL_STATUS_LABELS,
  BLStatus,
  LOGISTICS_ROLES,
} from '@/types/kpm';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  Truck,
  FileCheck,
  Trash2,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const statusColors: Record<BLStatus, string> = {
  prepare: 'bg-muted text-muted-foreground',
  en_attente_validation: 'bg-warning/10 text-warning border-warning/20',
  valide: 'bg-primary/10 text-primary border-primary/20',
  livre: 'bg-success/10 text-success border-success/20',
};

const statusIcons: Record<BLStatus, React.ElementType> = {
  prepare: Clock,
  en_attente_validation: FileCheck,
  valide: CheckCircle,
  livre: Truck,
};

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

  const isLogistics = roles.some((r) => LOGISTICS_ROLES.includes(r));
  const isDG = roles.includes('dg');

  const canValidate = (isLogistics || isAdmin) && bl?.status === 'en_attente_validation';
  const canDeliver = (isLogistics || isAdmin) && bl?.status === 'valide';
  const canRequestValidation = (isLogistics || isAdmin) && bl?.status === 'prepare';
  const canDelete = isAdmin;

  useEffect(() => {
    if (id) {
      fetchBL();
      fetchArticles();
    }
  }, [id]);

  const fetchBL = async () => {
    try {
      const { data, error } = await supabase
        .from('bons_livraison')
        .select(`
          *,
          department:departments(id, name),
          created_by_profile:profiles!bons_livraison_created_by_fkey(id, first_name, last_name),
          validated_by_profile:profiles!bons_livraison_validated_by_fkey(id, first_name, last_name),
          delivered_by_profile:profiles!bons_livraison_delivered_by_fkey(id, first_name, last_name),
          besoin:besoins(id, title)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        toast({ title: 'Erreur', description: 'BL introuvable.', variant: 'destructive' });
        navigate('/bons-livraison');
        return;
      }

      setBL(data as BonLivraison);
    } catch (error: any) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchArticles = async () => {
    const { data } = await supabase
      .from('bl_articles')
      .select('*')
      .eq('bl_id', id)
      .order('created_at');
    setArticles((data as BLArticle[]) || []);
  };

  const updateStatus = async (newStatus: BLStatus) => {
    if (!bl) return;
    setIsSaving(true);

    try {
      const updates: any = { status: newStatus };

      if (newStatus === 'valide') {
        updates.validated_by = user?.id;
        updates.validated_at = new Date().toISOString();
      } else if (newStatus === 'livre') {
        updates.delivered_by = user?.id;
        updates.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('bons_livraison')
        .update(updates)
        .eq('id', bl.id);

      if (error) throw error;

      const messages: Record<BLStatus, string> = {
        prepare: 'BL en préparation',
        en_attente_validation: 'BL soumis à validation',
        valide: 'BL validé',
        livre: 'Livraison confirmée',
      };

      toast({ title: 'Statut mis à jour', description: messages[newStatus] });
      fetchBL();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!bl) return;
    setIsSaving(true);

    try {
      const { error } = await supabase.from('bons_livraison').delete().eq('id', bl.id);
      if (error) throw error;

      toast({ title: 'BL supprimé', description: 'Le bon de livraison a été supprimé.' });
      navigate('/bons-livraison');
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

  if (!bl) return null;

  const StatusIcon = statusIcons[bl.status];

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/bons-livraison">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-2xl font-bold text-foreground">
                  {bl.reference}
                </h1>
                <Badge className={statusColors[bl.status]}>
                  <StatusIcon className="mr-1 h-3 w-3" />
                  {BL_STATUS_LABELS[bl.status]}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Créé le {format(new Date(bl.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
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

        {/* Actions */}
        {canRequestValidation && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">BL en préparation</p>
                <p className="text-sm text-muted-foreground">
                  Soumettez ce BL à validation lorsqu'il est prêt.
                </p>
              </div>
              <Button onClick={() => updateStatus('en_attente_validation')} disabled={isSaving}>
                <FileCheck className="mr-2 h-4 w-4" />
                Soumettre à validation
              </Button>
            </CardContent>
          </Card>
        )}

        {canValidate && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">Validation requise</p>
                <p className="text-sm text-muted-foreground">
                  Validez ce BL pour autoriser la livraison.
                </p>
              </div>
              <Button onClick={() => updateStatus('valide')} disabled={isSaving}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Valider
              </Button>
            </CardContent>
          </Card>
        )}

        {canDeliver && (
          <Card className="border-success/50 bg-success/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">Prêt pour livraison</p>
                <p className="text-sm text-muted-foreground">
                  Confirmez la livraison une fois effectuée.
                </p>
              </div>
              <Button onClick={() => updateStatus('livre')} disabled={isSaving}>
                <Truck className="mr-2 h-4 w-4" />
                Confirmer la livraison
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
              to={`/besoins/${bl.besoin_id}`}
              className="flex items-center gap-2 text-primary hover:underline"
            >
              {(bl.besoin as any)?.title || 'Voir le besoin'}
              <ExternalLink className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle>Détails du bon</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Département</p>
                <p className="font-medium">{bl.department?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Créé par</p>
                <p className="font-medium">
                  {bl.created_by_profile?.first_name} {bl.created_by_profile?.last_name}
                </p>
              </div>
              {bl.warehouse && (
                <div>
                  <p className="text-sm text-muted-foreground">Magasin / Dépôt</p>
                  <p className="font-medium">{bl.warehouse}</p>
                </div>
              )}
              {bl.delivery_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Date de livraison prévue</p>
                  <p className="font-medium">
                    {format(new Date(bl.delivery_date), 'dd MMMM yyyy', { locale: fr })}
                  </p>
                </div>
              )}
            </div>

            {bl.observations && (
              <div>
                <p className="mb-2 text-sm text-muted-foreground">Observations</p>
                <p className="whitespace-pre-wrap text-foreground">{bl.observations}</p>
              </div>
            )}

            {bl.validated_by_profile && (
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground">Validé par</p>
                <p className="font-medium">
                  {bl.validated_by_profile.first_name} {bl.validated_by_profile.last_name}
                  {bl.validated_at && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      le {format(new Date(bl.validated_at), 'dd MMM yyyy', { locale: fr })}
                    </span>
                  )}
                </p>
              </div>
            )}

            {bl.delivered_by_profile && (
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground">Livré par</p>
                <p className="font-medium">
                  {bl.delivered_by_profile.first_name} {bl.delivered_by_profile.last_name}
                  {bl.delivered_at && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      le {format(new Date(bl.delivered_at), 'dd MMM yyyy', { locale: fr })}
                    </span>
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Articles */}
        <Card>
          <CardHeader>
            <CardTitle>Articles ({articles.length})</CardTitle>
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

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce BL ?</AlertDialogTitle>
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
