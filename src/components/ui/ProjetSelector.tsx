import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, FolderKanban } from 'lucide-react';
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

interface Projet {
  id: string;
  code: string;
  name: string;
  client: string | null;
  status: string;
}

interface ProjetSelectorProps {
  value: string;
  onChange: (value: string, projet?: Projet) => void;
  placeholder?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
}

export function ProjetSelector({
  value,
  onChange,
  placeholder = 'Sélectionner un projet...',
  disabled = false,
  allowEmpty = true,
}: ProjetSelectorProps) {
  const [open, setOpen] = useState(false);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchProjets();
  }, []);

  const fetchProjets = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('projets')
        .select('id, code, name, client, status')
        .eq('is_active', true)
        .order('code', { ascending: true });

      if (error) throw error;
      setProjets(data || []);
    } catch (error) {
      console.error('Error fetching projets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedProjet = projets.find((p) => p.id === value);

  // Group projects by status
  const projetsByStatus = projets.reduce((acc, projet) => {
    const status = projet.status || 'actif';
    if (!acc[status]) acc[status] = [];
    acc[status].push(projet);
    return acc;
  }, {} as Record<string, Projet[]>);

  const statusLabels: Record<string, string> = {
    actif: 'Projets actifs',
    en_cours: 'En cours',
    termine: 'Terminés',
    suspendu: 'Suspendus',
  };

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
          {selectedProjet ? (
            <span className="flex items-center gap-2 truncate">
              <FolderKanban className="h-4 w-4 shrink-0 text-primary" />
              <span className="font-mono font-medium">{selectedProjet.code}</span>
              <span className="text-muted-foreground">–</span>
              <span className="truncate">{selectedProjet.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher par code ou nom..." />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <>
                <CommandEmpty>Aucun projet trouvé.</CommandEmpty>
                
                {allowEmpty && (
                  <CommandGroup>
                    <CommandItem
                      value="__none__"
                      onSelect={() => {
                        onChange('');
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          !value ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className="text-muted-foreground italic">Aucun projet</span>
                    </CommandItem>
                  </CommandGroup>
                )}

                {Object.entries(projetsByStatus).map(([status, statusProjets]) => (
                  <CommandGroup key={status} heading={statusLabels[status] || status}>
                    {statusProjets.map((projet) => (
                      <CommandItem
                        key={projet.id}
                        value={`${projet.code} ${projet.name} ${projet.client || ''}`}
                        onSelect={() => {
                          onChange(projet.id, projet);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            value === projet.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <span className="font-mono font-medium mr-2">{projet.code}</span>
                        <span className="truncate">{projet.name}</span>
                        {projet.client && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({projet.client})
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
