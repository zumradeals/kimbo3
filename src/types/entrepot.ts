// ==================== MODULE ENTREPOTS ====================

export type EntrepotType = 'interne' | 'chantier';

export interface Entrepot {
  id: string;
  nom: string;
  type: EntrepotType;
  localisation: string | null;
  is_active: boolean;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockLevel {
  id: string;
  entrepot_id: string;
  article_stock_id: string;
  quantite_disponible: number;
  quantite_reservee: number;
  quantite_min: number | null;
  created_at: string;
  updated_at: string;
  // Relations
  entrepot?: Entrepot;
  article_stock?: {
    id: string;
    designation: string;
    unit: string;
    status: string;
  };
}

export const ENTREPOT_TYPE_LABELS: Record<EntrepotType, string> = {
  interne: 'Stock Interne',
  chantier: 'Chantier',
};
