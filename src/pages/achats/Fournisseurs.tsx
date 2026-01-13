import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Fournisseur, ACHATS_ROLES } from '@/types/kpm';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { ReadOnlyBadge } from '@/components/ui/ReadOnlyBadge';
import { Plus, Edit, Trash2, Search, Building2, Phone, Mail } from 'lucide-react';

export default function Fournisseurs() {
  const { user, roles, isAdmin } = useAuth();
  const { toast } = useToast();

  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  });

  const isAchats = roles.some((r) => ACHATS_ROLES.includes(r));
  const isDaf = roles.includes('daf');
  const isComptable = roles.includes('comptable');
  const hasAccess = isAchats || isDaf || isAdmin || isComptable;
  const isReadOnly = isComptable && !isAchats && !isDaf && !isAdmin;

  useEffect(() => {
    fetchFournisseurs();
  }, []);

  const fetchFournisseurs = async () => {
    try {
      const { data, error } = await supabase
        .from('fournisseurs')
        .select('*')
        .is('deleted_at', null)
        .order('name');

      if (error) throw error;
      setFournisseurs((data as Fournisseur[]) || []);
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ name: '', contact_name: '', email: '', phone: '', address: '', notes: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const openEdit = (f: Fournisseur) => {
    setForm({
      name: f.name,
      contact_name: f.contact_name || '',
      email: f.email || '',
      phone: f.phone || '',
      address: f.address || '',
      notes: f.notes || '',
    });
    setEditingId(f.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Erreur', description: 'Le nom est obligatoire.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('fournisseurs')
          .update({
            name: form.name.trim(),
            contact_name: form.contact_name.trim() || null,
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            address: form.address.trim() || null,
            notes: form.notes.trim() || null,
          })
          .eq('id', editingId);
        if (error) throw error;
        toast({ title: 'Fournisseur modifié' });
      } else {
        const { error } = await supabase.from('fournisseurs').insert({
          name: form.name.trim(),
          contact_name: form.contact_name.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          notes: form.notes.trim() || null,
          created_by: user?.id,
        });
        if (error) throw error;
        toast({ title: 'Fournisseur créé' });
      }
      resetForm();
      fetchFournisseurs();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsSaving(true);
    try {
      // Soft delete - marquer comme supprimé au lieu de supprimer
      const { error } = await supabase
        .from('fournisseurs')
        .update({ 
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
          is_active: false
        })
        .eq('id', deletingId);
      if (error) throw error;
      toast({ title: 'Fournisseur supprimé', description: 'Le fournisseur a été archivé.' });
      setShowDeleteDialog(false);
      setDeletingId(null);
      fetchFournisseurs();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredFournisseurs = fournisseurs.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.contact_name || '').toLowerCase().includes(search.toLowerCase())
  );

  if (!hasAccess) {
    return (
      <AppLayout>
        <AccessDenied message="Seul le Service Achats ou le DAF peut gérer les fournisseurs." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-serif text-2xl font-bold text-foreground">Fournisseurs</h1>
              <p className="text-muted-foreground">
                {isReadOnly ? 'Consultation des fournisseurs' : 'Gérez la liste des fournisseurs'}
              </p>
            </div>
            {isReadOnly && <ReadOnlyBadge />}
          </div>
          {!isReadOnly && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau fournisseur
            </Button>
          )}
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>{filteredFournisseurs.length} fournisseur(s)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredFournisseurs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Aucun fournisseur trouvé.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFournisseurs.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {f.name}
                          </div>
                        </TableCell>
                        <TableCell>{f.contact_name || '-'}</TableCell>
                        <TableCell>
                          {f.email ? (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {f.email}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {f.phone ? (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {f.phone}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={f.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                            {f.is_active ? 'Actif' : 'Inactif'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {!isReadOnly && (
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(f)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              {(isAchats || isDaf || isAdmin) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:bg-destructive/10"
                                  onClick={() => { setDeletingId(f.id); setShowDeleteDialog(true); }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier' : 'Nouveau'} fournisseur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input
                placeholder="Nom de l'entreprise"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Personne de contact</Label>
              <Input
                placeholder="Nom du contact"
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="email@exemple.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input
                  placeholder="+225..."
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Adresse</Label>
              <Input
                placeholder="Adresse complète"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Remarques..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Annuler</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce fournisseur ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
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
