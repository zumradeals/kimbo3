import { useState, useEffect } from 'react';
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
import { Wallet, Building2, Receipt, Banknote, HelpCircle } from 'lucide-react';

interface PaymentCategory {
  id: string;
  code: string;
  label: string;
  required_fields: string[];
}

interface PaymentMethod {
  id: string;
  code: string;
  label: string;
  category_id: string;
}

interface Caisse {
  id: string;
  code: string;
  name: string;
  solde_actuel: number;
  devise: string;
}

interface PaymentFormData {
  category_id: string;
  method_id: string;
  details: Record<string, string>;
  caisse_id?: string;
}

interface PaymentFormDynamicProps {
  value: PaymentFormData;
  onChange: (data: PaymentFormData) => void;
  disabled?: boolean;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  mobile_money: Wallet,
  banque: Building2,
  cheque: Receipt,
  especes: Banknote,
  autre: HelpCircle,
};

const FIELD_LABELS: Record<string, string> = {
  transaction_id: 'N° Transaction',
  reference_virement: 'Référence virement',
  numero_cheque: 'N° Chèque',
  banque_emetteur: 'Banque émettrice',
  caisse: 'Caisse utilisée',
  nom_banque: 'Nom de la banque',
};

export function PaymentFormDynamic({ value, onChange, disabled = false }: PaymentFormDynamicProps) {
  const [categories, setCategories] = useState<PaymentCategory[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [caisses, setCaisses] = useState<Caisse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [catRes, methRes, caisseRes] = await Promise.all([
        supabase
          .from('payment_categories')
          .select('id, code, label, required_fields')
          .eq('is_active', true)
          .order('sort_order'),
        supabase
          .from('payment_methods')
          .select('id, code, label, category_id')
          .eq('is_active', true)
          .order('sort_order'),
        supabase
          .from('caisses')
          .select('id, code, name, solde_actuel, devise')
          .eq('is_active', true)
          .order('code'),
      ]);

      if (catRes.data) {
        setCategories(catRes.data.map(c => ({
          ...c,
          required_fields: Array.isArray(c.required_fields) 
            ? (c.required_fields as unknown as string[]) 
            : [],
        })));
      }
      if (methRes.data) setMethods(methRes.data);
      if (caisseRes.data) setCaisses(caisseRes.data);
    } catch (error) {
      console.error('Error fetching payment data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCategory = categories.find(c => c.id === value.category_id);
  const filteredMethods = methods.filter(m => m.category_id === value.category_id);
  const selectedMethod = methods.find(m => m.id === value.method_id);
  const isCashPayment = selectedCategory?.code === 'especes';

  const handleCategoryChange = (categoryId: string) => {
    const newMethods = methods.filter(m => m.category_id === categoryId);
    const newCategory = categories.find(c => c.id === categoryId);
    
    // If cash payment, pre-select default caisse if only one exists
    const defaultCaisseId = newCategory?.code === 'especes' && caisses.length === 1 
      ? caisses[0].id 
      : undefined;
    
    onChange({
      category_id: categoryId,
      method_id: newMethods.length === 1 ? newMethods[0].id : '',
      details: {},
      caisse_id: defaultCaisseId,
    });
  };

  const handleMethodChange = (methodId: string) => {
    onChange({
      ...value,
      method_id: methodId,
      details: {},
    });
  };

  const handleCaisseChange = (caisseId: string) => {
    onChange({
      ...value,
      caisse_id: caisseId,
    });
  };

  const handleDetailChange = (field: string, fieldValue: string) => {
    onChange({
      ...value,
      details: {
        ...value.details,
        [field]: fieldValue,
      },
    });
  };

  const CategoryIcon = selectedCategory ? CATEGORY_ICONS[selectedCategory.code] || HelpCircle : HelpCircle;

  // Determine which extra fields to show based on category
  const getRequiredFields = (): string[] => {
    if (!selectedCategory) return [];
    
    const fields: string[] = [];
    
    // Special case: if method is "autre_banque", add nom_banque field
    if (selectedMethod?.code === 'autre_banque') {
      fields.push('nom_banque');
    }
    
    // Add category-level required fields (but not 'caisse' since we handle it separately)
    fields.push(...selectedCategory.required_fields.filter(f => f !== 'caisse'));
    
    return fields;
  };

  const formatMoney = (amount: number, devise: string = 'XOF') => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' ' + devise;
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm">Chargement des modes de paiement...</span>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
        <p className="text-sm">Aucun mode de paiement configuré.</p>
        <p className="text-xs mt-1">Contactez l'administrateur pour configurer les modes de paiement.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Catégorie de paiement */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <CategoryIcon className="h-4 w-4 text-muted-foreground" />
          Mode de paiement *
        </Label>
        <Select
          value={value.category_id}
          onValueChange={handleCategoryChange}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner une catégorie" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.code] || HelpCircle;
              return (
                <SelectItem key={cat.id} value={cat.id}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {cat.label}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Sélection de caisse pour paiement espèces */}
      {isCashPayment && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-muted-foreground" />
            Caisse *
          </Label>
          {caisses.length === 0 ? (
            <div className="rounded-lg border border-dashed p-3 text-center text-muted-foreground">
              <p className="text-sm">Aucune caisse active.</p>
              <p className="text-xs mt-1">Configurez une caisse dans l'administration.</p>
            </div>
          ) : (
            <Select
              value={value.caisse_id || ''}
              onValueChange={handleCaisseChange}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une caisse" />
              </SelectTrigger>
              <SelectContent>
                {caisses.map((caisse) => (
                  <SelectItem key={caisse.id} value={caisse.id}>
                    <div className="flex items-center justify-between gap-4">
                      <span>{caisse.code} - {caisse.name}</span>
                      <span className="text-xs text-muted-foreground">
                        Solde: {formatMoney(caisse.solde_actuel, caisse.devise)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Méthode spécifique (si plusieurs dans la catégorie) */}
      {value.category_id && filteredMethods.length > 1 && (
        <div className="space-y-2">
          <Label>Référence / Opérateur *</Label>
          <Select
            value={value.method_id}
            onValueChange={handleMethodChange}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              {filteredMethods.map((method) => (
                <SelectItem key={method.id} value={method.id}>
                  {method.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Champs dynamiques selon la catégorie */}
      {getRequiredFields().map((field) => (
        <div key={field} className="space-y-2">
          <Label>
            {FIELD_LABELS[field] || field}
            {selectedCategory?.required_fields.includes(field) && ' *'}
          </Label>
          <Input
            placeholder={FIELD_LABELS[field] || field}
            value={value.details[field] || ''}
            onChange={(e) => handleDetailChange(field, e.target.value)}
            disabled={disabled}
            maxLength={100}
          />
        </div>
      ))}
    </div>
  );
}
