import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Package, Search, Check, AlertTriangle, Filter } from 'lucide-react';

interface StockArticle {
  id: string;
  designation: string;
  description: string | null;
  unit: string;
  quantity_available: number;
  quantity_reserved: number;
  quantity_min: number | null;
  location: string | null;
  status: 'disponible' | 'reserve' | 'epuise';
  category_id: string | null;
}

interface StockCategory {
  id: string;
  name: string;
  code: string | null;
}

interface BesoinStockSelectorProps {
  onSelect: (article: StockArticle) => void;
  excludeIds?: string[];
  buttonText?: string;
  buttonVariant?: 'default' | 'outline' | 'ghost' | 'secondary';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
}

const statusLabels: Record<string, string> = {
  disponible: 'Disponible',
  reserve: 'Réservé',
  epuise: 'Épuisé',
};

const statusColors: Record<string, string> = {
  disponible: 'bg-success/10 text-success border-success/20',
  reserve: 'bg-warning/10 text-warning border-warning/20',
  epuise: 'bg-destructive/10 text-destructive border-destructive/20',
};

export function BesoinStockSelector({ 
  onSelect, 
  excludeIds = [],
  buttonText = 'Depuis le stock',
  buttonVariant = 'outline',
  buttonSize = 'sm'
}: BesoinStockSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('__all__');
  const [articles, setArticles] = useState<StockArticle[]>([]);
  const [categories, setCategories] = useState<StockCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchArticles();
      fetchCategories();
    }
  }, [open]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_categories')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories((data || []) as StockCategory[]);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchArticles = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('articles_stock')
        .select('*')
        .neq('status', 'epuise')
        .order('designation', { ascending: true });

      if (error) throw error;
      setArticles((data || []) as StockArticle[]);
    } catch (error) {
      console.error('Error fetching stock:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredArticles = articles.filter((a) => {
    // Exclude already selected
    if (excludeIds.includes(a.id)) return false;
    
    // Filter by category
    if (selectedCategory !== '__all__' && a.category_id !== selectedCategory) return false;
    
    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        a.designation.toLowerCase().includes(searchLower) ||
        a.description?.toLowerCase().includes(searchLower) ||
        a.location?.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });

  const handleSelect = (article: StockArticle) => {
    onSelect(article);
    setOpen(false);
    setSearch('');
  };

  const getAvailableQuantity = (article: StockArticle) => {
    return Math.max(0, article.quantity_available - article.quantity_reserved);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={buttonVariant} size={buttonSize}>
          <Package className="mr-2 h-4 w-4" />
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Sélectionner un article du stock</DialogTitle>
          <DialogDescription>
            Choisissez un article disponible en stock pour l'ajouter à votre besoin
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par désignation, description ou emplacement..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[200px]">
              <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Toutes les catégories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-auto border rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">
                {search ? 'Aucun article trouvé' : 'Aucun article en stock'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Désignation</TableHead>
                  <TableHead>Emplacement</TableHead>
                  <TableHead className="text-center">Disponible</TableHead>
                  <TableHead className="text-center">Unité</TableHead>
                  <TableHead className="text-center">Statut</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredArticles.map((article) => {
                  const available = getAvailableQuantity(article);
                  const isLowStock = article.quantity_min && available <= article.quantity_min;
                  
                  return (
                    <TableRow key={article.id} className="cursor-pointer hover:bg-muted/50">
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
                      <TableCell className="text-muted-foreground">
                        {article.location || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className={isLowStock ? 'text-warning font-medium' : ''}>
                            {available}
                          </span>
                          {isLowStock && (
                            <AlertTriangle className="h-3 w-3 text-warning" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {article.unit}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={statusColors[article.status]}>
                          {statusLabels[article.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSelect(article)}
                          disabled={available <= 0}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
