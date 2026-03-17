import { useState, useEffect, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Plus, Trash2 } from 'lucide-react';

interface CompteComptable {
  id: string;
  code: string;
  libelle: string;
  classe: number;
}

export interface SyscohadaEntry {
  classe: string;
  compte: string;
  nature_charge: string;
  centre_cout: string;
}

interface SyscohadaMultiEntryProps {
  entries: SyscohadaEntry[];
  onChange: (entries: SyscohadaEntry[]) => void;
  disabled?: boolean;
  label: string;
  badgeColor: 'destructive' | 'success';
  badgeText: string;
  description: string;
}

const SYSCOHADA_CLASSES: Record<number, string> = {
  1: 'Comptes de ressources durables',
  2: "Comptes d'actif immobilisé",
  3: 'Comptes de stocks',
  4: 'Comptes de tiers',
  5: 'Comptes de trésorerie',
  6: 'Comptes de charges',
  7: 'Comptes de produits',
};

const ALL_CLASSES = [1, 2, 3, 4, 5, 6, 7];

const emptyEntry = (): SyscohadaEntry => ({
  classe: '',
  compte: '',
  nature_charge: '',
  centre_cout: '',
});

export function SyscohadaMultiEntry({
  entries,
  onChange,
  disabled = false,
  label,
  badgeColor,
  badgeText,
  description,
}: SyscohadaMultiEntryProps) {
  const [comptes, setComptes] = useState<CompteComptable[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchComptes = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('comptes_comptables')
          .select('id, code, libelle, classe')
          .eq('is_active', true)
          .order('code');
        if (!error) setComptes(data || []);
      } finally {
        setIsLoading(false);
      }
    };
    fetchComptes();
  }, []);

  const updateEntry = useCallback(
    (index: number, updates: Partial<SyscohadaEntry>) => {
      const newEntries = [...entries];
      newEntries[index] = { ...newEntries[index], ...updates };
      onChange(newEntries);
    },
    [entries, onChange]
  );

  const handleClasseChange = useCallback(
    (index: number, newClasse: string) => {
      const classeInt = Number(newClasse);
      const comptesForClasse = comptes.filter((c) => c.classe === classeInt);
      const current = entries[index];
      const currentCompte = current.compte ? comptes.find((c) => c.code === current.compte) : undefined;

      if (currentCompte && currentCompte.classe === classeInt) {
        updateEntry(index, { classe: newClasse, nature_charge: currentCompte.libelle });
        return;
      }

      if (comptesForClasse.length > 0) {
        const first = comptesForClasse[0];
        updateEntry(index, { classe: newClasse, compte: first.code, nature_charge: first.libelle });
      } else {
        updateEntry(index, { classe: newClasse, compte: '', nature_charge: '' });
      }
    },
    [comptes, entries, updateEntry]
  );

  const handleCompteChange = useCallback(
    (index: number, compteCode: string) => {
      const compte = comptes.find((c) => c.code === compteCode);
      if (compte) {
        updateEntry(index, {
          classe: compte.classe.toString(),
          compte: compte.code,
          nature_charge: compte.libelle,
        });
      } else {
        updateEntry(index, { compte: compteCode });
      }
    },
    [comptes, updateEntry]
  );

  const addEntry = () => onChange([...entries, emptyEntry()]);

  const removeEntry = (index: number) => {
    if (entries.length <= 1) return;
    onChange(entries.filter((_, i) => i !== index));
  };

  const comptesCountByClasse = (classe: number) => comptes.filter((c) => c.classe === classe).length;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm">Chargement du plan comptable...</span>
      </div>
    );
  }

  if (comptes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
        <p className="text-sm">Aucun compte comptable configuré.</p>
      </div>
    );
  }

  const badgeBgClass = badgeColor === 'destructive' ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success';

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-bold ${badgeBgClass}`}>{badgeText}</span>
          <span className="text-sm font-medium text-muted-foreground">{description}</span>
        </div>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={addEntry}>
            <Plus className="mr-1 h-3 w-3" />
            Ajouter
          </Button>
        )}
      </div>

      {entries.map((entry, index) => {
        const filteredComptes = entry.classe
          ? comptes.filter((c) => c.classe === parseInt(entry.classe))
          : comptes;

        return (
          <div key={index} className="rounded-md border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Entrée {index + 1}
              </span>
              {!disabled && entries.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                  onClick={() => removeEntry(index)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Classe */}
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <BookOpen className="h-3 w-3 text-muted-foreground" />
                  Classe SYSCOHADA *
                </Label>
                <Select
                  value={entry.classe}
                  onValueChange={(v) => handleClasseChange(index, v)}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Sélectionner une classe" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_CLASSES.map((classe) => {
                      const count = comptesCountByClasse(classe);
                      return (
                        <SelectItem key={classe} value={classe.toString()}>
                          <span className="flex items-center gap-2">
                            <span>Classe {classe} - {SYSCOHADA_CLASSES[classe]}</span>
                            {count === 0 && (
                              <span className="text-xs text-muted-foreground">(aucun compte)</span>
                            )}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Compte */}
              <div className="space-y-1">
                <Label className="text-xs">Compte comptable *</Label>
                <Select
                  value={entry.compte}
                  onValueChange={(v) => handleCompteChange(index, v)}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Sélectionner un compte" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredComptes.map((compte) => (
                      <SelectItem key={compte.id} value={compte.code}>
                        <span className="font-mono font-medium mr-2">{compte.code}</span>
                        <span className="text-muted-foreground">{compte.libelle}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Nature de charge */}
              <div className="space-y-1">
                <Label className="text-xs">Nature / Libellé *</Label>
                <Input
                  value={entry.nature_charge}
                  readOnly
                  disabled={disabled}
                  className="h-9 text-sm bg-muted/50"
                  placeholder="Auto-rempli"
                />
              </div>

              {/* Centre de coût */}
              <div className="space-y-1">
                <Label className="text-xs">Centre de coût</Label>
                <Input
                  value={entry.centre_cout}
                  onChange={(e) => updateEntry(index, { centre_cout: e.target.value })}
                  disabled={disabled}
                  className="h-9 text-sm"
                  placeholder="Ex: Direction, Production..."
                  maxLength={50}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
