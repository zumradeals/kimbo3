
DROP VIEW IF EXISTS public.stock_kimbo_view;

CREATE VIEW public.stock_kimbo_view AS
WITH first_entry AS (
  SELECT article_stock_id, MIN(created_at) AS date_premiere_entree
  FROM public.stock_movements
  WHERE movement_type = 'entree'
  GROUP BY article_stock_id
),
entries AS (
  SELECT article_stock_id,
    SUM(quantity) AS total_qty,
    CASE WHEN SUM(quantity) > 0 THEN SUM(montant_total) / SUM(quantity) ELSE 0 END AS avg_price,
    SUM(montant_total) AS total_montant
  FROM public.stock_movements
  WHERE movement_type = 'entree'
  GROUP BY article_stock_id
),
exits AS (
  SELECT article_stock_id,
    SUM(quantity) AS total_qty,
    CASE WHEN SUM(quantity) > 0 THEN SUM(montant_total) / SUM(quantity) ELSE 0 END AS avg_price,
    SUM(montant_total) AS total_montant
  FROM public.stock_movements
  WHERE movement_type = 'sortie'
  GROUP BY article_stock_id
),
init AS (
  SELECT article_stock_id,
    quantity AS qty,
    prix_unitaire AS prix,
    montant_total AS montant
  FROM public.stock_movements
  WHERE reference LIKE 'INIT-%'
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
  sc.name AS category_name,
  a.location,
  fe.date_premiere_entree,
  COALESCE(i.qty, 0) AS stock_initial_qty,
  COALESCE(i.prix, 0) AS stock_initial_prix,
  COALESCE(i.montant, 0) AS stock_initial_montant,
  COALESCE(e.total_qty, 0) AS entrees_qty,
  COALESCE(e.avg_price, 0) AS entrees_prix_unitaire,
  COALESCE(e.total_montant, 0) AS entrees_montant,
  COALESCE(x.total_qty, 0) AS sorties_qty,
  COALESCE(x.avg_price, 0) AS sorties_prix_unitaire,
  COALESCE(x.total_montant, 0) AS sorties_montant,
  COALESCE(e.total_qty, 0) - COALESCE(x.total_qty, 0) AS stock_final_qty,
  CASE WHEN (COALESCE(e.total_qty, 0) - COALESCE(x.total_qty, 0)) > 0
    THEN (COALESCE(e.total_montant, 0) - COALESCE(x.total_montant, 0)) / (COALESCE(e.total_qty, 0) - COALESCE(x.total_qty, 0))
    ELSE 0 END AS stock_final_prix_unitaire,
  COALESCE(e.total_montant, 0) - COALESCE(x.total_montant, 0) AS stock_final_montant,
  COALESCE(a.quantity_min, 0) AS seuil_alerte,
  a.quantity_available,
  a.status,
  a.created_at,
  CASE
    WHEN (COALESCE(e.total_qty, 0) - COALESCE(x.total_qty, 0)) <= 0 THEN 'rupture'
    WHEN a.quantity_min IS NOT NULL AND (COALESCE(e.total_qty, 0) - COALESCE(x.total_qty, 0)) <= a.quantity_min THEN 'faible'
    ELSE 'disponible'
  END AS statut_auto,
  a.code_barre,
  a.variante,
  a.marque,
  a.etat
FROM public.articles_stock a
LEFT JOIN public.stock_categories sc ON sc.id = a.category_id
LEFT JOIN first_entry fe ON fe.article_stock_id = a.id
LEFT JOIN entries e ON e.article_stock_id = a.id
LEFT JOIN exits x ON x.article_stock_id = a.id
LEFT JOIN init i ON i.article_stock_id = a.id;
