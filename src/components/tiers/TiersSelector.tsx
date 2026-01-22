import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, Building2 } from 'lucide-react';
import { Tiers, TiersType, TIERS_TYPE_LABELS, TIERS_TYPE_COLORS } from '@/types/tiers';

interface TiersSelectorProps {
  value: string | undefined;
  onChange: (tiersId: string | undefined, tiers?: Tiers) => void;
  filterType?: TiersType | TiersType[];
  excludeFournisseurs?: boolean;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export function TiersSelector({
  value,
  onChange,
  filterType,
  excludeFournisseurs = false,
  label = 'Tiers',
  placeholder = 'Sélectionner un tiers',
  disabled = false,
  required = false,
}: TiersSelectorProps) {
  const [tiers, setTiers] = useState<Tiers[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTiers();
  }, [filterType, excludeFournisseurs]);

  const fetchTiers = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('tiers')
        .select('*')
        .eq('is_active', true)
        .order('nom');

      // Filter by type(s)
      if (filterType) {
        if (Array.isArray(filterType)) {
          query = query.in('type', filterType);
        } else {
          query = query.eq('type', filterType);
        }
      }

      // Exclude fournisseurs if needed (for direct expense payments)
      if (excludeFournisseurs) {
        query = query.neq('type', 'fournisseur');
      }

      const { data, error } = await query;

      if (error) throw error;
      setTiers((data as unknown as Tiers[]) || []);
    } catch (error) {
      console.error('Error fetching tiers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedTiers = tiers.find(t => t.id === value);

  const handleChange = (tiersId: string) => {
    if (tiersId === '__none__') {
      onChange(undefined, undefined);
    } else {
      const selected = tiers.find(t => t.id === tiersId);
      onChange(tiersId, selected);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        {label} {required && '*'}
      </Label>
      <Select
        value={value || '__none__'}
        onValueChange={handleChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? 'Chargement...' : placeholder}>
            {selectedTiers && (
              <div className="flex items-center gap-2">
                <span>{selectedTiers.nom}</span>
                <Badge variant="outline" className="text-xs">
                  {TIERS_TYPE_LABELS[selectedTiers.type]}
                </Badge>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">
            <span className="text-muted-foreground">-- Aucun --</span>
          </SelectItem>
          {tiers.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              <div className="flex items-center gap-2">
                <span>{t.nom}</span>
                <Badge className={`${TIERS_TYPE_COLORS[t.type]} text-xs`}>
                  {TIERS_TYPE_LABELS[t.type]}
                </Badge>
                {t.numero_contribuable && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {t.numero_contribuable}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedTiers && (
        <div className="text-xs text-muted-foreground space-y-1">
          {selectedTiers.telephone && <div>📞 {selectedTiers.telephone}</div>}
          {selectedTiers.email && <div>✉️ {selectedTiers.email}</div>}
          {selectedTiers.adresse && <div>📍 {selectedTiers.adresse}</div>}
        </div>
      )}
    </div>
  );
}
