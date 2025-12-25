import { useState, useEffect, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen } from 'lucide-react';

interface CompteComptable {
  id: string;
  code: string;
  libelle: string;
  classe: number;
}

interface SyscohadaFormData {
  classe: string;
  compte: string;
  nature_charge: string;
  centre_cout: string;
}

interface SyscohadaFormDynamicProps {
  value: SyscohadaFormData;
  onChange: (data: SyscohadaFormData) => void;
  disabled?: boolean;
}

const SYSCOHADA_CLASSES: Record<number, string> = {
  1: 'Comptes de ressources durables',
  2: 'Comptes d\'actif immobilisé',
  3: 'Comptes de stocks',
  4: 'Comptes de tiers',
  5: 'Comptes de trésorerie',
  6: 'Comptes de charges',
  7: 'Comptes de produits',
};

// Liste de toutes les classes SYSCOHADA (1 à 7)
const ALL_CLASSES = [1, 2, 3, 4, 5, 6, 7];

export function SyscohadaFormDynamic({ value, onChange, disabled = false }: SyscohadaFormDynamicProps) {
  const [comptes, setComptes] = useState<CompteComptable[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
        .order('code');

      if (error) {
        console.error('Error fetching comptes:', error);
        return;
      }
      setComptes(data || []);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter comptes by selected classe
  const filteredComptes = value.classe
    ? comptes.filter(c => c.classe === parseInt(value.classe))
    : comptes;

  // Compter les comptes par classe pour afficher un indicateur
  const comptesCountByClasse = (classe: number) => {
    return comptes.filter(c => c.classe === classe).length;
  };

  // Handle classe change - filter comptes, auto-select if only one
  const handleClasseChange = useCallback((newClasse: string) => {
    const classeInt = parseInt(newClasse);
    const comptesForClasse = comptes.filter(c => c.classe === classeInt);
    
    // If current compte doesn't match new classe, clear it
    const currentCompte = comptes.find(c => c.code === value.compte);
    if (currentCompte && currentCompte.classe !== classeInt) {
      // Auto-select first compte if only one available
      if (comptesForClasse.length === 1) {
        onChange({
          classe: newClasse,
          compte: comptesForClasse[0].code,
          nature_charge: comptesForClasse[0].libelle,
          centre_cout: value.centre_cout,
        });
      } else {
        onChange({
          classe: newClasse,
          compte: '',
          nature_charge: '',
          centre_cout: value.centre_cout,
        });
      }
    } else {
      onChange({ ...value, classe: newClasse });
    }
  }, [comptes, value, onChange]);

  // Handle compte change - auto-update classe and nature_charge
  const handleCompteChange = useCallback((compteCode: string) => {
    const compte = comptes.find(c => c.code === compteCode);
    if (compte) {
      onChange({
        classe: compte.classe.toString(),
        compte: compte.code,
        nature_charge: compte.libelle,
        centre_cout: value.centre_cout,
      });
    } else {
      onChange({ ...value, compte: compteCode });
    }
  }, [comptes, value, onChange]);

  const selectedCompte = comptes.find(c => c.code === value.compte);

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
        <p className="text-xs mt-1">Contactez l'administrateur pour configurer le plan comptable SYSCOHADA.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Classe SYSCOHADA */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          Classe SYSCOHADA *
        </Label>
        <Select
          value={value.classe}
          onValueChange={handleClasseChange}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner une classe" />
          </SelectTrigger>
          <SelectContent>
            {ALL_CLASSES.map((classe) => {
              const count = comptesCountByClasse(classe);
              return (
                <SelectItem key={classe} value={classe.toString()}>
                  <span className="flex items-center gap-2">
                    <span>Classe {classe} - {SYSCOHADA_CLASSES[classe] || ''}</span>
                    {count === 0 && (
                      <span className="text-xs text-muted-foreground">(aucun compte)</span>
                    )}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {value.classe && comptesCountByClasse(parseInt(value.classe)) === 0 && (
          <p className="text-xs text-warning">
            Aucun compte configuré pour cette classe. Contactez l'admin pour ajouter des comptes.
          </p>
        )}
      </div>

      {/* Compte comptable */}
      <div className="space-y-2">
        <Label>Compte comptable *</Label>
        <Select
          value={value.compte}
          onValueChange={handleCompteChange}
          disabled={disabled}
        >
          <SelectTrigger>
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
        {selectedCompte && (
          <p className="text-xs text-muted-foreground">
            {selectedCompte.libelle}
          </p>
        )}
      </div>

      {/* Nature de charge (auto-filled, read-only) */}
      <div className="space-y-2">
        <Label>Nature de charge *</Label>
        <Input
          value={value.nature_charge}
          onChange={(e) => onChange({ ...value, nature_charge: e.target.value })}
          placeholder="Auto-rempli selon le compte"
          disabled={disabled}
          className="bg-muted/50"
          readOnly
        />
        <p className="text-xs text-muted-foreground">
          Rempli automatiquement selon le compte sélectionné
        </p>
      </div>

      {/* Centre de coût */}
      <div className="space-y-2">
        <Label>Centre de coût</Label>
        <Input
          placeholder="Ex: Direction, Production..."
          value={value.centre_cout}
          onChange={(e) => onChange({ ...value, centre_cout: e.target.value })}
          disabled={disabled}
          maxLength={50}
        />
      </div>
    </div>
  );
}
