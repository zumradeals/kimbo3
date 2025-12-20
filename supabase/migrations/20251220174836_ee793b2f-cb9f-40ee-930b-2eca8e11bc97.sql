-- Create audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values)
    VALUES (auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values)
    VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger for besoins
DROP TRIGGER IF EXISTS audit_besoins ON public.besoins;
CREATE TRIGGER audit_besoins
AFTER INSERT OR UPDATE OR DELETE ON public.besoins
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger for demandes_achat
DROP TRIGGER IF EXISTS audit_demandes_achat ON public.demandes_achat;
CREATE TRIGGER audit_demandes_achat
AFTER INSERT OR UPDATE OR DELETE ON public.demandes_achat
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger for bons_livraison
DROP TRIGGER IF EXISTS audit_bons_livraison ON public.bons_livraison;
CREATE TRIGGER audit_bons_livraison
AFTER INSERT OR UPDATE OR DELETE ON public.bons_livraison
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger for ecritures_comptables
DROP TRIGGER IF EXISTS audit_ecritures_comptables ON public.ecritures_comptables;
CREATE TRIGGER audit_ecritures_comptables
AFTER INSERT OR UPDATE OR DELETE ON public.ecritures_comptables
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger for articles_stock
DROP TRIGGER IF EXISTS audit_articles_stock ON public.articles_stock;
CREATE TRIGGER audit_articles_stock
AFTER INSERT OR UPDATE OR DELETE ON public.articles_stock
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger for stock_movements
DROP TRIGGER IF EXISTS audit_stock_movements ON public.stock_movements;
CREATE TRIGGER audit_stock_movements
AFTER INSERT OR UPDATE OR DELETE ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger for fournisseurs
DROP TRIGGER IF EXISTS audit_fournisseurs ON public.fournisseurs;
CREATE TRIGGER audit_fournisseurs
AFTER INSERT OR UPDATE OR DELETE ON public.fournisseurs
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger for user_roles
DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger for profiles
DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
CREATE TRIGGER audit_profiles
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();