
-- 1. Update handle_bl_delivery to include entrepot_id, projet_id, prix_unitaire, montant_total
CREATE OR REPLACE FUNCTION public.handle_bl_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _article RECORD;
  _stock RECORD;
  _quantity_to_decrement NUMERIC;
  _new_quantity NUMERIC;
  _prix_unitaire NUMERIC;
  _da_id UUID;
BEGIN
  IF NEW.status IN ('livre', 'livree_partiellement') AND 
     (OLD.status IS NULL OR OLD.status NOT IN ('livre', 'livree_partiellement')) THEN
    
    SELECT da.id INTO _da_id
    FROM public.demandes_achat da
    WHERE da.besoin_id = NEW.besoin_id
    LIMIT 1;
    
    FOR _article IN 
      SELECT ba.id, ba.designation, ba.quantity, ba.quantity_delivered, ba.article_stock_id, ba.unit
      FROM public.bl_articles ba
      WHERE ba.bl_id = NEW.id 
        AND ba.article_stock_id IS NOT NULL
    LOOP
      _quantity_to_decrement := COALESCE(_article.quantity_delivered, _article.quantity);
      
      IF _quantity_to_decrement > 0 THEN
        SELECT * INTO _stock 
        FROM public.articles_stock 
        WHERE id = _article.article_stock_id
        FOR UPDATE;
        
        IF _stock IS NOT NULL THEN
          _new_quantity := GREATEST(0, _stock.quantity_available - _quantity_to_decrement);
          
          _prix_unitaire := NULL;
          IF _da_id IS NOT NULL THEN
            SELECT dap.unit_price INTO _prix_unitaire
            FROM public.da_article_prices dap
            JOIN public.da_articles daa ON daa.id = dap.da_article_id
            WHERE daa.da_id = _da_id
              AND daa.article_stock_id = _article.article_stock_id
              AND dap.is_selected = true
            LIMIT 1;
          END IF;
          
          UPDATE public.articles_stock
          SET quantity_available = _new_quantity,
              updated_at = now()
          WHERE id = _article.article_stock_id;
          
          INSERT INTO public.stock_movements (
            article_stock_id, movement_type, quantity, quantity_before, quantity_after,
            reference, bl_id, da_id, entrepot_id, projet_id,
            prix_unitaire, montant_total, created_by, observations
          ) VALUES (
            _article.article_stock_id, 'sortie', _quantity_to_decrement,
            _stock.quantity_available, _new_quantity,
            NEW.reference, NEW.id, _da_id,
            COALESCE(NEW.entrepot_id, _stock.entrepot_id),
            NEW.projet_id, _prix_unitaire,
            CASE WHEN _prix_unitaire IS NOT NULL THEN _prix_unitaire * _quantity_to_decrement ELSE NULL END,
            COALESCE(NEW.delivered_by, NEW.validated_by, NEW.created_by),
            'Sortie BL ' || NEW.reference || ' - ' || _article.designation
          );
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2. Create trigger for DA stock entry (when DA is paid = goods received)
CREATE OR REPLACE FUNCTION public.handle_da_stock_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _article RECORD;
  _stock RECORD;
  _new_quantity NUMERIC;
  _prix_unitaire NUMERIC;
  _besoin RECORD;
  _entrepot_id UUID;
BEGIN
  IF NEW.status = 'payee' AND (OLD.status IS DISTINCT FROM 'payee') THEN
    
    SELECT b.projet_id INTO _besoin
    FROM public.besoins b WHERE b.id = NEW.besoin_id;
    
    FOR _article IN 
      SELECT daa.id, daa.designation, daa.quantity, daa.unit, daa.article_stock_id
      FROM public.da_articles daa
      WHERE daa.da_id = NEW.id
        AND daa.article_stock_id IS NOT NULL
    LOOP
      SELECT dap.unit_price INTO _prix_unitaire
      FROM public.da_article_prices dap
      WHERE dap.da_article_id = _article.id
        AND dap.is_selected = true
      LIMIT 1;
      
      SELECT * INTO _stock 
      FROM public.articles_stock 
      WHERE id = _article.article_stock_id
      FOR UPDATE;
      
      IF _stock IS NOT NULL THEN
        _new_quantity := _stock.quantity_available + _article.quantity;
        _entrepot_id := _stock.entrepot_id;
        
        UPDATE public.articles_stock
        SET quantity_available = _new_quantity,
            status = 'disponible',
            updated_at = now()
        WHERE id = _article.article_stock_id;
        
        INSERT INTO public.stock_movements (
          article_stock_id, movement_type, quantity, quantity_before, quantity_after,
          reference, da_id, entrepot_id, projet_id,
          prix_unitaire, montant_total, created_by, observations
        ) VALUES (
          _article.article_stock_id, 'entree', _article.quantity,
          _stock.quantity_available, _new_quantity,
          NEW.reference, NEW.id, _entrepot_id,
          COALESCE(NEW.projet_id, _besoin.projet_id),
          _prix_unitaire,
          CASE WHEN _prix_unitaire IS NOT NULL THEN _prix_unitaire * _article.quantity ELSE NULL END,
          COALESCE(NEW.comptabilise_by, auth.uid()),
          'Entrée DA ' || NEW.reference || ' - ' || _article.designation
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_da_stock_entry ON public.demandes_achat;
CREATE TRIGGER trigger_da_stock_entry
  AFTER UPDATE ON public.demandes_achat
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_da_stock_entry();
