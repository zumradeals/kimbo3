export type TiersType = 'fournisseur' | 'prestataire' | 'transporteur' | 'particulier' | 'autre';

export interface Tiers {
  id: string;
  nom: string;
  type: TiersType;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  numero_contribuable: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  notes: string | null;
}

export const TIERS_TYPE_LABELS: Record<TiersType, string> = {
  fournisseur: 'Fournisseur',
  prestataire: 'Prestataire',
  transporteur: 'Transporteur',
  particulier: 'Particulier',
  autre: 'Autre',
};

export const TIERS_TYPE_COLORS: Record<TiersType, string> = {
  fournisseur: 'bg-blue-100 text-blue-800',
  prestataire: 'bg-purple-100 text-purple-800',
  transporteur: 'bg-orange-100 text-orange-800',
  particulier: 'bg-green-100 text-green-800',
  autre: 'bg-gray-100 text-gray-800',
};
