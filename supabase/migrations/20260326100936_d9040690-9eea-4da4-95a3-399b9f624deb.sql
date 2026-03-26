
-- Populate existing articles with auto-generated codes
DO $$
DECLARE
  r RECORD;
  _num INT := 0;
  _code TEXT;
BEGIN
  FOR r IN SELECT id FROM public.articles_stock WHERE code IS NULL ORDER BY created_at LOOP
    _num := _num + 1;
    _code := 'ART-' || LPAD(_num::TEXT, 4, '0');
    WHILE EXISTS (SELECT 1 FROM public.articles_stock WHERE code = _code) LOOP
      _num := _num + 1;
      _code := 'ART-' || LPAD(_num::TEXT, 4, '0');
    END LOOP;
    UPDATE public.articles_stock SET code = _code WHERE id = r.id;
  END LOOP;
END;
$$;

-- Now make code NOT NULL and UNIQUE
ALTER TABLE public.articles_stock ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS articles_stock_code_unique ON public.articles_stock(code);

-- Create the Stock KIMBO computed view
CREATE OR REPLACE VIEW public.stock_kimbo_view AS
WITH 
first_entry AS (
  SELECT DISTINCT ON (article_stock_id)
    article_stock_id,
    created_at as date_premiere_entree,
    prix_unitaire as prix_initial
  FROM public.stock_movements
  WHERE movement_type = 'entree'
  ORDER BY article_stock_id, created_at ASC
),
entries AS (
  SELECT 
    article_stock_id,
    SUM(quantity) as total_qty,
    CASE WHEN SUM(quantity) > 0 THEN SUM(montant_total) / SUM(quantity) ELSE 0 END as prix_moyen,
    SUM(montant_total) as total_montant
  FROM public.stock_movements
  WHERE movement_type = 'entree'
  GROUP BY article_stock_id
),
exits AS (
  SELECT 
    article_stock_id,
    SUM(quantity) as total_qty,
    CASE WHEN SUM(quantity) > 0 THEN SUM(montant_total) / SUM(quantity) ELSE 0 END as prix_moyen,
    SUM(montant_total) as total_montant
  FROM public.stock_movements
  WHERE movement_type = 'sortie'
  GROUP BY article_stock_id
),
adjustments AS (
  SELECT 
    article_stock_id,
    SUM(CASE WHEN quantity_after > quantity_before THEN quantity ELSE 0 END) as adj_entree,
    SUM(CASE WHEN quantity_after < quantity_before THEN quantity ELSE 0 END) as adj_sortie
  FROM public.stock_movements
  WHERE movement_type = 'ajustement'
  GROUP BY article_stock_id
)
SELECT
  a.id,
  a.code,
  a.designation,
  a.unit,
  a.classe_comptable,
  a.nombre_pieces,
  a.conditionnement,
  a.category_id,
  c.name as category_name,
  a.location,
  fe.date_premiere_entree,
  0::numeric as stock_initial_qty,
  COALESCE(fe.prix_initial, a.prix_reference, 0) as stock_initial_prix,
  0::numeric as stock_initial_montant,
  COALESCE(e.total_qty, 0) + COALESCE(adj.adj_entree, 0) as entrees_qty,
  COALESCE(e.prix_moyen, a.prix_reference, 0) as entrees_prix_unitaire,
  COALESCE(e.total_montant, 0) as entrees_montant,
  COALESCE(ex.total_qty, 0) + COALESCE(adj.adj_sortie, 0) as sorties_qty,
  COALESCE(ex.prix_moyen, a.prix_reference, 0) as sorties_prix_unitaire,
  COALESCE(ex.total_montant, 0) as sorties_montant,
  (COALESCE(e.total_qty, 0) + COALESCE(adj.adj_entree, 0)) - (COALESCE(ex.total_qty, 0) + COALESCE(adj.adj_sortie, 0)) as stock_final_qty,
  CASE 
    WHEN (COALESCE(e.total_qty, 0) + COALESCE(adj.adj_entree, 0)) - (COALESCE(ex.total_qty, 0) + COALESCE(adj.adj_sortie, 0)) > 0
    THEN COALESCE(e.prix_moyen, a.prix_reference, 0)
    ELSE 0
  END as stock_final_prix_unitaire,
  ((COALESCE(e.total_qty, 0) + COALESCE(adj.adj_entree, 0)) - (COALESCE(ex.total_qty, 0) + COALESCE(adj.adj_sortie, 0))) 
    * COALESCE(e.prix_moyen, a.prix_reference, 0) as stock_final_montant,
  a.quantity_available,
  a.status,
  a.created_at
FROM public.articles_stock a
LEFT JOIN public.stock_categories c ON c.id = a.category_id
LEFT JOIN first_entry fe ON fe.article_stock_id = a.id
LEFT JOIN entries e ON e.article_stock_id = a.id
LEFT JOIN exits ex ON ex.article_stock_id = a.id
LEFT JOIN adjustments adj ON adj.article_stock_id = a.id;
