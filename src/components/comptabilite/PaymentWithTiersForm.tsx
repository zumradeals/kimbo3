import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { PaymentFormDynamic, PaymentFormData, PaymentClassType } from './PaymentFormDynamic';
import { TiersSelector } from '@/components/tiers/TiersSelector';
import { Tiers, TIERS_TYPE_LABELS, TIERS_TYPE_COLORS } from '@/types/tiers';
import { Building2, Users } from 'lucide-react';

interface Fournisseur {
  id: string;
  name: string;
  tiers_id: string | null;
  tiers?: Tiers;
}

export interface PaymentWithTiersData {
  payment: PaymentFormData;
  beneficiary_type: 'fournisseur' | 'tiers_direct';
  fournisseur_id?: string;
  tiers_id?: string;
  tiers?: Tiers;
}

interface PaymentWithTiersFormProps {
  value: PaymentWithTiersData;
  onChange: (data: PaymentWithTiersData) => void;
  fournisseurId?: string; // Pre-selected fournisseur (from DA)
  disabled?: boolean;
  showBeneficiarySelector?: boolean;
}

export function PaymentWithTiersForm({
  value,
  onChange,
  fournisseurId,
  disabled = false,
  showBeneficiarySelector = true,
}: PaymentWithTiersFormProps) {
  const [fournisseur, setFournisseur] = useState<Fournisseur | null>(null);

  // Fetch fournisseur and its linked tiers if fournisseurId is provided
  useEffect(() => {
    if (fournisseurId) {
      fetchFournisseur(fournisseurId);
    }
  }, [fournisseurId]);

  const fetchFournisseur = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('fournisseurs')
        .select(`
          id,
          name,
          tiers_id,
          tiers:tiers_id (
            id,
            nom,
            type,
            telephone,
            email,
            adresse,
            numero_contribuable
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        const fournData: Fournisseur = {
          id: data.id,
          name: data.name,
          tiers_id: data.tiers_id,
          tiers: data.tiers as unknown as Tiers,
        };
        setFournisseur(fournData);
        
        // Auto-set beneficiary to fournisseur if linked
        if (data.tiers_id) {
          onChange({
            ...value,
            beneficiary_type: 'fournisseur',
            fournisseur_id: id,
            tiers_id: data.tiers_id,
            tiers: data.tiers as unknown as Tiers,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching fournisseur:', error);
    }
  };

  const handleBeneficiaryTypeChange = (type: 'fournisseur' | 'tiers_direct') => {
    if (type === 'fournisseur' && fournisseur?.tiers_id) {
      onChange({
        ...value,
        beneficiary_type: type,
        fournisseur_id: fournisseur.id,
        tiers_id: fournisseur.tiers_id,
        tiers: fournisseur.tiers,
        payment: {
          ...value.payment,
          payment_class: 'REGLEMENT',
        },
      });
    } else {
      onChange({
        ...value,
        beneficiary_type: type,
        fournisseur_id: undefined,
        tiers_id: undefined,
        tiers: undefined,
        payment: {
          ...value.payment,
          payment_class: type === 'tiers_direct' ? 'DEPENSE' : 'REGLEMENT',
        },
      });
    }
  };

  const handleTiersChange = (tiersId: string | undefined, tiers?: Tiers) => {
    onChange({
      ...value,
      tiers_id: tiersId,
      tiers: tiers,
    });
  };

  const handlePaymentChange = (payment: PaymentFormData) => {
    onChange({
      ...value,
      payment,
    });
  };

  return (
    <div className="space-y-6">
      {/* Beneficiary Selection */}
      {showBeneficiarySelector && (
        <div className="space-y-4">
          <Label className="text-base font-semibold">Bénéficiaire du paiement</Label>
          
          <RadioGroup
            value={value.beneficiary_type}
            onValueChange={(v) => handleBeneficiaryTypeChange(v as 'fournisseur' | 'tiers_direct')}
            disabled={disabled}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {/* Fournisseur Option */}
            <Card 
              className={`cursor-pointer transition-all ${
                value.beneficiary_type === 'fournisseur' 
                  ? 'border-primary ring-2 ring-primary/20' 
                  : 'hover:border-muted-foreground/50'
              } ${!fournisseur ? 'opacity-50' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <RadioGroupItem 
                    value="fournisseur" 
                    id="beneficiary-fournisseur"
                    disabled={!fournisseur}
                  />
                  <div className="flex-1">
                    <Label 
                      htmlFor="beneficiary-fournisseur" 
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Building2 className="h-4 w-4 text-blue-500" />
                      Fournisseur (Règlement DA)
                    </Label>
                    {fournisseur ? (
                      <div className="mt-2 text-sm">
                        <div className="font-medium">{fournisseur.name}</div>
                        {fournisseur.tiers && (
                          <Badge className={`mt-1 ${TIERS_TYPE_COLORS[fournisseur.tiers.type]}`}>
                            {TIERS_TYPE_LABELS[fournisseur.tiers.type]}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Aucun fournisseur associé à cette DA
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Direct Tiers Option */}
            <Card 
              className={`cursor-pointer transition-all ${
                value.beneficiary_type === 'tiers_direct' 
                  ? 'border-primary ring-2 ring-primary/20' 
                  : 'hover:border-muted-foreground/50'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <RadioGroupItem 
                    value="tiers_direct" 
                    id="beneficiary-tiers"
                  />
                  <div className="flex-1">
                    <Label 
                      htmlFor="beneficiary-tiers" 
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Users className="h-4 w-4 text-purple-500" />
                      Autre Tiers (Dépense)
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Prestataire, transporteur, particulier...
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </RadioGroup>

          {/* Tiers Selector (when direct tiers is selected) */}
          {value.beneficiary_type === 'tiers_direct' && (
            <div className="pt-2">
              <TiersSelector
                value={value.tiers_id}
                onChange={handleTiersChange}
                excludeFournisseurs={true}
                label="Sélectionner le tiers"
                required
                disabled={disabled}
              />
            </div>
          )}

          {/* Display selected tiers info */}
          {value.tiers && (
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{value.tiers.nom}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={TIERS_TYPE_COLORS[value.tiers.type]}>
                        {TIERS_TYPE_LABELS[value.tiers.type]}
                      </Badge>
                      {value.tiers.numero_contribuable && (
                        <span className="text-xs text-muted-foreground">
                          N° {value.tiers.numero_contribuable}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      {value.tiers.telephone && <div>📞 {value.tiers.telephone}</div>}
                      {value.tiers.email && <div>✉️ {value.tiers.email}</div>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Payment Form */}
      <PaymentFormDynamic
        value={value.payment}
        onChange={handlePaymentChange}
        disabled={disabled}
        showPaymentClass={value.beneficiary_type === 'tiers_direct'}
      />
    </div>
  );
}
