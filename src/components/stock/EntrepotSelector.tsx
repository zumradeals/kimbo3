import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Warehouse, MapPin } from 'lucide-react';
import { Entrepot, ENTREPOT_TYPE_LABELS } from '@/types/entrepot';
import { Badge } from '@/components/ui/badge';

interface EntrepotSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  onEntrepotChange?: (entrepot: Entrepot | null) => void;
  showAll?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function EntrepotSelector({
  value,
  onChange,
  onEntrepotChange,
  showAll = true,
  disabled = false,
  placeholder = 'Sélectionner un entrepôt',
  className,
}: EntrepotSelectorProps) {
  const [entrepots, setEntrepots] = useState<Entrepot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchEntrepots();
  }, []);

  const fetchEntrepots = async () => {
    try {
      const { data, error } = await supabase
        .from('entrepots')
        .select('*')
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('nom');

      if (error) throw error;
      setEntrepots((data as Entrepot[]) || []);
      
      // Auto-select default if no value
      if (!value && data && data.length > 0) {
        const defaultEntrepot = data.find((e: Entrepot) => e.is_default);
        if (defaultEntrepot) {
          onChange(defaultEntrepot.id);
          onEntrepotChange?.(defaultEntrepot as Entrepot);
        }
      }
    } catch (error) {
      console.error('Error fetching entrepots:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (val: string) => {
    if (val === 'all') {
      onChange(null);
      onEntrepotChange?.(null);
    } else {
      onChange(val);
      const selected = entrepots.find((e) => e.id === val);
      onEntrepotChange?.(selected || null);
    }
  };

  return (
    <Select
      value={value || (showAll ? 'all' : '')}
      onValueChange={handleChange}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className={className}>
        <div className="flex items-center gap-2">
          <Warehouse className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder={isLoading ? 'Chargement...' : placeholder} />
        </div>
      </SelectTrigger>
      <SelectContent>
        {showAll && (
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <span>Tous les entrepôts</span>
            </div>
          </SelectItem>
        )}
        {entrepots.map((entrepot) => (
          <SelectItem key={entrepot.id} value={entrepot.id}>
            <div className="flex items-center gap-2">
              <span>{entrepot.nom}</span>
              <Badge variant="outline" className="text-[10px] px-1">
                {ENTREPOT_TYPE_LABELS[entrepot.type]}
              </Badge>
              {entrepot.is_default && (
                <Badge className="text-[10px] px-1 bg-primary/10 text-primary">
                  Défaut
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
