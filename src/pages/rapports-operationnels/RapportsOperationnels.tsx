import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  FileText, Plus, Send, CheckCircle, XCircle, Clock, TrendingUp,
  Package, ClipboardList, AlertTriangle, BarChart3, Printer,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Rapport {
  id: string;
  titre: string;
  contenu: string | null;
  type: string;
  periode_debut: string;
  periode_fin: string;
  status: string;
  created_by: string;
  created_at: string;
  submitted_at: string | null;
  validated_by: string | null;
  validated_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  validation_comment: string | null;
  donnees_kpi: Record<string, any>;
}

interface KPIStats {
  da: { total: number; montantTotal: number; delaiMoyen: number; byStatus: Record<string, number> };
  bl: { total: number; livres: number; partiels: number; enAttente: number; tauxCompletion: number };
  fournisseurs: { total: number; topFournisseurs: { name: string; daCount: number }[] };
  stock: { totalArticles: number; stockBas: number; ruptures: number };
}

const STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  soumis: 'Soumis à l\'AAL',
  valide: 'Validé',
  rejete: 'Rejeté',
};

const STATUS_COLORS: Record<string, string> = {
  brouillon: 'bg-muted text-muted-foreground',
  soumis: 'bg-warning/10 text-warning border-warning/20',
  valide: 'bg-success/10 text-success border-success/20',
  rejete: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function RapportsOperationnels() {
  const { user, roles, isAdmin } = useAuth();
  const { toast } = useToast();
  const [rapports, setRapports] = useState<Rapport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedRapport, setSelectedRapport] = useState<Rapport | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [kpiStats, setKpiStats] = useState<KPIStats | null>(null);
  const [isLoadingKPI, setIsLoadingKPI] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [validationComment, setValidationComment] = useState('');

  const [form, setForm] = useState({
    titre: '',
    type: 'mensuel',
    periode_debut: startOfMonth(new Date()).toISOString().split('T')[0],
    periode_fin: endOfMonth(new Date()).toISOString().split('T')[0],
    contenu: '',
  });

  const isLogistics = roles.some(r => ['responsable_logistique', 'agent_logistique'].includes(r));
  const isAchats = roles.some(r => ['responsable_achats', 'agent_achats'].includes(r));
  const isAAL = roles.includes('aal');
  const canCreate = isLogistics || isAchats || isAdmin;
  const canValidate = isAAL || isAdmin;
  const hasAccess = canCreate || canValidate;

  useEffect(() => {
    if (hasAccess) fetchRapports();
  }, [hasAccess]);

  const fetchRapports = async () => {
    try {
      const { data, error } = await supabase
        .from('rapports_operationnels')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRapports((data as Rapport[]) || []);
    } catch (error: any) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchKPIForPeriod = async (debut: string, fin: string) => {
    setIsLoadingKPI(true);
    try {
      const [
        { data: das },
        { data: bls },
        { data: stock },
        { data: fournisseurs },
      ] = await Promise.all([
        supabase.from('demandes_achat').select('id, status, total_amount, created_at, submitted_at').gte('created_at', debut).lte('created_at', fin),
        supabase.from('bons_livraison').select('id, status').gte('created_at', debut).lte('created_at', fin),
        supabase.from('articles_stock').select('id, quantity_available, quantity_min'),
        supabase.from('fournisseurs').select('id, name').eq('is_active', true),
      ]);

      const daByStatus: Record<string, number> = {};
      let montantTotal = 0;
      let delaiTotal = 0;
      let delaiCount = 0;
      (das || []).forEach(da => {
        daByStatus[da.status] = (daByStatus[da.status] || 0) + 1;
        if (da.total_amount) montantTotal += da.total_amount;
        if (da.submitted_at && da.created_at) {
          const days = Math.floor((new Date(da.submitted_at).getTime() - new Date(da.created_at).getTime()) / 86400000);
          if (days >= 0) { delaiTotal += days; delaiCount++; }
        }
      });

      const blStats = {
        total: (bls || []).length,
        livres: (bls || []).filter(b => b.status === 'livre').length,
        partiels: (bls || []).filter(b => b.status === 'livree_partiellement').length,
        enAttente: (bls || []).filter(b => ['prepare', 'en_attente_validation', 'valide'].includes(b.status)).length,
        tauxCompletion: 0,
      };
      if (blStats.total > 0) {
        blStats.tauxCompletion = Math.round(((blStats.livres + blStats.partiels) / blStats.total) * 100);
      }

      // Count DA per fournisseur
      const fournisseurDACounts: Record<string, number> = {};
      for (const f of (fournisseurs || []).slice(0, 10)) {
        const { count } = await supabase
          .from('demandes_achat')
          .select('*', { count: 'exact', head: true })
          .eq('selected_fournisseur_id', f.id)
          .gte('created_at', debut)
          .lte('created_at', fin);
        fournisseurDACounts[f.id] = count || 0;
      }

      const topFournisseurs = (fournisseurs || [])
        .map(f => ({ name: f.name, daCount: fournisseurDACounts[f.id] || 0 }))
        .filter(f => f.daCount > 0)
        .sort((a, b) => b.daCount - a.daCount)
        .slice(0, 5);

      const stats: KPIStats = {
        da: {
          total: (das || []).length,
          montantTotal,
          delaiMoyen: delaiCount > 0 ? Math.round(delaiTotal / delaiCount) : 0,
          byStatus: daByStatus,
        },
        bl: blStats,
        fournisseurs: { total: (fournisseurs || []).length, topFournisseurs },
        stock: {
          totalArticles: (stock || []).length,
          stockBas: (stock || []).filter(s => s.quantity_min && s.quantity_available <= s.quantity_min && s.quantity_available > 0).length,
          ruptures: (stock || []).filter(s => s.quantity_available <= 0).length,
        },
      };

      setKpiStats(stats);
    } catch (error: any) {
      console.error('Error fetching KPI:', error);
    } finally {
      setIsLoadingKPI(false);
    }
  };

  const handleCreate = async () => {
    if (!form.titre.trim() || !user) return;
    setIsSaving(true);
    try {
      // Fetch KPI data for the period
      await fetchKPIForPeriod(form.periode_debut, form.periode_fin);

      const { error } = await supabase.from('rapports_operationnels').insert({
        titre: form.titre.trim(),
        contenu: form.contenu.trim() || null,
        type: form.type,
        periode_debut: form.periode_debut,
        periode_fin: form.periode_fin,
        created_by: user.id,
        donnees_kpi: kpiStats || {},
      });

      if (error) throw error;
      toast({ title: 'Rapport créé', description: 'Le rapport a été créé en brouillon.' });
      setShowCreateDialog(false);
      setForm({ titre: '', type: 'mensuel', periode_debut: startOfMonth(new Date()).toISOString().split('T')[0], periode_fin: endOfMonth(new Date()).toISOString().split('T')[0], contenu: '' });
      fetchRapports();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (rapport: Rapport) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('rapports_operationnels')
        .update({ status: 'soumis', submitted_at: new Date().toISOString() })
        .eq('id', rapport.id);
      if (error) throw error;
      toast({ title: 'Rapport soumis', description: 'Le rapport a été transmis à l\'AAL pour validation.' });
      fetchRapports();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidate = async () => {
    if (!selectedRapport || !user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('rapports_operationnels')
        .update({
          status: 'valide',
          validated_by: user.id,
          validated_at: new Date().toISOString(),
          validation_comment: validationComment.trim() || null,
        })
        .eq('id', selectedRapport.id);
      if (error) throw error;
      toast({ title: 'Rapport validé' });
      setShowDetailDialog(false);
      setValidationComment('');
      fetchRapports();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRapport || !user || !rejectionReason.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('rapports_operationnels')
        .update({
          status: 'rejete',
          rejected_by: user.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: rejectionReason.trim(),
        })
        .eq('id', selectedRapport.id);
      if (error) throw error;
      toast({ title: 'Rapport rejeté' });
      setShowRejectDialog(false);
      setRejectionReason('');
      fetchRapports();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('rapports_operationnels').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Rapport supprimé' });
      fetchRapports();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  const formatMontant = (v: number) =>
    new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(Math.ceil(v)) + ' FCFA';

  const openDetail = (r: Rapport) => {
    setSelectedRapport(r);
    setShowDetailDialog(true);
  };

  if (!hasAccess) {
    return (
      <AppLayout>
        <AccessDenied message="Accès réservé aux rôles Achats, Logistique et AAL." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Rapports Opérationnels
            </h1>
            <p className="text-muted-foreground">
              {canCreate ? 'Créez et soumettez vos rapports à l\'AAL' : 'Validez les rapports Achats & Logistique'}
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => { setShowCreateDialog(true); fetchKPIForPeriod(form.periode_debut, form.periode_fin); }}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau rapport
            </Button>
          )}
        </div>

        {/* KPI Summary for creators */}
        {canCreate && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-primary">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{rapports.filter(r => r.status === 'brouillon').length}</p>
                    <p className="text-sm text-muted-foreground">Brouillons</p>
                  </div>
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-warning">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{rapports.filter(r => r.status === 'soumis').length}</p>
                    <p className="text-sm text-muted-foreground">En attente AAL</p>
                  </div>
                  <Send className="h-8 w-8 text-warning" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-success">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{rapports.filter(r => r.status === 'valide').length}</p>
                    <p className="text-sm text-muted-foreground">Validés</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-success" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-destructive">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{rapports.filter(r => r.status === 'rejete').length}</p>
                    <p className="text-sm text-muted-foreground">Rejetés</p>
                  </div>
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Rapports list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {canValidate && !canCreate ? 'Rapports à valider' : 'Mes rapports'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : rapports.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4" />
                <p>Aucun rapport</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titre</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rapports.map(r => (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-accent/5" onClick={() => openDetail(r)}>
                      <TableCell className="font-medium">{r.titre}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{r.type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(r.periode_debut), 'dd MMM', { locale: fr })} - {format(new Date(r.periode_fin), 'dd MMM yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(r.created_at), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                          {r.status === 'brouillon' && r.created_by === user?.id && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleSubmit(r)} disabled={isSaving}>
                                <Send className="mr-1 h-3 w-3" /> Soumettre
                              </Button>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(r.id)}>
                                Supprimer
                              </Button>
                            </>
                          )}
                          {r.status === 'soumis' && canValidate && (
                            <Button size="sm" variant="outline" onClick={() => openDetail(r)}>
                              Examiner
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouveau rapport opérationnel</DialogTitle>
              <DialogDescription>
                Les KPIs seront automatiquement calculés pour la période sélectionnée.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Titre du rapport *</Label>
                <Input value={form.titre} onChange={e => setForm(p => ({ ...p, titre: e.target.value }))} placeholder="Ex: Rapport mensuel Logistique - Janvier 2026" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensuel">Mensuel</SelectItem>
                      <SelectItem value="hebdomadaire">Hebdomadaire</SelectItem>
                      <SelectItem value="trimestriel">Trimestriel</SelectItem>
                      <SelectItem value="ponctuel">Ponctuel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Début période *</Label>
                  <Input type="date" value={form.periode_debut} onChange={e => { setForm(p => ({ ...p, periode_debut: e.target.value })); fetchKPIForPeriod(e.target.value, form.periode_fin); }} />
                </div>
                <div className="space-y-2">
                  <Label>Fin période *</Label>
                  <Input type="date" value={form.periode_fin} onChange={e => { setForm(p => ({ ...p, periode_fin: e.target.value })); fetchKPIForPeriod(form.periode_debut, e.target.value); }} />
                </div>
              </div>

              {/* KPI Preview */}
              {kpiStats && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Aperçu KPIs période</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-3 w-3 text-primary" />
                        <span>{kpiStats.da.total} DA • {formatMontant(kpiStats.da.montantTotal)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="h-3 w-3 text-primary" />
                        <span>{kpiStats.bl.total} BL • {kpiStats.bl.tauxCompletion}% complétés</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-3 w-3 text-primary" />
                        <span>Délai moyen: {kpiStats.da.delaiMoyen}j</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3 text-warning" />
                        <span>{kpiStats.stock.stockBas} stock bas • {kpiStats.stock.ruptures} ruptures</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                <Label>Observations / Commentaires</Label>
                <Textarea value={form.contenu} onChange={e => setForm(p => ({ ...p, contenu: e.target.value }))} placeholder="Points clés, recommandations..." rows={4} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={isSaving || !form.titre.trim()}>
                {isSaving ? 'Création...' : 'Créer le rapport'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail / Validation Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {selectedRapport && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {selectedRapport.titre}
                  </DialogTitle>
                  <DialogDescription>
                    {format(new Date(selectedRapport.periode_debut), 'dd MMM yyyy', { locale: fr })} — {format(new Date(selectedRapport.periode_fin), 'dd MMM yyyy', { locale: fr })}
                    <Badge className={`ml-2 ${STATUS_COLORS[selectedRapport.status]}`}>{STATUS_LABELS[selectedRapport.status]}</Badge>
                  </DialogDescription>
                </DialogHeader>

                {/* KPI Data */}
                {selectedRapport.donnees_kpi && Object.keys(selectedRapport.donnees_kpi).length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-medium text-sm text-muted-foreground uppercase">Indicateurs clés</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedRapport.donnees_kpi.da && (
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground">Demandes d'achat</p>
                            <p className="text-lg font-bold">{selectedRapport.donnees_kpi.da.total}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatMontant(selectedRapport.donnees_kpi.da.montantTotal || 0)} • {selectedRapport.donnees_kpi.da.delaiMoyen || 0}j délai moyen
                            </p>
                          </CardContent>
                        </Card>
                      )}
                      {selectedRapport.donnees_kpi.bl && (
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground">Bons de livraison</p>
                            <p className="text-lg font-bold">{selectedRapport.donnees_kpi.bl.total}</p>
                            <p className="text-xs text-muted-foreground">
                              {selectedRapport.donnees_kpi.bl.tauxCompletion || 0}% complétés
                            </p>
                          </CardContent>
                        </Card>
                      )}
                      {selectedRapport.donnees_kpi.fournisseurs && (
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground">Fournisseurs actifs</p>
                            <p className="text-lg font-bold">{selectedRapport.donnees_kpi.fournisseurs.total}</p>
                          </CardContent>
                        </Card>
                      )}
                      {selectedRapport.donnees_kpi.stock && (
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground">Alertes stock</p>
                            <p className="text-lg font-bold text-warning">{(selectedRapport.donnees_kpi.stock.stockBas || 0) + (selectedRapport.donnees_kpi.stock.ruptures || 0)}</p>
                            <p className="text-xs text-muted-foreground">
                              {selectedRapport.donnees_kpi.stock.stockBas || 0} bas • {selectedRapport.donnees_kpi.stock.ruptures || 0} ruptures
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    {/* Top Fournisseurs */}
                    {selectedRapport.donnees_kpi.fournisseurs?.topFournisseurs?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Top fournisseurs</p>
                        <div className="space-y-1">
                          {selectedRapport.donnees_kpi.fournisseurs.topFournisseurs.map((f: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span>{f.name}</span>
                              <Badge variant="outline" className="text-xs">{f.daCount} DA</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedRapport.contenu && (
                  <div>
                    <h3 className="font-medium text-sm text-muted-foreground uppercase mb-2">Observations</h3>
                    <p className="text-sm whitespace-pre-wrap">{selectedRapport.contenu}</p>
                  </div>
                )}

                {selectedRapport.rejection_reason && (
                  <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="py-3">
                      <p className="text-sm font-medium text-destructive">Motif du rejet</p>
                      <p className="text-sm">{selectedRapport.rejection_reason}</p>
                    </CardContent>
                  </Card>
                )}

                {selectedRapport.validation_comment && (
                  <Card className="border-success/50 bg-success/5">
                    <CardContent className="py-3">
                      <p className="text-sm font-medium text-success">Commentaire de validation</p>
                      <p className="text-sm">{selectedRapport.validation_comment}</p>
                    </CardContent>
                  </Card>
                )}

                {/* AAL Validation Actions */}
                {canValidate && selectedRapport.status === 'soumis' && (
                  <div className="space-y-3 border-t pt-4">
                    <div className="space-y-2">
                      <Label>Commentaire (optionnel)</Label>
                      <Textarea value={validationComment} onChange={e => setValidationComment(e.target.value)} placeholder="Commentaire de validation..." rows={2} />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleValidate} disabled={isSaving} className="flex-1">
                        <CheckCircle className="mr-2 h-4 w-4" /> Valider
                      </Button>
                      <Button variant="destructive" onClick={() => { setShowDetailDialog(false); setShowRejectDialog(true); }} className="flex-1">
                        <XCircle className="mr-2 h-4 w-4" /> Rejeter
                      </Button>
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={() => window.print()}>
                    <Printer className="mr-2 h-4 w-4" /> Imprimer
                  </Button>
                  <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Fermer</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeter le rapport</DialogTitle>
              <DialogDescription>Indiquez le motif du rejet.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Motif du rejet *</Label>
              <Textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="Expliquez les points à corriger..." rows={3} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Annuler</Button>
              <Button variant="destructive" onClick={handleReject} disabled={isSaving || !rejectionReason.trim()}>
                Confirmer le rejet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
