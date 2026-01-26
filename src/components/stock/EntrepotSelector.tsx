import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Warehouse } from 'lucide-react';
import { Stock, STOCK_TYPE_LABELS } from '@/types/entrepot';
import { Badge } from '@/components/ui/badge';

interface StockSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  onStockChange?: (stock: Stock | null) => void;
  showAll?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

// Keep old name for backward compatibility
export interface EntrepotSelectorProps extends StockSelectorProps {
  onEntrepotChange?: (entrepot: Stock | null) => void;
}

export function StockSelector({
  value,
  onChange,
  onStockChange,
  showAll = true,
  disabled = false,
  placeholder = 'Sélectionner un stock',
  className,
}: StockSelectorProps) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStocks();
  }, []);

  const fetchStocks = async () => {
    try {
      const { data, error } = await supabase
        .from('entrepots')
        .select('*')
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('nom');

      if (error) throw error;
      setStocks((data as Stock[]) || []);
      
      // Auto-select default if no value
      if (!value && data && data.length > 0) {
        const defaultStock = data.find((s: Stock) => s.is_default);
        if (defaultStock) {
          onChange(defaultStock.id);
          onStockChange?.(defaultStock as Stock);
        }
      }
    } catch (error) {
      console.error('Error fetching stocks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (val: string) => {
    if (val === 'all') {
      onChange(null);
      onStockChange?.(null);
    } else {
      onChange(val);
      const selected = stocks.find((s) => s.id === val);
      onStockChange?.(selected || null);
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
              <span>Tous les stocks</span>
            </div>
          </SelectItem>
        )}
        {stocks.map((stock) => (
          <SelectItem key={stock.id} value={stock.id}>
            <div className="flex items-center gap-2">
              <span>{stock.nom}</span>
              <Badge variant="outline" className="text-[10px] px-1">
                {STOCK_TYPE_LABELS[stock.type]}
              </Badge>
              {stock.is_default && (
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

// Backward compatibility wrapper
export function EntrepotSelector({
  value,
  onChange,
  onEntrepotChange,
  onStockChange,
  showAll = true,
  disabled = false,
  placeholder = 'Sélectionner un stock',
  className,
}: EntrepotSelectorProps) {
  return (
    <StockSelector
      value={value}
      onChange={onChange}
      onStockChange={onEntrepotChange || onStockChange}
      showAll={showAll}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
    />
  );
}
