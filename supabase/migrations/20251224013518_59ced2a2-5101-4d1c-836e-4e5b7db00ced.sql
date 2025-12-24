-- Function to decrement stock when BL is delivered
CREATE OR REPLACE FUNCTION public.handle_bl_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _article RECORD;
  _stock RECORD;
  _quantity_to_decrement NUMERIC;
  _new_quantity NUMERIC;
BEGIN
  -- Only trigger when status changes to 'livre' or 'livree_partiellement'
  IF NEW.status IN ('livre', 'livree_partiellement') AND 
     (OLD.status IS NULL OR OLD.status NOT IN ('livre', 'livree_partiellement')) THEN
    
    -- Loop through all BL articles linked to stock
    FOR _article IN 
      SELECT ba.id, ba.designation, ba.quantity, ba.quantity_delivered, ba.article_stock_id, ba.unit
      FROM public.bl_articles ba
      WHERE ba.bl_id = NEW.id 
        AND ba.article_stock_id IS NOT NULL
    LOOP
      -- Determine quantity to decrement (use quantity_delivered if set, otherwise quantity)
      _quantity_to_decrement := COALESCE(_article.quantity_delivered, _article.quantity);
      
      IF _quantity_to_decrement > 0 THEN
        -- Get current stock
        SELECT * INTO _stock 
        FROM public.articles_stock 
        WHERE id = _article.article_stock_id
        FOR UPDATE;
        
        IF _stock IS NOT NULL THEN
          -- Calculate new quantity
          _new_quantity := GREATEST(0, _stock.quantity_available - _quantity_to_decrement);
          
          -- Update stock
          UPDATE public.articles_stock
          SET quantity_available = _new_quantity,
              updated_at = now()
          WHERE id = _article.article_stock_id;
          
          -- Create stock movement for traceability
          INSERT INTO public.stock_movements (
            article_stock_id,
            movement_type,
            quantity,
            quantity_before,
            quantity_after,
            reference,
            bl_id,
            created_by,
            observations
          ) VALUES (
            _article.article_stock_id,
            'sortie',
            _quantity_to_decrement,
            _stock.quantity_available,
            _new_quantity,
            NEW.reference,
            NEW.id,
            COALESCE(NEW.delivered_by, NEW.validated_by, NEW.created_by),
            'Livraison BL ' || NEW.reference || ' - ' || _article.designation
          );
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on bons_livraison for delivery
DROP TRIGGER IF EXISTS on_bl_delivered ON public.bons_livraison;
CREATE TRIGGER on_bl_delivered
  AFTER UPDATE ON public.bons_livraison
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_bl_delivery();

-- Also handle insert case if BL is created directly as delivered (rare but possible)
DROP TRIGGER IF EXISTS on_bl_delivered_insert ON public.bons_livraison;
CREATE TRIGGER on_bl_delivered_insert
  AFTER INSERT ON public.bons_livraison
  FOR EACH ROW
  WHEN (NEW.status IN ('livre', 'livree_partiellement'))
  EXECUTE FUNCTION public.handle_bl_delivery();