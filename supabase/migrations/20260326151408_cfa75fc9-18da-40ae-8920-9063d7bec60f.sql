
-- 1. Fix the existing BL sortie movement
UPDATE stock_movements 
SET prix_unitaire = 15000, montant_total = 15000
WHERE id = '4cfbe23b-f535-473e-8ef6-913867c40084';

-- 2. Create initial entry movements for articles with stock but no INIT movement
INSERT INTO stock_movements (article_stock_id, movement_type, quantity, quantity_before, quantity_after, prix_unitaire, montant_total, reference, observations, created_by, entrepot_id, created_at)
SELECT 
  a.id,
  'entree'::stock_movement_type,
  a.quantity_available + a.quantity_reserved + COALESCE(exits_sum.total, 0) - COALESCE(entries_sum.total, 0),
  0,
  a.quantity_available + a.quantity_reserved + COALESCE(exits_sum.total, 0) - COALESCE(entries_sum.total, 0),
  COALESCE(a.prix_reference, 0),
  (a.quantity_available + a.quantity_reserved + COALESCE(exits_sum.total, 0) - COALESCE(entries_sum.total, 0)) * COALESCE(a.prix_reference, 0),
  'INIT-' || a.code,
  'Stock initial à la création de l''article',
  a.created_by,
  COALESCE(a.entrepot_id, (SELECT id FROM entrepots WHERE is_default = true LIMIT 1)),
  a.created_at
FROM articles_stock a
LEFT JOIN (SELECT article_stock_id, SUM(quantity) as total FROM stock_movements WHERE movement_type = 'sortie' GROUP BY article_stock_id) exits_sum ON exits_sum.article_stock_id = a.id
LEFT JOIN (SELECT article_stock_id, SUM(quantity) as total FROM stock_movements WHERE movement_type = 'entree' GROUP BY article_stock_id) entries_sum ON entries_sum.article_stock_id = a.id
WHERE (a.quantity_available + a.quantity_reserved) > 0
  AND NOT EXISTS (SELECT 1 FROM stock_movements sm WHERE sm.article_stock_id = a.id AND sm.reference LIKE 'INIT-%');

-- 3. Trigger function for future articles
CREATE OR REPLACE FUNCTION public.create_initial_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.quantity_available > 0 THEN
    INSERT INTO stock_movements (
      article_stock_id, movement_type, quantity, 
      quantity_before, quantity_after,
      prix_unitaire, montant_total,
      reference, observations, created_by, entrepot_id
    ) VALUES (
      NEW.id, 'entree'::stock_movement_type, NEW.quantity_available,
      0, NEW.quantity_available,
      COALESCE(NEW.prix_reference, 0), 
      NEW.quantity_available * COALESCE(NEW.prix_reference, 0),
      'INIT-' || NEW.code,
      'Stock initial à la création de l''article',
      NEW.created_by,
      COALESCE(NEW.entrepot_id, (SELECT id FROM entrepots WHERE is_default = true LIMIT 1))
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_create_initial_stock_movement ON articles_stock;
CREATE TRIGGER trg_create_initial_stock_movement
  AFTER INSERT ON articles_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.create_initial_stock_movement();

-- 4. Fix handle_bl_delivery to use prix_reference
CREATE OR REPLACE FUNCTION public.handle_bl_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _article RECORD;
  _stock_article RECORD;
  _qty_to_deduct NUMERIC;
  _prix NUMERIC;
BEGIN
  IF NEW.status = 'livre' AND (OLD.status IS NULL OR OLD.status != 'livre') THEN
    FOR _article IN
      SELECT ba.article_stock_id, ba.designation, 
             COALESCE(ba.quantity_delivered, ba.quantity) as qty, ba.unit
      FROM bl_articles ba WHERE ba.bl_id = NEW.id
    LOOP
      IF _article.article_stock_id IS NOT NULL THEN
        SELECT quantity_available, COALESCE(prix_reference, 0) as prix_ref
        INTO _stock_article FROM articles_stock WHERE id = _article.article_stock_id;

        _qty_to_deduct := _article.qty;
        _prix := COALESCE(_stock_article.prix_ref, 0);

        INSERT INTO stock_movements (
          article_stock_id, movement_type, quantity, quantity_before, quantity_after,
          prix_unitaire, montant_total, bl_id, reference, observations, created_by, entrepot_id
        ) VALUES (
          _article.article_stock_id, 'sortie'::stock_movement_type, _qty_to_deduct,
          _stock_article.quantity_available, _stock_article.quantity_available - _qty_to_deduct,
          _prix, _qty_to_deduct * _prix,
          NEW.id, NEW.reference, 'Sortie BL ' || NEW.reference || ' - ' || _article.designation,
          NEW.delivered_by, NEW.entrepot_id
        );

        UPDATE articles_stock
        SET quantity_available = quantity_available - _qty_to_deduct, updated_at = NOW()
        WHERE id = _article.article_stock_id;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;
