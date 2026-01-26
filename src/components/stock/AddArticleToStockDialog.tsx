import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { Package, Check, Search, FolderTree } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Article {
  id: string;
  designation: string;
  unit: string;
  category?: { id: string; name: string } | null;
}

interface AddArticleToStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockId: string;
  stockName: string;
  existingArticleIds: string[];
  onSuccess?: () => void;
}

export function AddArticleToStockDialog({
  open,
  onOpenChange,
  stockId,
  stockName,
  existingArticleIds,
  onSuccess,
}: AddArticleToStockDialogProps) {
  const { toast } = useToast();
  const [allArticles, setAllArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [quantityMin, setQuantityMin] = useState<string>('');

  useEffect(() => {
    if (open) {
      fetchArticles();
      setSearch('');
      setSelectedArticle(null);
      setQuantityMin('');
    }
  }, [open]);

  const fetchArticles = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('articles_stock')
        .select('id, designation, unit, category:stock_categories(id, name)')
        .order('designation');

      if (error) throw error;
      setAllArticles((data as Article[]) || []);
    } catch (error: any) {
      console.error('Error fetching articles:', error);
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter out articles already in this stock
  const availableArticles = useMemo(() => {
    const existingSet = new Set(existingArticleIds);
    return allArticles.filter((a) => !existingSet.has(a.id));
  }, [allArticles, existingArticleIds]);

  // Filter by search
  const filteredArticles = useMemo(() => {
    if (!search.trim()) return availableArticles;
    const lowerSearch = search.toLowerCase();
    return availableArticles.filter(
      (a) =>
        a.designation.toLowerCase().includes(lowerSearch) ||
        (a.category?.name || '').toLowerCase().includes(lowerSearch)
    );
  }, [availableArticles, search]);

  const handleAdd = async () => {
    if (!selectedArticle) {
      toast({ title: 'Erreur', description: 'Sélectionnez un article.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from('stock_levels').insert({
        entrepot_id: stockId,
        article_stock_id: selectedArticle.id,
        quantite_disponible: 0,
        quantite_reservee: 0,
        quantite_min: quantityMin ? parseFloat(quantityMin) : null,
      });

      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Erreur', description: 'Cet article est déjà présent dans ce stock.', variant: 'destructive' });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: 'Article ajouté',
        description: `${selectedArticle.designation} a été ajouté au stock "${stockName}" avec quantité initiale = 0.`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Ajouter un article au stock
          </DialogTitle>
          <DialogDescription>
            Sélectionnez un article existant à ajouter au stock <strong>{stockName}</strong>.
            L'article sera ajouté avec une quantité initiale de 0.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search input */}
          <div className="space-y-2">
            <Label>Rechercher un article</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par désignation ou catégorie..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Article list */}
          <div className="space-y-2">
            <Label>Articles disponibles ({filteredArticles.length})</Label>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                {availableArticles.length === 0
                  ? 'Tous les articles sont déjà dans ce stock'
                  : 'Aucun article trouvé'}
              </div>
            ) : (
              <ScrollArea className="h-[200px] rounded-md border">
                <div className="p-2 space-y-1">
                  {filteredArticles.map((article) => (
                    <button
                      key={article.id}
                      type="button"
                      onClick={() => setSelectedArticle(article)}
                      className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                        selectedArticle?.id === article.id
                          ? 'bg-primary/10 border border-primary/30'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{article.designation}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{article.unit}</span>
                          {article.category && (
                            <Badge variant="outline" className="text-[10px] px-1">
                              <FolderTree className="mr-1 h-2.5 w-2.5" />
                              {article.category.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {selectedArticle?.id === article.id && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Selected article summary */}
          {selectedArticle && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <span className="font-medium">Article sélectionné:</span>
                <span>{selectedArticle.designation}</span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qty-min">Seuil d'alerte (optionnel)</Label>
                <Input
                  id="qty-min"
                  type="number"
                  step="any"
                  min="0"
                  value={quantityMin}
                  onChange={(e) => setQuantityMin(e.target.value)}
                  placeholder="Laisser vide pour aucun seuil"
                  className="h-9"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleAdd} disabled={isSaving || !selectedArticle}>
            {isSaving ? 'Ajout...' : 'Ajouter au stock'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
