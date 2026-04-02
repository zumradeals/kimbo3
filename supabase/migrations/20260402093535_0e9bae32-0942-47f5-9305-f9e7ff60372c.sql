
ALTER TABLE public.articles_stock
  ADD COLUMN IF NOT EXISTS code_barre text,
  ADD COLUMN IF NOT EXISTS variante text,
  ADD COLUMN IF NOT EXISTS marque text,
  ADD COLUMN IF NOT EXISTS etat text NOT NULL DEFAULT 'bon';

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS beneficiaire text,
  ADD COLUMN IF NOT EXISTS destination_detail text;
