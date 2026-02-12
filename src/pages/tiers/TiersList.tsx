import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Users, Phone, Mail, MapPin, Building2, Trash2 } from 'lucide-react';
import { Tiers, TiersType, TIERS_TYPE_LABELS, TIERS_TYPE_COLORS } from '@/types/tiers';

const TIERS_TYPES: TiersType[] = ['fournisseur', 'prestataire', 'transporteur', 'particulier', 'autre'];

export default function TiersList() {
  const { roles, isAdmin } = useAuth();
  const [tiers, setTiers] = useState<Tiers[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TiersType | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingTiers, setEditingTiers] = useState<Tiers | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Selection & deletion state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [formNom, setFormNom] = useState('');
  const [formType, setFormType] = useState<TiersType>('autre');
  const [formTelephone, setFormTelephone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAdresse, setFormAdresse] = useState('');
  const [formNumeroContribuable, setFormNumeroContribuable] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  // Access control
  const hasAccess = isAdmin || roles.some(r => 
    ['responsable_logistique', 'agent_logistique', 'responsable_achats', 'agent_achats', 'comptable', 'daf', 'dg', 'aal'].includes(r)
  );
  const isReadOnly = !isAdmin && roles.every(r => ['aal', 'comptable'].includes(r));

  useEffect(() => {
    if (hasAccess) {
      fetchTiers();
    }
  }, [hasAccess]);

  const fetchTiers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tiers')
        .select('*')
        .order('nom');

      if (error) throw error;
      setTiers((data as unknown as Tiers[]) || []);
    } catch (error) {
      console.error('Error fetching tiers:', error);
      toast.error('Erreur lors du chargement des tiers');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormNom('');
    setFormType('autre');
    setFormTelephone('');
    setFormEmail('');
    setFormAdresse('');
    setFormNumeroContribuable('');
    setFormNotes('');
    setFormIsActive(true);
    setEditingTiers(null);
    setShowForm(false);
  };

  const openEdit = (t: Tiers) => {
    setEditingTiers(t);
    setFormNom(t.nom);
    setFormType(t.type);
    setFormTelephone(t.telephone || '');
    setFormEmail(t.email || '');
    setFormAdresse(t.adresse || '');
    setFormNumeroContribuable(t.numero_contribuable || '');
    setFormNotes(t.notes || '');
    setFormIsActive(t.is_active);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formNom.trim()) {
      toast.error('Le nom est obligatoire');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        nom: formNom.trim(),
        type: formType,
        telephone: formTelephone.trim() || null,
        email: formEmail.trim() || null,
        adresse: formAdresse.trim() || null,
        numero_contribuable: formNumeroContribuable.trim() || null,
        notes: formNotes.trim() || null,
        is_active: formIsActive,
      };

      if (editingTiers) {
        const { error } = await supabase
          .from('tiers')
          .update(payload)
          .eq('id', editingTiers.id);

        if (error) throw error;
        toast.success('Tiers modifié avec succès');
      } else {
        const { error } = await supabase
          .from('tiers')
          .insert(payload);

        if (error) throw error;
        toast.success('Tiers créé avec succès');
      }

      resetForm();
      fetchTiers();
    } catch (error: any) {
      console.error('Error saving tiers:', error);
      toast.error(error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('tiers')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      toast.success(`${selectedIds.size} tiers supprimé(s) avec succès`);
      setSelectedIds(new Set());
      setShowDeleteDialog(false);
      fetchTiers();
    } catch (error: any) {
      console.error('Error deleting tiers:', error);
      toast.error(error.message || 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTiers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTiers.map(t => t.id)));
    }
  };

  const filteredTiers = tiers.filter(t => {
    const matchesSearch = 
      t.nom.toLowerCase().includes(search.toLowerCase()) ||
      t.email?.toLowerCase().includes(search.toLowerCase()) ||
      t.telephone?.includes(search);
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    return matchesSearch && matchesType;
  });

  if (!hasAccess) {
    return <AccessDenied />;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Tiers
            </h1>
            <p className="text-muted-foreground">
              Gestion des fournisseurs, prestataires et autres tiers
            </p>
          </div>
          <div className="flex gap-2">
            {!isReadOnly && selectedIds.size > 0 && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer ({selectedIds.size})
              </Button>
            )}
            {!isReadOnly && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau Tiers
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, email, téléphone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TiersType | 'all')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Type de tiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {TIERS_TYPES.map(type => (
                <SelectItem key={type} value={type}>
                  {TIERS_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {TIERS_TYPES.map(type => {
            const count = tiers.filter(t => t.type === type && t.is_active).length;
            return (
              <div key={type} className="bg-card border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm text-muted-foreground">{TIERS_TYPE_LABELS[type]}s</div>
              </div>
            );
          })}
        </div>

        {/* Table */}
        {isLoading ? (
          <ListSkeleton />
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  {!isReadOnly && (
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={filteredTiers.length > 0 && selectedIds.size === filteredTiers.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                  )}
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Statut</TableHead>
                  {!isReadOnly && <TableHead className="w-[100px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTiers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {search || typeFilter !== 'all' 
                        ? 'Aucun tiers trouvé avec ces critères'
                        : 'Aucun tiers enregistré'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTiers.map((t) => (
                    <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50">
                      {!isReadOnly && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(t.id)}
                            onCheckedChange={() => toggleSelect(t.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="font-medium">{t.nom}</div>
                        {t.numero_contribuable && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {t.numero_contribuable}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={TIERS_TYPE_COLORS[t.type]}>
                          {TIERS_TYPE_LABELS[t.type]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {t.telephone && (
                            <div className="text-sm flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {t.telephone}
                            </div>
                          )}
                          {t.email && (
                            <div className="text-sm flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {t.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {t.adresse && (
                          <div className="text-sm flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate max-w-[200px]">{t.adresse}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.is_active ? 'default' : 'secondary'}>
                          {t.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                      {!isReadOnly && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(t);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedIds(new Set([t.id]));
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Form Dialog */}
        <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingTiers ? 'Modifier le tiers' : 'Nouveau tiers'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Nom / Raison sociale *</Label>
                  <Input
                    value={formNom}
                    onChange={(e) => setFormNom(e.target.value)}
                    placeholder="Ex: SARL TRANSPORT PLUS"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Type de tiers *</Label>
                  <Select value={formType} onValueChange={(v) => setFormType(v as TiersType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIERS_TYPES.map(type => (
                        <SelectItem key={type} value={type}>
                          {TIERS_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input
                    value={formTelephone}
                    onChange={(e) => setFormTelephone(e.target.value)}
                    placeholder="+225 XX XX XX XX"
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="contact@exemple.com"
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label>Adresse</Label>
                  <Input
                    value={formAdresse}
                    onChange={(e) => setFormAdresse(e.target.value)}
                    placeholder="Adresse complète"
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label>N° Contribuable (optionnel)</Label>
                  <Input
                    value={formNumeroContribuable}
                    onChange={(e) => setFormNumeroContribuable(e.target.value)}
                    placeholder="Ex: CI-ABJ-2024-XXXX"
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Informations complémentaires..."
                    rows={2}
                  />
                </div>

                <div className="col-span-2 flex items-center justify-between">
                  <Label>Tiers actif</Label>
                  <Switch
                    checked={formIsActive}
                    onCheckedChange={setFormIsActive}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Enregistrement...' : editingTiers ? 'Modifier' : 'Créer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer {selectedIds.size} tiers ?
                Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? 'Suppression...' : 'Supprimer'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
