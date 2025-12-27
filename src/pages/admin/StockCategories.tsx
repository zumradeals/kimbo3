import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { StockCategory } from '@/types/kpm';
import {
  Plus,
  Edit,
  Archive,
  RotateCcw,
  Upload,
  FolderTree,
  Search,
  Package,
  CheckCircle,
  XCircle,
  Info,
  Trash2,
} from 'lucide-react';

interface CategoryWithCount extends StockCategory {
  articles_count: number;
}

export default function StockCategories() {
  const { user, isAdmin, hasRole } = useAuth();
  const { toast } = useToast();

  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Dialog states
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Form state
  const [editingCategory, setEditingCategory] = useState<CategoryWithCount | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    parent_id: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Import state
  const [importText, setImportText] = useState('');
  const [importReport, setImportReport] = useState<{
    created: string[];
    ignored: string[];
    duplicates: string[];
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Archive/Delete state
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithCount | null>(null);

  const isDAF = hasRole('daf');
  const canManage = isAdmin || isDAF;

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      // Fetch categories with article count
      const { data: categoriesData, error: catError } = await supabase
        .from('stock_categories')
        .select('*')
        .order('name');

      if (catError) throw catError;

      // Fetch article counts per category
      const { data: articlesData, error: artError } = await supabase
        .from('articles_stock')
        .select('category_id');

      if (artError) throw artError;

      // Count articles per category
      const countMap: Record<string, number> = {};
      articlesData?.forEach((art) => {
        if (art.category_id) {
          countMap[art.category_id] = (countMap[art.category_id] || 0) + 1;
        }
      });

      const categoriesWithCount = (categoriesData || []).map((cat) => ({
        ...cat,
        articles_count: countMap[cat.id] || 0,
      })) as CategoryWithCount[];

      setCategories(categoriesWithCount);
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // Organize categories into tree structure
  const categoryTree = useMemo(() => {
    const parentCategories = categories.filter((c) => !c.parent_id);
    return parentCategories.map((parent) => ({
      ...parent,
      children: categories.filter((c) => c.parent_id === parent.id),
    }));
  }, [categories]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      const matchesSearch =
        cat.name.toLowerCase().includes(search.toLowerCase()) ||
        (cat.code || '').toLowerCase().includes(search.toLowerCase());
      const matchesStatus = showArchived ? !cat.is_active : cat.is_active;
      return matchesSearch && matchesStatus;
    });
  }, [categories, search, showArchived]);

  // Parent categories for select
  const parentOptions = useMemo(() => {
    return categories.filter((c) => c.is_active && !c.parent_id && c.id !== editingCategory?.id);
  }, [categories, editingCategory]);

  const resetForm = () => {
    setFormData({ name: '', code: '', description: '', parent_id: '' });
    setEditingCategory(null);
  };

  const handleOpenForm = (category?: CategoryWithCount) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        code: category.code || '',
        description: category.description || '',
        parent_id: category.parent_id || '',
      });
    } else {
      resetForm();
    }
    setShowFormDialog(true);
  };

  const handleSaveCategory = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Erreur', description: 'Le nom est requis.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim() || null,
        description: formData.description.trim() || null,
        parent_id: formData.parent_id || null,
        created_by: editingCategory ? undefined : user?.id,
      };

      if (editingCategory) {
        const { error } = await supabase
          .from('stock_categories')
          .update(payload)
          .eq('id', editingCategory.id);
        if (error) throw error;
        toast({ title: 'Succès', description: 'Catégorie mise à jour.' });

        // Audit log
        await logAudit('update', editingCategory.name, formData.name);
      } else {
        const { error } = await supabase.from('stock_categories').insert(payload);
        if (error) throw error;
        toast({ title: 'Succès', description: 'Catégorie créée.' });

        // Audit log
        await logAudit('create', formData.name);
      }

      setShowFormDialog(false);
      resetForm();
      fetchCategories();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!selectedCategory) return;

    try {
      const { error } = await supabase
        .from('stock_categories')
        .update({ is_active: false })
        .eq('id', selectedCategory.id);

      if (error) throw error;

      toast({ title: 'Succès', description: 'Catégorie archivée.' });
      await logAudit('archive', selectedCategory.name);
      setShowArchiveDialog(false);
      setSelectedCategory(null);
      fetchCategories();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  const handleRestore = async (category: CategoryWithCount) => {
    try {
      const { error } = await supabase
        .from('stock_categories')
        .update({ is_active: true })
        .eq('id', category.id);

      if (error) throw error;

      toast({ title: 'Succès', description: 'Catégorie restaurée.' });
      await logAudit('restore', category.name);
      fetchCategories();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;

    try {
      const { error } = await supabase
        .from('stock_categories')
        .delete()
        .eq('id', selectedCategory.id);

      if (error) throw error;

      toast({ title: 'Succès', description: 'Catégorie supprimée définitivement.' });
      await logAudit('delete', selectedCategory.name);
      setShowDeleteDialog(false);
      setSelectedCategory(null);
      fetchCategories();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  const handleImport = async () => {
    if (!importText.trim()) {
      toast({ title: 'Erreur', description: 'Veuillez coller une liste de catégories.', variant: 'destructive' });
      return;
    }

    setIsImporting(true);
    const report = { created: [] as string[], ignored: [] as string[], duplicates: [] as string[] };

    try {
      const lines = importText.split('\n').map((l) => l.trim()).filter((l) => l);
      const existingNames = new Set(categories.map((c) => c.name.toLowerCase()));
      const toCreate: { name: string; parent_id: string | null; code: string | null }[] = [];
      const parentMap: Record<string, string> = {};

      for (const line of lines) {
        // Support CSV format: Parent;Child or just Category
        const parts = line.split(';').map((p) => p.trim()).filter((p) => p);

        if (parts.length === 1) {
          // Simple category
          const name = parts[0];
          const normalizedName = name.toLowerCase();

          if (existingNames.has(normalizedName)) {
            report.duplicates.push(name);
          } else {
            toCreate.push({ name, parent_id: null, code: null });
            existingNames.add(normalizedName);
          }
        } else if (parts.length >= 2) {
          // Parent;Child format
          const parentName = parts[0];
          const childName = parts[1];
          const parentNormalized = parentName.toLowerCase();
          const childNormalized = childName.toLowerCase();

          // Create parent if not exists
          if (!existingNames.has(parentNormalized) && !parentMap[parentNormalized]) {
            toCreate.push({ name: parentName, parent_id: null, code: null });
            existingNames.add(parentNormalized);
            parentMap[parentNormalized] = parentName;
          }

          // Check child
          if (existingNames.has(childNormalized)) {
            report.duplicates.push(childName);
          } else {
            // Will link to parent after creation
            toCreate.push({ name: childName, parent_id: parentNormalized, code: null });
            existingNames.add(childNormalized);
          }
        }
      }

      if (toCreate.length === 0) {
        report.ignored.push('Aucune nouvelle catégorie à créer');
        setImportReport(report);
        setIsImporting(false);
        return;
      }

      // First, create all parent categories (parent_id is null or a string key)
      const parentCategories = toCreate.filter((c) => c.parent_id === null);
      const childCategories = toCreate.filter((c) => c.parent_id !== null);

      // Insert parents
      for (const cat of parentCategories) {
        const { error } = await supabase.from('stock_categories').insert({
          name: cat.name,
          parent_id: null,
          code: null,
          created_by: user?.id,
        });

        if (error) {
          if (error.code === '23505') {
            report.duplicates.push(cat.name);
          } else {
            report.ignored.push(`${cat.name}: ${error.message}`);
          }
        } else {
          report.created.push(cat.name);
        }
      }

      // Fetch updated categories to get parent IDs
      const { data: updatedCategories } = await supabase
        .from('stock_categories')
        .select('id, name');

      const nameToId: Record<string, string> = {};
      updatedCategories?.forEach((c) => {
        nameToId[c.name.toLowerCase()] = c.id;
      });

      // Insert children with proper parent_id
      for (const cat of childCategories) {
        const parentId = nameToId[cat.parent_id!];
        const { error } = await supabase.from('stock_categories').insert({
          name: cat.name,
          parent_id: parentId || null,
          code: null,
          created_by: user?.id,
        });

        if (error) {
          if (error.code === '23505') {
            report.duplicates.push(cat.name);
          } else {
            report.ignored.push(`${cat.name}: ${error.message}`);
          }
        } else {
          report.created.push(cat.name);
        }
      }

      await logAudit('import', `${report.created.length} catégories importées`);
      setImportReport(report);
      fetchCategories();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  const logAudit = async (action: string, categoryName: string, newName?: string) => {
    try {
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: `STOCK_CATEGORY_${action.toUpperCase()}`,
        table_name: 'stock_categories',
        new_values: { category_name: categoryName, new_name: newName || null, action },
      });
    } catch (e) {
      console.error('Audit log error:', e);
    }
  };

  const getParentName = (parentId: string | null) => {
    if (!parentId) return '-';
    const parent = categories.find((c) => c.id === parentId);
    return parent?.name || '-';
  };

  if (!canManage) {
    return (
      <AppLayout>
        <AccessDenied message="Vous n'avez pas accès à la gestion des catégories de stock." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Catégories de Stock
            </h1>
            <p className="text-muted-foreground">
              Gérez les catégories et sous-catégories d'articles
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importer
            </Button>
            <Button onClick={() => handleOpenForm()}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle catégorie
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <FolderTree className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{categories.filter((c) => c.is_active).length}</p>
                <p className="text-sm text-muted-foreground">Catégories actives</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
                <Archive className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{categories.filter((c) => !c.is_active).length}</p>
                <p className="text-sm text-muted-foreground">Archivées</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                <Package className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {categories.reduce((sum, c) => sum + c.articles_count, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Articles liés</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Liste des catégories</CardTitle>
              <div className="flex gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  variant={showArchived ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowArchived(!showArchived)}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  {showArchived ? 'Actives' : 'Archivées'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                {showArchived ? 'Aucune catégorie archivée.' : 'Aucune catégorie trouvée.'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Nb articles</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategories.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell>
                        <div className="font-medium">{cat.name}</div>
                        {cat.description && (
                          <div className="text-xs text-muted-foreground">{cat.description}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">{cat.code || '-'}</code>
                      </TableCell>
                      <TableCell>{getParentName(cat.parent_id)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={cat.is_active ? 'default' : 'secondary'}
                          className={cat.is_active ? 'bg-success/10 text-success' : ''}
                        >
                          {cat.is_active ? (
                            <>
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Actif
                            </>
                          ) : (
                            <>
                              <XCircle className="mr-1 h-3 w-3" />
                              Archivé
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{cat.articles_count}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {cat.is_active ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenForm(cat)}
                                title="Modifier"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedCategory(cat);
                                  setShowArchiveDialog(true);
                                }}
                                title="Archiver"
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRestore(cat)}
                                title="Restaurer"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                              {cat.articles_count === 0 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedCategory(cat);
                                    setShowDeleteDialog(true);
                                  }}
                                  title="Supprimer définitivement"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </>
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
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showFormDialog} onOpenChange={(open) => { setShowFormDialog(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? 'Modifiez les informations de cette catégorie.'
                : 'Créez une nouvelle catégorie pour organiser vos articles de stock.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Peinture"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code (optionnel)</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Ex: CAT-PEINT"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent">Catégorie parente</Label>
              <Select
                value={formData.parent_id}
                onValueChange={(v) => setFormData({ ...formData, parent_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucune (catégorie principale)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucune (catégorie principale)</SelectItem>
                  {parentOptions.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description optionnelle..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveCategory} disabled={isSaving || !formData.name.trim()}>
              {isSaving ? 'Enregistrement...' : editingCategory ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={(open) => { setShowImportDialog(open); if (!open) { setImportText(''); setImportReport(null); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importer des catégories</DialogTitle>
            <DialogDescription>
              Collez une liste de catégories, une par ligne.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex items-start gap-3 py-3">
                <Info className="h-5 w-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Comment importer la liste du DAF</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Copiez la liste manuscrite du DAF</li>
                    <li>Une catégorie par ligne</li>
                    <li>Format CSV optionnel : <code className="bg-muted px-1 rounded">Parent;SousCategorie</code></li>
                    <li>Les doublons seront ignorés automatiquement</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label>Liste des catégories</Label>
              <Textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={`Peinture
Plomberie
Électricité
ou avec sous-catégories:
Peinture;Peinture intérieure
Peinture;Peinture extérieure`}
                rows={10}
                className="font-mono text-sm"
              />
            </div>

            {importReport && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base">Rapport d'import</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 py-0 pb-4">
                  {importReport.created.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-success flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Créées ({importReport.created.length})
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {importReport.created.join(', ')}
                      </p>
                    </div>
                  )}
                  {importReport.duplicates.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-warning flex items-center gap-1">
                        <XCircle className="h-4 w-4" />
                        Doublons ignorés ({importReport.duplicates.length})
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {importReport.duplicates.join(', ')}
                      </p>
                    </div>
                  )}
                  {importReport.ignored.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-destructive flex items-center gap-1">
                        <XCircle className="h-4 w-4" />
                        Erreurs ({importReport.ignored.length})
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {importReport.ignored.join(', ')}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Fermer
            </Button>
            <Button onClick={handleImport} disabled={isImporting || !importText.trim()}>
              {isImporting ? 'Import en cours...' : 'Importer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver cette catégorie ?</AlertDialogTitle>
            <AlertDialogDescription>
              La catégorie "{selectedCategory?.name}" sera archivée.
              {selectedCategory && selectedCategory.articles_count > 0 && (
                <span className="block mt-2 font-medium text-warning">
                  Cette catégorie contient {selectedCategory.articles_count} article(s).
                  Les articles resteront liés mais la catégorie ne sera plus proposée pour de nouveaux articles.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Archiver</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La catégorie "{selectedCategory?.name}" sera supprimée définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
