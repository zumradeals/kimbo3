import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useEnrichedProfiles } from '@/hooks/useEnrichedProfiles';
import { UserBadge } from '@/components/ui/UserBadge';
import { AmortissementTable } from '@/components/immobilisations/AmortissementTable';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle, Wrench, XCircle, UserCheck, History, Hash, Banknote, MapPin, Package } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon', validee: 'Validée', active: 'Active',
  en_maintenance: 'En maintenance', sortie: 'Sortie', reformee: 'Réformée', cedee: 'Cédée',
};
const STATUS_COLORS: Record<string, string> = {
  brouillon: 'bg-muted text-muted-foreground', validee: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800', en_maintenance: 'bg-yellow-100 text-yellow-800',
  sortie: 'bg-orange-100 text-orange-800', reformee: 'bg-red-100 text-red-800', cedee: 'bg-purple-100 text-purple-800',
};
const ETAT_LABELS: Record<string, string> = {
  neuf: 'Neuf', bon: 'Bon état', use: 'Usé', en_panne: 'En panne', hors_service: 'Hors service',
};
const ACTION_LABELS: Record<string, string> = {
  creation: 'Création', changement_statut: 'Changement de statut', changement_etat: "Changement d'état",
  affectation: 'Affectation', maintenance: 'Maintenance', sortie: 'Sortie', reforme: 'Réforme',
};
const MODE_AMORT_LABELS: Record<string, string> = {
  lineaire: 'Linéaire', degressif: 'Dégressif', non_amortissable: 'Non amortissable',
};

type ImmoEtat = 'neuf' | 'bon' | 'use' | 'en_panne' | 'hors_service';

function ProfileBadge({ userId, profiles, showMatricule = false }: { userId: string; profiles: ReturnType<typeof useEnrichedProfiles>; showMatricule?: boolean }) {
  const p = profiles.getProfile(userId);
  return <UserBadge userId={userId} firstName={p?.first_name} lastName={p?.last_name} matricule={p?.matricule} photoUrl={p?.photo_url} showMatricule={showMatricule} linkToProfile size="sm" />;
}

export default function ImmobilisationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAdmin, roles } = useAuth();
  const [actionDialog, setActionDialog] = useState<string | null>(null);
  const [actionComment, setActionComment] = useState('');
  const [newEtat, setNewEtat] = useState<ImmoEtat>('neuf');
  const [loading, setLoading] = useState(false);

  const canManage = isAdmin || roles.some(r => ['aal', 'responsable_logistique', 'agent_logistique', 'daf'].includes(r as string));

  const { data: immo, isLoading } = useQuery({
    queryKey: ['immobilisation', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('immobilisations')
        .select('*, departments(name)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: history } = useQuery({
    queryKey: ['immobilisation-history', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('immobilisation_history')
        .select('*')
        .eq('immobilisation_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const profileIds = new Set<string>();
  if (immo?.created_by) profileIds.add(immo.created_by);
  if (immo?.validated_by) profileIds.add(immo.validated_by);
  if (immo?.affecte_a) profileIds.add(immo.affecte_a);
  history?.forEach(h => { if (h.performed_by) profileIds.add(h.performed_by); });
  const profiles = useEnrichedProfiles(Array.from(profileIds));

  const handleStatusChange = async (newStatus: string) => {
    if (!user || !immo) return;
    setLoading(true);
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'validee') {
        updateData.validated_by = user.id;
        updateData.validated_at = new Date().toISOString();
      }
      const { error } = await supabase.from('immobilisations').update(updateData).eq('id', immo.id);
      if (error) throw error;
      if (actionComment.trim()) {
        await supabase.from('immobilisation_history').insert({
          immobilisation_id: immo.id, action: 'changement_statut',
          comment: actionComment.trim(), new_values: { status: newStatus },
          performed_by: user.id,
        });
      }
      toast.success(`Statut mis à jour : ${STATUS_LABELS[newStatus]}`);
      queryClient.invalidateQueries({ queryKey: ['immobilisation', id] });
      queryClient.invalidateQueries({ queryKey: ['immobilisation-history', id] });
      setActionDialog(null); setActionComment('');
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handleEtatChange = async () => {
    if (!user || !immo || !newEtat) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('immobilisations').update({ etat: newEtat }).eq('id', immo.id);
      if (error) throw error;
      if (actionComment.trim()) {
        await supabase.from('immobilisation_history').insert({
          immobilisation_id: immo.id, action: 'changement_etat',
          comment: actionComment.trim(), old_values: { etat: immo.etat },
          new_values: { etat: newEtat }, performed_by: user.id,
        });
      }
      toast.success('État mis à jour');
      queryClient.invalidateQueries({ queryKey: ['immobilisation', id] });
      queryClient.invalidateQueries({ queryKey: ['immobilisation-history', id] });
      setActionDialog(null); setActionComment('');
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  if (isLoading) {
    return <AppLayout><div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></AppLayout>;
  }
  if (!immo) {
    return <AppLayout><div className="text-center py-20"><h2 className="text-xl font-bold">Immobilisation introuvable</h2><Button className="mt-4" onClick={() => navigate('/immobilisations')}>Retour à la liste</Button></div></AppLayout>;
  }

  const nextActions: { label: string; status: string; icon: React.ElementType; variant?: any }[] = [];
  if (immo.status === 'brouillon') nextActions.push({ label: 'Valider', status: 'validee', icon: CheckCircle, variant: 'default' });
  if (immo.status === 'validee') nextActions.push({ label: 'Activer', status: 'active', icon: CheckCircle, variant: 'default' });
  if (['active', 'validee'].includes(immo.status)) nextActions.push({ label: 'Mettre en maintenance', status: 'en_maintenance', icon: Wrench, variant: 'outline' });
  if (immo.status === 'en_maintenance') nextActions.push({ label: 'Réactiver', status: 'active', icon: CheckCircle, variant: 'default' });
  if (['active', 'en_maintenance'].includes(immo.status)) {
    nextActions.push({ label: 'Sortir', status: 'sortie', icon: XCircle, variant: 'destructive' });
    nextActions.push({ label: 'Réformer', status: 'reformee', icon: XCircle, variant: 'destructive' });
    nextActions.push({ label: 'Céder', status: 'cedee', icon: UserCheck, variant: 'outline' });
  }

  const dureeVieAnnees = immo.duree_vie_estimee ? Math.round(immo.duree_vie_estimee / 12) : 0;
  const modeAmort = (immo as any).mode_amortissement || 'lineaire';

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/immobilisations')}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-mono">{immo.code}</h1>
                <Badge className={STATUS_COLORS[immo.status]}>{STATUS_LABELS[immo.status]}</Badge>
              </div>
              <p className="text-lg text-foreground">{immo.designation}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        {canManage && nextActions.length > 0 && (
          <Card>
            <CardContent className="flex flex-wrap gap-2 py-4">
              {nextActions.map(a => (
                <Button key={a.status} variant={a.variant} size="sm" onClick={() => setActionDialog(a.status)}>
                  <a.icon className="mr-1.5 h-4 w-4" />{a.label}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={() => { setNewEtat(immo.etat as ImmoEtat); setActionDialog('etat'); }}>
                <Wrench className="mr-1.5 h-4 w-4" />Modifier l'état
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Hash className="h-4 w-4" />Identification</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Code</span><span className="font-mono font-medium">{immo.code}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{immo.type === 'corporel' ? '🏗️ Corporel' : '💻 Incorporel'}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Classe comptable</span><span>Classe {immo.classe_comptable}</span></div>
              {immo.category && <><Separator /><div className="flex justify-between"><span className="text-muted-foreground">Catégorie</span><span>{immo.category}</span></div></>}
              {immo.numero_serie && <><Separator /><div className="flex justify-between"><span className="text-muted-foreground">N° série</span><span className="font-mono">{immo.numero_serie}</span></div></>}
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">État</span><Badge variant="outline">{ETAT_LABELS[immo.etat]}</Badge></div>
              {dureeVieAnnees > 0 && <><Separator /><div className="flex justify-between"><span className="text-muted-foreground">Durée de vie</span><span>{dureeVieAnnees} an{dureeVieAnnees > 1 ? 's' : ''}</span></div></>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Banknote className="h-4 w-4" />Acquisition & Amortissement</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{new Date(immo.date_acquisition).toLocaleDateString('fr-FR')}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Mode acquisition</span><span className="capitalize">{immo.mode_acquisition?.replace('_', ' ')}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Valeur</span><span className="font-bold text-base">{(immo.valeur_acquisition || 0).toLocaleString('fr-FR')} {immo.devise}</span></div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Mode amortissement</span>
                <Badge variant="outline">{MODE_AMORT_LABELS[modeAmort] || modeAmort}</Badge>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Observation</span>
                <Badge variant={modeAmort !== 'non_amortissable' ? 'secondary' : 'outline'}>
                  {modeAmort !== 'non_amortissable' ? 'Amortissable' : 'Non amortissable'}
                </Badge>
              </div>
              {immo.da_id && <><Separator /><div className="flex justify-between"><span className="text-muted-foreground">DA source</span><Link to={`/demandes-achat/${immo.da_id}`} className="text-primary hover:underline">Voir la DA</Link></div></>}
              {immo.article_stock_id && <><Separator /><div className="flex justify-between"><span className="text-muted-foreground">Article stock</span><Link to={`/stock/${immo.article_stock_id}`} className="text-primary hover:underline">Voir l'article</Link></div></>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" />Localisation & Affectation</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {immo.emplacement && <><div className="flex justify-between"><span className="text-muted-foreground">Emplacement</span><span>{immo.emplacement}</span></div><Separator /></>}
              <div className="flex justify-between"><span className="text-muted-foreground">Département</span><span>{(immo as any).departments?.name || '—'}</span></div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Affecté à</span>
                {immo.affecte_a ? <ProfileBadge userId={immo.affecte_a} profiles={profiles} showMatricule /> : <span className="text-muted-foreground">Non affecté</span>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" />Traçabilité</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Créé par</span>
                <ProfileBadge userId={immo.created_by} profiles={profiles} showMatricule />
              </div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Créé le</span><span>{new Date(immo.created_at).toLocaleDateString('fr-FR')}</span></div>
              {immo.validated_by && <><Separator /><div className="flex justify-between items-center"><span className="text-muted-foreground">Validé par</span><ProfileBadge userId={immo.validated_by} profiles={profiles} showMatricule /></div></>}
              {immo.validated_at && <><Separator /><div className="flex justify-between"><span className="text-muted-foreground">Validé le</span><span>{new Date(immo.validated_at).toLocaleDateString('fr-FR')}</span></div></>}
            </CardContent>
          </Card>
        </div>

        {/* Description */}
        {immo.description && (
          <Card>
            <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap">{immo.description}</p></CardContent>
          </Card>
        )}

        {/* Tableau d'amortissement */}
        <AmortissementTable
          valeurAcquisition={immo.valeur_acquisition || 0}
          dureeVieAnnees={dureeVieAnnees}
          dateAcquisition={immo.date_acquisition}
          dateDebutExercice={(immo as any).date_debut_exercice || undefined}
          moisAcquisition={(immo as any).mois_acquisition || undefined}
          mode={modeAmort}
          devise={immo.devise}
        />

        {/* History */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" />Historique</CardTitle></CardHeader>
          <CardContent>
            {!history || history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun historique</p>
            ) : (
              <div className="space-y-4">
                {history.map(h => (
                  <div key={h.id} className="flex gap-3 border-l-2 border-muted pl-4 pb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{ACTION_LABELS[h.action] || h.action}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString('fr-FR')}</span>
                      </div>
                      <div className="mt-1">
                        <ProfileBadge userId={h.performed_by} profiles={profiles} showMatricule />
                      </div>
                      {h.comment && <p className="text-sm mt-1 text-muted-foreground italic">"{h.comment}"</p>}
                      {h.new_values && (
                        <div className="text-xs mt-1 text-muted-foreground">
                          {(h.new_values as any).status && <span>→ {STATUS_LABELS[(h.new_values as any).status] || (h.new_values as any).status}</span>}
                          {(h.new_values as any).etat && <span>→ {ETAT_LABELS[(h.new_values as any).etat] || (h.new_values as any).etat}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Change Dialog */}
      <Dialog open={!!actionDialog && actionDialog !== 'etat'} onOpenChange={() => { setActionDialog(null); setActionComment(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmer : {actionDialog ? STATUS_LABELS[actionDialog] : ''}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Commentaire (optionnel)</Label>
            <Textarea value={actionComment} onChange={e => setActionComment(e.target.value)} placeholder="Raison ou observations..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Annuler</Button>
            <Button onClick={() => handleStatusChange(actionDialog!)} disabled={loading}>{loading ? 'En cours...' : 'Confirmer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Etat Change Dialog */}
      <Dialog open={actionDialog === 'etat'} onOpenChange={() => { setActionDialog(null); setActionComment(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier l'état du bien</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nouvel état</Label>
              <Select value={newEtat} onValueChange={v => setNewEtat(v as ImmoEtat)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ETAT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Commentaire</Label>
              <Textarea value={actionComment} onChange={e => setActionComment(e.target.value)} placeholder="Raison du changement..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Annuler</Button>
            <Button onClick={handleEtatChange} disabled={loading || !newEtat}>{loading ? 'En cours...' : 'Mettre à jour'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
