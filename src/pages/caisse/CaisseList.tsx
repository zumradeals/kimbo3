import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Search, Wallet, Edit, Trash2, Eye, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { AccessDenied } from '@/components/ui/AccessDenied';

interface Caisse {
  id: string;
  code: string;
  name: string;
  type: string;
  responsable_id: string | null;
  solde_initial: number;
  solde_actuel: number;
  devise: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  responsable?: {
    first_name: string | null;
    last_name: string | null;
  };
}

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

const TYPE_LABELS: Record<string, string> = {
  principale: 'Principale',
  logistique: 'Logistique',
  chantier: 'Chantier',
  projet: 'Projet',
};

const TYPE_COLORS: Record<string, string> = {
  principale: 'bg-primary/20 text-primary',
  logistique: 'bg-blue-500/20 text-blue-700',
  chantier: 'bg-orange-500/20 text-orange-700',
  projet: 'bg-green-500/20 text-green-700',
};

export default function CaisseList() {
  const navigate = useNavigate();
  const { user, roles, isLoading: authLoading } = useAuth();
  const [caisses, setCaisses] = useState<Caisse[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCaisse, setEditingCaisse] = useState<Caisse | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'principale',
      responsable_id: '',
      solde_initial: 0,
      devise: 'XOF',
      description: '',
    });

  const canManage = roles.some(r => ['admin', 'daf'].includes(r));
  const canView = roles.some(r => ['admin', 'daf', 'dg', 'comptable'].includes(r));

  useEffect(() => {
    if (!authLoading && canView) {
      fetchCaisses();
      fetchProfiles();
    }
  }, [authLoading, canView]);

  const fetchCaisses = async () => {
    try {
      const { data, error } = await supabase
        .from('caisses')
        .select('*')
        .order('type', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;

      // Fetch responsable info
      const responsableIds = data?.filter(c => c.responsable_id).map(c => c.responsable_id) || [];
      if (responsableIds.length > 0) {
        const { data: profilesData } = await supabase.rpc('get_public_profiles', {
          _user_ids: responsableIds,
        });
        
        const profilesMap = new Map(profilesData?.map((p: any) => [p.id, p]));
        const caissesWithResponsables = data?.map(c => ({
          ...c,
          responsable: c.responsable_id ? profilesMap.get(c.responsable_id) : null,
        }));
        setCaisses(caissesWithResponsables || []);
      } else {
        setCaisses(data || []);
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement des caisses');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('status', 'active')
        .order('last_name');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const handleCreate = async () => {
    if (!formData.code || !formData.name) {
      toast.error('Le code et le nom sont obligatoires');
      return;
    }

    try {
      const { error } = await supabase.from('caisses').insert({
        code: formData.code,
        name: formData.name,
        type: formData.type,
        responsable_id: formData.responsable_id && formData.responsable_id !== '_none' ? formData.responsable_id : null,
        solde_initial: formData.solde_initial,
        solde_actuel: formData.solde_initial,
        devise: formData.devise,
        description: formData.description || null,
        created_by: user?.id,
      });

      if (error) throw error;
      
      toast.success('Caisse créée avec succès');
      setIsCreateOpen(false);
      resetForm();
      fetchCaisses();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Ce code de caisse existe déjà');
      } else {
        toast.error('Erreur lors de la création');
      }
    }
  };

  const handleUpdate = async () => {
    if (!editingCaisse || !formData.code || !formData.name) {
      toast.error('Le code et le nom sont obligatoires');
      return;
    }

    try {
      const { error } = await supabase
        .from('caisses')
        .update({
          code: formData.code,
          name: formData.name,
          type: formData.type,
          responsable_id: formData.responsable_id && formData.responsable_id !== '_none' ? formData.responsable_id : null,
          devise: formData.devise,
          description: formData.description || null,
        })
        .eq('id', editingCaisse.id);

      if (error) throw error;
      
      toast.success('Caisse modifiée avec succès');
      setEditingCaisse(null);
      resetForm();
      fetchCaisses();
    } catch (error: any) {
      toast.error('Erreur lors de la modification');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette caisse ?')) return;

    try {
      const { error } = await supabase.from('caisses').delete().eq('id', id);
      if (error) throw error;
      
      toast.success('Caisse supprimée');
      fetchCaisses();
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleToggleActive = async (caisse: Caisse) => {
    try {
      const { error } = await supabase
        .from('caisses')
        .update({ is_active: !caisse.is_active })
        .eq('id', caisse.id);

      if (error) throw error;
      
      toast.success(caisse.is_active ? 'Caisse désactivée' : 'Caisse activée');
      fetchCaisses();
    } catch (error) {
      toast.error('Erreur lors de la modification');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      type: 'principale',
      responsable_id: '',
      solde_initial: 0,
      devise: 'XOF',
      description: '',
    });
  };

  const openEditDialog = (caisse: Caisse) => {
    setFormData({
      code: caisse.code,
      name: caisse.name,
      type: caisse.type,
      responsable_id: caisse.responsable_id || '',
      solde_initial: caisse.solde_initial,
      devise: caisse.devise,
      description: caisse.description || '',
    });
    setEditingCaisse(caisse);
  };

  const filteredCaisses = caisses.filter(c => {
    const matchesSearch = 
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalSolde = caisses.filter(c => c.is_active).reduce((sum, c) => sum + c.solde_actuel, 0);

  if (authLoading) {
    return <AppLayout><div className="p-8">Chargement...</div></AppLayout>;
  }

  if (!canView) {
    return <AppLayout><AccessDenied /></AppLayout>;
  }

  const formatMoney = (amount: number, devise: string = 'XOF') => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' ' + devise;
  };

  return (
    <AppLayout>
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Gestion des Caisses
          </h1>
          <p className="text-muted-foreground">
            Gérez les différentes caisses de l'entreprise
          </p>
        </div>
        {canManage && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle Caisse
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Créer une Caisse</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Code *</Label>
                    <Input
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="CAISSE-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nom *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Caisse Principale"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Responsable</Label>
                  <Select value={formData.responsable_id} onValueChange={(v) => setFormData({ ...formData, responsable_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Aucun</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.first_name} {p.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Solde Initial</Label>
                    <Input
                      type="number"
                      value={formData.solde_initial}
                      onChange={(e) => setFormData({ ...formData, solde_initial: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Devise</Label>
                    <Select value={formData.devise} onValueChange={(v) => setFormData({ ...formData, devise: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="XOF">XOF (Franc CFA BCEAO)</SelectItem>
                        <SelectItem value="XAF">XAF (Franc CFA BEAC)</SelectItem>
                        <SelectItem value="EUR">EUR (Euro)</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description de la caisse..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Annuler</Button>
                <Button onClick={handleCreate}>Créer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Caisses</p>
                <p className="text-2xl font-bold">{caisses.length}</p>
              </div>
              <Wallet className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Caisses Actives</p>
                <p className="text-2xl font-bold">{caisses.filter(c => c.is_active).length}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Solde Total</p>
                <p className="text-2xl font-bold">{formatMoney(totalSolde)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Responsables</p>
                <p className="text-2xl font-bold">{caisses.filter(c => c.responsable_id).length}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par code ou nom..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrer par type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead className="text-right">Solde Actuel</TableHead>
                <TableHead>Statut</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filteredCaisses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucune caisse trouvée
                  </TableCell>
                </TableRow>
              ) : (
                filteredCaisses.map((caisse) => (
                  <TableRow key={caisse.id} className={!caisse.is_active ? 'opacity-50' : ''}>
                    <TableCell className="font-mono font-medium">{caisse.code}</TableCell>
                    <TableCell className="font-medium">{caisse.name}</TableCell>
                    <TableCell>
                      <Badge className={TYPE_COLORS[caisse.type]}>
                        {TYPE_LABELS[caisse.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {caisse.responsable ? (
                        <span>{caisse.responsable.first_name} {caisse.responsable.last_name}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={caisse.solde_actuel >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatMoney(caisse.solde_actuel, caisse.devise)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={caisse.is_active ? 'default' : 'secondary'}>
                        {caisse.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/caisse/${caisse.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(caisse)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(caisse)}
                          >
                            {caisse.is_active ? (
                              <TrendingDown className="h-4 w-4 text-orange-500" />
                            ) : (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(caisse.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingCaisse} onOpenChange={(open) => !open && setEditingCaisse(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier la Caisse</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Responsable</Label>
              <Select value={formData.responsable_id} onValueChange={(v) => setFormData({ ...formData, responsable_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Aucun</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Devise</Label>
              <Select value={formData.devise} onValueChange={(v) => setFormData({ ...formData, devise: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="XOF">XOF (Franc CFA BCEAO)</SelectItem>
                  <SelectItem value="XAF">XAF (Franc CFA BEAC)</SelectItem>
                  <SelectItem value="EUR">EUR (Euro)</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCaisse(null)}>Annuler</Button>
            <Button onClick={handleUpdate}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AppLayout>
  );
}
