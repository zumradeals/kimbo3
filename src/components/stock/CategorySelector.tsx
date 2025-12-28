import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StockCategory } from '@/types/kpm';
import { FolderTree } from 'lucide-react';

interface CategorySelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  showAll?: boolean; // Include "Toutes les catégories" option for filters
}

interface CategoryWithChildren extends StockCategory {
  children?: StockCategory[];
}

export function CategorySelector({
  value,
  onChange,
  disabled = false,
  placeholder = 'Sélectionner une catégorie',
  showAll = false,
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<StockCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('stock_categories')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setCategories(data || []);
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // Organize into tree structure for display
  const categoryTree = useMemo(() => {
    const parents = categories.filter((c) => !c.parent_id);
    return parents.map((parent) => ({
      ...parent,
      children: categories.filter((c) => c.parent_id === parent.id),
    })) as CategoryWithChildren[];
  }, [categories]);

  // Flatten for select options with proper indentation
  const flattenedOptions = useMemo(() => {
    const options: { id: string; name: string; indent: number }[] = [];

    categoryTree.forEach((parent) => {
      options.push({ id: parent.id, name: parent.name, indent: 0 });
      parent.children?.forEach((child) => {
        options.push({ id: child.id, name: child.name, indent: 1 });
      });
    });

    return options;
  }, [categoryTree]);

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Chargement..." />
        </SelectTrigger>
      </Select>
    );
  }

  const NONE_VALUE = '__none__';

  return (
    <Select
      value={value || NONE_VALUE}
      onValueChange={(v) => onChange(v === NONE_VALUE ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder}>
          {value ? (
            <span className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-muted-foreground" />
              {categories.find((c) => c.id === value)?.name || placeholder}
            </span>
          ) : (
            placeholder
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {showAll && <SelectItem value={NONE_VALUE}>Toutes les catégories</SelectItem>}
        {!showAll && <SelectItem value={NONE_VALUE}>Aucune catégorie</SelectItem>}
        {flattenedOptions.map((opt) => (
          <SelectItem key={opt.id} value={opt.id}>
            <span style={{ paddingLeft: `${opt.indent * 16}px` }}>
              {opt.indent > 0 && '└ '}
              {opt.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
