import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Ruler, GripVertical } from 'lucide-react';

interface Unit {
  id: string;
  code: string;
  label: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export default function AdminUnits() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    code: '',
    label: '',
    sort_order: 0,
  });

  useEffect(() => {
    if (isAdmin) {
      fetchUnits();
    }
  }, [isAdmin]);

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setUnits(data || []);
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ code: '', label: '', sort_order: 0 });
    setEditingId(null);
    setShowForm(false);
  };

  const openEdit = (unit: Unit) => {
    setForm({
      code: unit.code,
      label: unit.label,
      sort_order: unit.sort_order,
    });
    setEditingId(unit.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.label.trim()) {
      toast({ title: 'Erreur', description: 'Le code et le libellé sont obligatoires.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('units')
          .update({
            code: form.code.trim(),
            label: form.label.trim(),
            sort_order: form.sort_order,
          })
          .eq('id', editingId);
        if (error) throw error;
        toast({ title: 'Unité modifiée' });
      } else {
        const maxOrder = Math.max(...units.map((u) => u.sort_order), 0);
        const { error } = await supabase.from('units').insert({
          code: form.code.trim(),
          label: form.label.trim(),
          sort_order: form.sort_order || maxOrder + 1,
        });
        if (error) throw error;
        toast({ title: 'Unité créée' });
      }
      resetForm();
      fetchUnits();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (unit: Unit) => {
    try {
      const { error } = await supabase
        .from('units')
        .update({ is_active: !unit.is_active })
        .eq('id', unit.id);
      if (error) throw error;
      fetchUnits();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette unité ?')) return;
    
    try {
      const { error } = await supabase.from('units').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Unité supprimée' });
      fetchUnits();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <AccessDenied message="Seuls les administrateurs peuvent gérer les unités de mesure." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Unités de mesure</h1>
            <p className="text-muted-foreground">Gérez les unités disponibles dans l'application</p>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle unité
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              {units.length} unité(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : units.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Aucune unité configurée.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Ordre</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {units.map((unit) => (
                      <TableRow key={unit.id} className={!unit.is_active ? 'opacity-50' : undefined}>
                        <TableCell className="font-mono text-muted-foreground">
                          {unit.sort_order}
                        </TableCell>
                        <TableCell className="font-mono font-medium">{unit.code}</TableCell>
                        <TableCell>{unit.label}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={unit.is_active}
                              onCheckedChange={() => toggleActive(unit)}
                            />
                            <Badge className={unit.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                              {unit.is_active ? 'Actif' : 'Inactif'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(unit)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(unit.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
            <DialogTitle>{editingId ? 'Modifier' : 'Nouvelle'} unité</DialogTitle>
            <DialogDescription>
              Les unités sont utilisées dans les formulaires de besoin et de stock.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Code *</Label>
              <Input
                placeholder="Ex: kg, m², pièce"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Code court utilisé dans les formulaires
              </p>
            </div>
            <div className="space-y-2">
              <Label>Libellé *</Label>
              <Input
                placeholder="Ex: Kilogramme (kg)"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Nom complet affiché dans les listes déroulantes
              </p>
            </div>
            <div className="space-y-2">
              <Label>Ordre d'affichage</Label>
              <Input
                type="number"
                min="0"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
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
    </AppLayout>
  );
}