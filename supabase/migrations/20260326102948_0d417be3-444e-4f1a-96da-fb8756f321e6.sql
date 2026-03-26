
-- 1. Add new BL statuses to the enum
ALTER TYPE public.bl_status ADD VALUE IF NOT EXISTS 'brouillon';
ALTER TYPE public.bl_status ADD VALUE IF NOT EXISTS 'soumis_aal';
ALTER TYPE public.bl_status ADD VALUE IF NOT EXISTS 'soumis_daf';
ALTER TYPE public.bl_status ADD VALUE IF NOT EXISTS 'valide_daf';
ALTER TYPE public.bl_status ADD VALUE IF NOT EXISTS 'pret_a_livrer';
ALTER TYPE public.bl_status ADD VALUE IF NOT EXISTS 'refuse_daf';
ALTER TYPE public.bl_status ADD VALUE IF NOT EXISTS 'cloture';

-- 2. Add new columns for AAL validation tracking
ALTER TABLE public.bons_livraison 
  ADD COLUMN IF NOT EXISTS validated_aal_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS validated_aal_at timestamptz,
  ADD COLUMN IF NOT EXISTS aal_rejection_reason text,
  ADD COLUMN IF NOT EXISTS validated_daf_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS validated_daf_at timestamptz,
  ADD COLUMN IF NOT EXISTS daf_rejection_reason text;

-- 3. Update the handle_bl_delivery trigger to ONLY fire on 'livre' status
-- (it already checks for 'livre' status, but let's ensure it's strict)
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
  -- CRITICAL: Stock impact ONLY on 'livre' or 'livree_partiellement' status
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
          
          -- If no DA price, try to use article reference price
          IF _prix_unitaire IS NULL THEN
            _prix_unitaire := _stock.prix_reference;
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

-- 4. Notification triggers for new workflow
CREATE OR REPLACE FUNCTION public.notify_aal_on_bl_soumis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _aal_user RECORD;
BEGIN
  IF NEW.status = 'soumis_aal' AND (OLD.status IS DISTINCT FROM 'soumis_aal') THEN
    FOR _aal_user IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('aal')
    LOOP
      PERFORM create_notification(
        _aal_user.user_id,
        'bl_soumis_aal',
        'BL à valider (AAL)',
        'Le BL ' || NEW.reference || ' attend votre validation.',
        '/bons-livraison/' || NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_notify_aal_on_bl_soumis ON public.bons_livraison;
CREATE TRIGGER trigger_notify_aal_on_bl_soumis
  AFTER UPDATE ON public.bons_livraison
  FOR EACH ROW EXECUTE FUNCTION public.notify_aal_on_bl_soumis();

-- Notify DAF when BL is submitted for DAF validation
CREATE OR REPLACE FUNCTION public.notify_daf_on_bl_soumis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _daf_user RECORD;
BEGIN
  IF NEW.status = 'soumis_daf' AND (OLD.status IS DISTINCT FROM 'soumis_daf') THEN
    FOR _daf_user IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('daf')
    LOOP
      PERFORM create_notification(
        _daf_user.user_id,
        'bl_soumis_daf',
        'BL à valider (Finance)',
        'Le BL ' || NEW.reference || ' attend votre validation financière.',
        '/bons-livraison/' || NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_notify_daf_on_bl_soumis ON public.bons_livraison;
CREATE TRIGGER trigger_notify_daf_on_bl_soumis
  AFTER UPDATE ON public.bons_livraison
  FOR EACH ROW EXECUTE FUNCTION public.notify_daf_on_bl_soumis();

-- Notify logistics when BL is ready to deliver
CREATE OR REPLACE FUNCTION public.notify_logistics_on_bl_pret()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _logistics_user RECORD;
BEGIN
  IF NEW.status = 'pret_a_livrer' AND (OLD.status IS DISTINCT FROM 'pret_a_livrer') THEN
    FOR _logistics_user IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('responsable_logistique', 'agent_logistique')
    LOOP
      PERFORM create_notification(
        _logistics_user.user_id,
        'bl_pret_livrer',
        'BL prêt à livrer',
        'Le BL ' || NEW.reference || ' est validé et prêt pour livraison/enlèvement.',
        '/bons-livraison/' || NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_notify_logistics_on_bl_pret ON public.bons_livraison;
CREATE TRIGGER trigger_notify_logistics_on_bl_pret
  AFTER UPDATE ON public.bons_livraison
  FOR EACH ROW EXECUTE FUNCTION public.notify_logistics_on_bl_pret();
