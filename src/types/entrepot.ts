// ==================== MODULE STOCKS (Multi-stocks) ====================

export type StockType = 'interne' | 'chantier';

// Keep old name for database compatibility
export type EntrepotType = StockType;

export interface Stock {
  id: string;
  nom: string;
  type: StockType;
  localisation: string | null;
  is_active: boolean;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Alias for backward compatibility with database table name
export type Entrepot = Stock;

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
  entrepot?: Stock;
  article_stock?: {
    id: string;
    designation: string;
    unit: string;
    status: string;
  };
}

export const STOCK_TYPE_LABELS: Record<StockType, string> = {
  interne: 'Stock Interne',
  chantier: 'Stock Chantier',
};

// Alias for backward compatibility
export const ENTREPOT_TYPE_LABELS = STOCK_TYPE_LABELS;
