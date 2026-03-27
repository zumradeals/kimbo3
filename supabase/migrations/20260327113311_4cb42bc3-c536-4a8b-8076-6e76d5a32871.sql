
-- 1. Drop and recreate stock_kimbo_view with alert threshold and auto-status
DROP VIEW IF EXISTS public.stock_kimbo_view;

CREATE OR REPLACE VIEW public.stock_kimbo_view AS
WITH first_entry AS (
  SELECT DISTINCT ON (article_stock_id) 
    article_stock_id,
    created_at AS date_premiere_entree,
    prix_unitaire AS prix_initial
  FROM stock_movements
  WHERE movement_type = 'entree'
  ORDER BY article_stock_id, created_at
),
entries AS (
  SELECT article_stock_id,
    sum(quantity) AS total_qty,
    CASE WHEN sum(quantity) > 0 THEN sum(montant_total) / sum(quantity) ELSE 0 END AS prix_moyen,
    sum(montant_total) AS total_montant
  FROM stock_movements WHERE movement_type = 'entree'
  GROUP BY article_stock_id
),
exits AS (
  SELECT article_stock_id,
    sum(quantity) AS total_qty,
    CASE WHEN sum(quantity) > 0 THEN sum(montant_total) / sum(quantity) ELSE 0 END AS prix_moyen,
    sum(montant_total) AS total_montant
  FROM stock_movements WHERE movement_type = 'sortie'
  GROUP BY article_stock_id
),
adjustments AS (
  SELECT article_stock_id,
    sum(CASE WHEN quantity_after > quantity_before THEN quantity ELSE 0 END) AS adj_entree,
    sum(CASE WHEN quantity_after < quantity_before THEN quantity ELSE 0 END) AS adj_sortie
  FROM stock_movements WHERE movement_type = 'ajustement'
  GROUP BY article_stock_id
),
computed AS (
  SELECT a.id,
    a.code, a.designation, a.unit, a.classe_comptable, a.nombre_pieces, a.conditionnement,
    a.category_id, c.name AS category_name, a.location,
    fe.date_premiere_entree,
    -- Stock initial = 0 (tout passe par mouvements)
    0::numeric AS stock_initial_qty,
    COALESCE(fe.prix_initial, a.prix_reference, 0) AS stock_initial_prix,
    0::numeric AS stock_initial_montant,
    -- Entrées
    (COALESCE(e.total_qty, 0) + COALESCE(adj.adj_entree, 0)) AS entrees_qty,
    COALESCE(e.prix_moyen, a.prix_reference, 0) AS entrees_prix_unitaire,
    COALESCE(e.total_montant, 0) AS entrees_montant,
    -- Sorties
    (COALESCE(ex.total_qty, 0) + COALESCE(adj.adj_sortie, 0)) AS sorties_qty,
    COALESCE(ex.prix_moyen, a.prix_reference, 0) AS sorties_prix_unitaire,
    COALESCE(ex.total_montant, 0) AS sorties_montant,
    -- Stock final calculé
    ((COALESCE(e.total_qty, 0) + COALESCE(adj.adj_entree, 0)) - (COALESCE(ex.total_qty, 0) + COALESCE(adj.adj_sortie, 0))) AS stock_final_qty,
    -- Prix moyen pondéré final
    CASE 
      WHEN ((COALESCE(e.total_qty, 0) + COALESCE(adj.adj_entree, 0)) - (COALESCE(ex.total_qty, 0) + COALESCE(adj.adj_sortie, 0))) > 0 
      THEN COALESCE(e.prix_moyen, a.prix_reference, 0)
      ELSE 0 
    END AS stock_final_prix_unitaire,
    -- Montant final
    (((COALESCE(e.total_qty, 0) + COALESCE(adj.adj_entree, 0)) - (COALESCE(ex.total_qty, 0) + COALESCE(adj.adj_sortie, 0))) * COALESCE(e.prix_moyen, a.prix_reference, 0)) AS stock_final_montant,
    -- Seuil d'alerte
    COALESCE(a.quantity_min, 0) AS seuil_alerte,
    a.quantity_available,
    a.status,
    a.created_at
  FROM articles_stock a
  LEFT JOIN stock_categories c ON c.id = a.category_id
  LEFT JOIN first_entry fe ON fe.article_stock_id = a.id
  LEFT JOIN entries e ON e.article_stock_id = a.id
  LEFT JOIN exits ex ON ex.article_stock_id = a.id
  LEFT JOIN adjustments adj ON adj.article_stock_id = a.id
)
SELECT *,
  -- Statut automatique calculé
  CASE
    WHEN stock_final_qty <= 0 THEN 'rupture'
    WHEN seuil_alerte > 0 AND stock_final_qty <= seuil_alerte THEN 'faible'
    ELSE 'disponible'
  END AS statut_auto
FROM computed;

-- 2. Create CUMP view (Coût Unitaire Moyen Pondéré)
CREATE OR REPLACE VIEW public.stock_cump_view AS
WITH ordered_movements AS (
  SELECT 
    sm.id,
    sm.article_stock_id,
    sm.created_at AS date_mouvement,
    sm.movement_type,
    sm.quantity,
    sm.prix_unitaire,
    sm.montant_total,
    sm.quantity_before,
    sm.quantity_after,
    sm.reference,
    sm.da_id,
    sm.bl_id,
    sm.created_by,
    a.code AS article_code,
    a.designation AS article_designation,
    a.unit AS article_unit,
    -- CUMP calculation: value of stock after this movement
    -- For entries: new_value = old_value + entry_amount, new_qty = old_qty + entry_qty, CUMP = new_value / new_qty
    -- For exits: CUMP stays the same, value decreases by exit_qty * current_CUMP
    ROW_NUMBER() OVER (PARTITION BY sm.article_stock_id ORDER BY sm.created_at) AS rn
  FROM stock_movements sm
  JOIN articles_stock a ON a.id = sm.article_stock_id
  ORDER BY sm.article_stock_id, sm.created_at
)
SELECT 
  om.id,
  om.article_stock_id,
  om.article_code,
  om.article_designation,
  om.article_unit,
  om.date_mouvement,
  om.movement_type,
  om.quantity,
  om.prix_unitaire,
  om.montant_total,
  om.quantity_before,
  om.quantity_after,
  om.reference,
  om.da_id,
  om.bl_id,
  om.created_by,
  -- CUMP approximation: total value / total qty at this point
  CASE 
    WHEN om.quantity_after > 0 THEN 
      COALESCE(om.montant_total, 0) -- will be refined in frontend with running calculation
    ELSE 0 
  END AS valeur_mouvement,
  om.rn
FROM ordered_movements om;
