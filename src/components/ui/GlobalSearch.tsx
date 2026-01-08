import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import {
  Search,
  ClipboardList,
  FileText,
  Package,
  Building2,
  FolderKanban,
  Warehouse,
  Receipt,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/use-debounce';

interface SearchResult {
  id: string;
  type: 'besoin' | 'da' | 'bl' | 'stock' | 'fournisseur' | 'projet' | 'note_frais';
  title: string;
  subtitle?: string;
  status?: string;
  reference?: string;
}

const TYPE_CONFIG: Record<SearchResult['type'], { icon: typeof Search; label: string; color: string; path: string }> = {
  besoin: { icon: ClipboardList, label: 'Besoin', color: 'bg-blue-100 text-blue-800', path: '/besoins' },
  da: { icon: FileText, label: 'DA', color: 'bg-amber-100 text-amber-800', path: '/demandes-achat' },
  bl: { icon: Package, label: 'BL', color: 'bg-green-100 text-green-800', path: '/bons-livraison' },
  stock: { icon: Warehouse, label: 'Stock', color: 'bg-purple-100 text-purple-800', path: '/stock' },
  fournisseur: { icon: Building2, label: 'Fournisseur', color: 'bg-slate-100 text-slate-800', path: '/fournisseurs' },
  projet: { icon: FolderKanban, label: 'Projet', color: 'bg-cyan-100 text-cyan-800', path: '/projets' },
  note_frais: { icon: Receipt, label: 'Note de frais', color: 'bg-pink-100 text-pink-800', path: '/notes-frais' },
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  
  const debouncedQuery = useDebounce(query, 300);

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    const searchTerm = `%${searchQuery}%`;

    try {
      const [besoins, das, bls, stocks, fournisseurs, projets, notesFrais] = await Promise.all([
        // Besoins
        supabase
          .from('besoins')
          .select('id, title, status, objet_besoin')
          .or(`title.ilike.${searchTerm},objet_besoin.ilike.${searchTerm}`)
          .limit(5),
        
        // Demandes d'achat
        supabase
          .from('demandes_achat')
          .select('id, reference, description, status')
          .or(`reference.ilike.${searchTerm},description.ilike.${searchTerm}`)
          .limit(5),
        
        // Bons de livraison
        supabase
          .from('bons_livraison')
          .select('id, reference, status, warehouse')
          .or(`reference.ilike.${searchTerm},warehouse.ilike.${searchTerm}`)
          .limit(5),
        
        // Articles stock
        supabase
          .from('articles_stock')
          .select('id, designation, description, location')
          .or(`designation.ilike.${searchTerm},description.ilike.${searchTerm},location.ilike.${searchTerm}`)
          .limit(5),
        
        // Fournisseurs
        supabase
          .from('fournisseurs')
          .select('id, name, contact_name, email')
          .eq('is_active', true)
          .or(`name.ilike.${searchTerm},contact_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
          .limit(5),
        
        // Projets
        supabase
          .from('projets')
          .select('id, code, name, client, status')
          .eq('is_active', true)
          .or(`code.ilike.${searchTerm},name.ilike.${searchTerm},client.ilike.${searchTerm}`)
          .limit(5),
        
        // Notes de frais
        supabase
          .from('notes_frais')
          .select('id, reference, title, status')
          .or(`reference.ilike.${searchTerm},title.ilike.${searchTerm}`)
          .limit(5),
      ]);

      const allResults: SearchResult[] = [];

      // Map besoins
      besoins.data?.forEach((b) => {
        allResults.push({
          id: b.id,
          type: 'besoin',
          title: b.objet_besoin || b.title,
          status: b.status,
        });
      });

      // Map DAs
      das.data?.forEach((d) => {
        allResults.push({
          id: d.id,
          type: 'da',
          title: d.description?.substring(0, 60) || 'Sans description',
          reference: d.reference,
          status: d.status,
        });
      });

      // Map BLs
      bls.data?.forEach((b) => {
        allResults.push({
          id: b.id,
          type: 'bl',
          title: b.warehouse || 'Bon de livraison',
          reference: b.reference,
          status: b.status,
        });
      });

      // Map stocks
      stocks.data?.forEach((s) => {
        allResults.push({
          id: s.id,
          type: 'stock',
          title: s.designation,
          subtitle: s.location || undefined,
        });
      });

      // Map fournisseurs
      fournisseurs.data?.forEach((f) => {
        allResults.push({
          id: f.id,
          type: 'fournisseur',
          title: f.name,
          subtitle: f.contact_name || f.email || undefined,
        });
      });

      // Map projets
      projets.data?.forEach((p) => {
        allResults.push({
          id: p.id,
          type: 'projet',
          title: `${p.code} - ${p.name}`,
          subtitle: p.client || undefined,
          status: p.status,
        });
      });

      // Map notes de frais
      notesFrais.data?.forEach((n) => {
        allResults.push({
          id: n.id,
          type: 'note_frais',
          title: n.title,
          reference: n.reference,
          status: n.status,
        });
      });

      setResults(allResults);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Trigger search on debounced query change
  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);

  const handleSelect = (result: SearchResult) => {
    const config = TYPE_CONFIG[result.type];
    navigate(`${config.path}/${result.id}`);
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={() => setOpen(true)}
        title="Rechercher (⌘K)"
      >
        <Search className="h-5 w-5" />
        <span className="sr-only">Rechercher</span>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Rechercher besoins, DA, BL, stock, fournisseurs, projets..." 
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {!isLoading && query.length >= 2 && results.length === 0 && (
            <CommandEmpty>Aucun résultat pour "{query}"</CommandEmpty>
          )}

          {!isLoading && query.length < 2 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Tapez au moins 2 caractères pour rechercher
            </div>
          )}

          {!isLoading && Object.entries(groupedResults).map(([type, items], index) => {
            const config = TYPE_CONFIG[type as SearchResult['type']];
            const Icon = config.icon;
            
            return (
              <div key={type}>
                {index > 0 && <CommandSeparator />}
                <CommandGroup heading={config.label}>
                  {items.map((result) => (
                    <CommandItem
                      key={`${result.type}-${result.id}`}
                      value={`${result.type}-${result.id}-${result.title}`}
                      onSelect={() => handleSelect(result)}
                      className="cursor-pointer"
                    >
                      <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex flex-1 flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{result.title}</span>
                          {result.reference && (
                            <span className="text-xs text-muted-foreground">
                              {result.reference}
                            </span>
                          )}
                        </div>
                        {result.subtitle && (
                          <span className="text-xs text-muted-foreground truncate">
                            {result.subtitle}
                          </span>
                        )}
                      </div>
                      {result.status && (
                        <Badge variant="secondary" className={`ml-2 text-xs ${config.color}`}>
                          {result.status}
                        </Badge>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
