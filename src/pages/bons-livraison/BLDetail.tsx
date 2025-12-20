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
  AlertTriangle,
  XCircle,
  PackageCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const statusColors: Record<BLStatus, string> = {
  prepare: 'bg-muted text-muted-foreground',
  en_attente_validation: 'bg-warning/10 text-warning border-warning/20',
  valide: 'bg-primary/10 text-primary border-primary/20',
  livre: 'bg-success/10 text-success border-success/20',
  livree_partiellement: 'bg-warning/10 text-warning border-warning/20',
  refusee: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusIcons: Record<BLStatus, React.ElementType> = {
  prepare: Clock,
  en_attente_validation: FileCheck,
  valide: CheckCircle,
  livre: Truck,
  livree_partiellement: AlertTriangle,
  refusee: XCircle,
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
  const [deliveryArticles, setDeliveryArticles] = useState<DeliveryFormArticle[]>([]);

  const isLogistics = roles.some((r) => LOGISTICS_ROLES.includes(r));

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
        livree_partiellement: 'Livraison partielle enregistrée',
        refusee: 'BL refusé',
      };

      toast({ title: 'Statut mis à jour', description: messages[newStatus] });
      fetchBL();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
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
    setIsSaving(true);

    try {
      // Update each article with delivered quantities
      for (const art of deliveryArticles) {
        await supabase
          .from('bl_articles')
          .update({
            quantity_delivered: art.quantity_delivered,
            ecart_reason: art.ecart_reason || null,
          })
          .eq('id', art.id);
      }

      // Determine if full or partial delivery
      const isPartial = deliveryArticles.some(
        (art) => art.quantity_delivered < art.quantity_ordered
      );

      // Update BL status
      const newStatus: BLStatus = isPartial ? 'livree_partiellement' : 'livre';
      const { error } = await supabase
        .from('bons_livraison')
        .update({
          status: newStatus,
          delivered_by: user.id,
          delivered_at: new Date().toISOString(),
        })
        .eq('id', bl.id);

      if (error) throw error;

      // Create stock movements for delivered items
      for (const art of deliveryArticles) {
        if (art.quantity_delivered > 0) {
          const originalArticle = articles.find((a) => a.id === art.id);
          if (originalArticle?.article_stock_id) {
            // Get current stock quantity
            const { data: stockData } = await supabase
              .from('articles_stock')
              .select('quantity_available')
              .eq('id', originalArticle.article_stock_id)
              .single();

            if (stockData) {
              const quantityBefore = stockData.quantity_available;
              const quantityAfter = quantityBefore - art.quantity_delivered;

              // Create stock movement
              await supabase.from('stock_movements').insert({
                article_stock_id: originalArticle.article_stock_id,
                movement_type: 'sortie',
                quantity: art.quantity_delivered,
                quantity_before: quantityBefore,
                quantity_after: quantityAfter,
                bl_id: bl.id,
                reference: bl.reference,
                observations: `Livraison BL ${bl.reference}`,
                created_by: user.id,
              });

              // Update stock quantity
              await supabase
                .from('articles_stock')
                .update({ quantity_available: quantityAfter })
                .eq('id', originalArticle.article_stock_id);
            }
          }
        }
      }

      toast({
        title: isPartial ? 'Livraison partielle' : 'Livraison complète',
        description: isPartial
          ? 'La livraison partielle a été enregistrée. Le stock a été mis à jour.'
          : 'La livraison a été confirmée. Le stock a été mis à jour.',
      });

      setShowDeliveryDialog(false);
      fetchBL();
      fetchArticles();
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
                  Confirmez la livraison une fois effectuée. Vous pourrez indiquer les quantités réellement livrées.
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={openDeliveryDialog} disabled={isSaving}>
                  <PackageCheck className="mr-2 h-4 w-4" />
                  Enregistrer livraison
                </Button>
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
              <div>
                <p className="text-sm text-muted-foreground">Type de livraison</p>
                <p className="font-medium">{bl.bl_type === 'interne' ? 'Interne (stock)' : 'Fournisseur'}</p>
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
                        <TableCell className="text-right font-mono">
                          {delivered > 0 ? delivered : '-'}
                          {hasEcart && (
                            <AlertTriangle className="ml-2 inline h-4 w-4 text-warning" />
                          )}
                        </TableCell>
                        <TableCell>{art.unit}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {art.ecart_reason || (art.observations || '-')}
                        </TableCell>
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

      {/* Delivery Dialog */}
      <Dialog open={showDeliveryDialog} onOpenChange={setShowDeliveryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enregistrer la livraison</DialogTitle>
            <DialogDescription>
              Indiquez les quantités réellement livrées pour chaque article.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto py-4">
            <div className="space-y-4">
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
                      <Input
                        type="number"
                        min={0}
                        max={art.quantity_ordered}
                        value={art.quantity_delivered}
                        onChange={(e) => {
                          const newArticles = [...deliveryArticles];
                          newArticles[index].quantity_delivered = Number(e.target.value);
                          setDeliveryArticles(newArticles);
                        }}
                      />
                    </div>
                  </div>
                  {art.quantity_delivered < art.quantity_ordered && (
                    <div className="mt-3 space-y-2">
                      <Label className="flex items-center gap-2 text-warning">
                        <AlertTriangle className="h-4 w-4" />
                        Motif de l'écart
                      </Label>
                      <Textarea
                        placeholder="Expliquez la raison de l'écart..."
                        value={art.ecart_reason}
                        onChange={(e) => {
                          const newArticles = [...deliveryArticles];
                          newArticles[index].ecart_reason = e.target.value;
                          setDeliveryArticles(newArticles);
                        }}
                        rows={2}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeliveryDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleDelivery} disabled={isSaving}>
              {isSaving ? 'Enregistrement...' : 'Confirmer la livraison'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
