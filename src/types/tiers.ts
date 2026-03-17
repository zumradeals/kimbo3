export type TiersType = 'fournisseur' | 'sous_traitant' | 'salarie' | 'client' | 'banque' | 'autre';

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
  sous_traitant: 'Sous-traitant',
  salarie: 'Salarié',
  client: 'Client',
  banque: 'Banque',
  autre: 'Autre',
};

export const TIERS_TYPE_COLORS: Record<TiersType, string> = {
  fournisseur: 'bg-blue-100 text-blue-800',
  sous_traitant: 'bg-purple-100 text-purple-800',
  salarie: 'bg-emerald-100 text-emerald-800',
  client: 'bg-orange-100 text-orange-800',
  banque: 'bg-cyan-100 text-cyan-800',
  autre: 'bg-gray-100 text-gray-800',
};
