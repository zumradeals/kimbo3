
-- REFONTE MODULE STOCK KIMBO - Phase 1: Structure DB

-- 1) Enrichir articles_stock avec les nouveaux champs
ALTER TABLE public.articles_stock 
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS classe_comptable INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS nombre_pieces INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS conditionnement TEXT DEFAULT 'durable';

-- 2) Enrichir stock_movements avec prix unitaire et montant
ALTER TABLE public.stock_movements 
  ADD COLUMN IF NOT EXISTS prix_unitaire NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS montant_total NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS note_frais_id UUID REFERENCES public.notes_frais(id);

-- 3) Fonction pour générer un code article unique
CREATE OR REPLACE FUNCTION public.generate_article_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _max_num INT;
  _code TEXT;
BEGIN
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(code, '^ART-', ''), '')::INT
  ), 0) + 1 INTO _max_num
  FROM public.articles_stock
  WHERE code LIKE 'ART-%';
  
  _code := 'ART-' || LPAD(_max_num::TEXT, 4, '0');
  
  WHILE EXISTS (SELECT 1 FROM public.articles_stock WHERE code = _code) LOOP
    _max_num := _max_num + 1;
    _code := 'ART-' || LPAD(_max_num::TEXT, 4, '0');
  END LOOP;
  
  RETURN _code;
END;
$$;
