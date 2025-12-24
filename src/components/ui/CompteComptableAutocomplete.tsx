import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';

interface CompteComptable {
  id: string;
  code: string;
  libelle: string;
  classe: number;
}

interface CompteComptableAutocompleteProps {
  value: string;
  onChange: (value: string, compte?: CompteComptable) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CompteComptableAutocomplete({
  value,
  onChange,
  placeholder = 'Sélectionner un compte...',
  disabled = false,
}: CompteComptableAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [comptes, setComptes] = useState<CompteComptable[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchComptes();
  }, []);

  const fetchComptes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('comptes_comptables')
        .select('id, code, libelle, classe')
        .eq('is_active', true)
        .order('code', { ascending: true });

      if (error) throw error;
      setComptes(data || []);
    } catch (error) {
      console.error('Error fetching comptes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCompte = comptes.find((c) => c.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          {selectedCompte ? (
            <span className="truncate">
              <span className="font-mono font-medium">{selectedCompte.code}</span>
              <span className="mx-2 text-muted-foreground">–</span>
              <span>{selectedCompte.libelle}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher par code ou libellé..." />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <>
                <CommandEmpty>Aucun compte trouvé.</CommandEmpty>
                {[6, 7, 2, 3, 4, 5, 1].map((classe) => {
                  const classComptes = comptes.filter((c) => c.classe === classe);
                  if (classComptes.length === 0) return null;

                  const classeLabels: Record<number, string> = {
                    1: 'Classe 1 - Capitaux',
                    2: 'Classe 2 - Immobilisations',
                    3: 'Classe 3 - Stocks',
                    4: 'Classe 4 - Tiers',
                    5: 'Classe 5 - Trésorerie',
                    6: 'Classe 6 - Charges',
                    7: 'Classe 7 - Produits',
                  };

                  return (
                    <CommandGroup key={classe} heading={classeLabels[classe] || `Classe ${classe}`}>
                      {classComptes.map((compte) => (
                        <CommandItem
                          key={compte.id}
                          value={`${compte.code} ${compte.libelle}`}
                          onSelect={() => {
                            onChange(compte.code, compte);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              value === compte.code ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <span className="font-mono font-medium mr-2">{compte.code}</span>
                          <span className="truncate">{compte.libelle}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
