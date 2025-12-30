import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, BookOpen, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';

interface CatalogArticle {
  id: string;
  designation: string;
  description: string | null;
  unit: string;
  category_id: string | null;
}

interface StockCategory {
  id: string;
  name: string;
}

interface ArticleCatalogSelectorProps {
  onSelect: (article: { id: string; designation: string; unit: string; description?: string | null }) => void;
  excludeIds?: string[];
  buttonText?: string;
  buttonVariant?: 'default' | 'secondary' | 'outline' | 'ghost';
}

export function ArticleCatalogSelector({
  onSelect,
  excludeIds = [],
  buttonText = 'Sélectionner du catalogue',
  buttonVariant = 'outline',
}: ArticleCatalogSelectorProps) {
  const { isAdmin, roles } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [articles, setArticles] = useState<CatalogArticle[]>([]);
  const [categories, setCategories] = useState<StockCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // LOT 6: Check if user has logistics or purchasing role (can see full info)
  const canSeeFullInfo = isAdmin || roles.some(r => 
    ['dg', 'daf', 'responsable_logistique', 'agent_logistique', 'responsable_achats', 'agent_achats'].includes(r)
  );

  useEffect(() => {
    if (open) {
      fetchCategories();
      fetchArticles();
    }
  }, [open]);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('stock_categories')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    
    if (!error && data) {
      setCategories(data);
    }
  };

  const fetchArticles = async () => {
    setIsLoading(true);
    // Only fetch basic catalog info - NO stock quantities or status
    const { data, error } = await supabase
      .from('articles_stock')
      .select('id, designation, description, unit, category_id')
      .order('designation');
    
    if (!error && data) {
      setArticles(data);
    }
    setIsLoading(false);
  };

  const filteredArticles = articles.filter((article) => {
    const matchesSearch = article.designation.toLowerCase().includes(search.toLowerCase()) ||
      (article.description && article.description.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || article.category_id === selectedCategory;
    const notExcluded = !excludeIds.includes(article.id);
    return matchesSearch && matchesCategory && notExcluded;
  });

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Non catégorisé';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Non catégorisé';
  };

  const handleSelect = (article: CatalogArticle) => {
    onSelect({
      id: article.id,
      designation: article.designation,
      unit: article.unit,
      description: article.description,
    });
    setOpen(false);
    setSearch('');
    setSelectedCategory('all');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={buttonVariant} className="flex-1 sm:flex-none">
          <BookOpen className="mr-2 h-4 w-4" />
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Catalogue des articles
          </DialogTitle>
          <DialogDescription>
            Sélectionnez un article existant pour pré-remplir votre ligne de besoin.
          </DialogDescription>
        </DialogHeader>

        {/* Message explicatif gouvernance */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-sm text-foreground">
            <span className="font-medium">📋 Information importante :</span> Ce catalogue liste les articles référencés dans le système. 
            <span className="text-muted-foreground"> La disponibilité réelle et les quantités en stock seront vérifiées par la Logistique lors du traitement de votre besoin.</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 py-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par désignation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        {/* LOT 6: Category filter only visible to authorized roles */}
        {canSeeFullInfo && (
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Toutes catégories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        </div>

        <div className="flex-1 overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Désignation</TableHead>
                {/* LOT 6: Category column only visible to authorized roles */}
                {canSeeFullInfo && <TableHead className="w-[150px]">Catégorie</TableHead>}
                {/* LOT 6: Unit column only visible to authorized roles */}
                {canSeeFullInfo && <TableHead className="w-[100px]">Unité</TableHead>}
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    {canSeeFullInfo && <TableCell><Skeleton className="h-4 w-24" /></TableCell>}
                    {canSeeFullInfo && <TableCell><Skeleton className="h-4 w-16" /></TableCell>}
                    <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : filteredArticles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canSeeFullInfo ? 4 : 2} className="text-center py-8 text-muted-foreground">
                    {search || selectedCategory !== 'all' 
                      ? 'Aucun article ne correspond à votre recherche'
                      : 'Aucun article disponible dans le catalogue'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredArticles.map((article) => (
                  <TableRow key={article.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div>
                        <p className="font-medium">{article.designation}</p>
                        {article.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {article.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    {/* LOT 6: Category cell only visible to authorized roles */}
                    {canSeeFullInfo && (
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {getCategoryName(article.category_id)}
                        </Badge>
                      </TableCell>
                    )}
                    {/* LOT 6: Unit cell only visible to authorized roles */}
                    {canSeeFullInfo && (
                      <TableCell className="text-muted-foreground">
                        {article.unit}
                      </TableCell>
                    )}
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSelect(article)}
                        className="h-8"
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Ajouter
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          💡 Ce catalogue référence les articles connus. La disponibilité réelle sera vérifiée par la Logistique lors du traitement de votre besoin.
        </p>
      </DialogContent>
    </Dialog>
  );
}