-- Ajouter les champs de prix de référence aux articles du stock
ALTER TABLE public.articles_stock
ADD COLUMN IF NOT EXISTS prix_reference numeric NULL,
ADD COLUMN IF NOT EXISTS devise text DEFAULT 'XOF',
ADD COLUMN IF NOT EXISTS prix_reference_updated_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS prix_reference_note text NULL;

-- Commentaires pour documentation
COMMENT ON COLUMN public.articles_stock.prix_reference IS 'Prix indicatif de référence (non contractuel)';
COMMENT ON COLUMN public.articles_stock.devise IS 'Devise du prix de référence (XOF par défaut)';
COMMENT ON COLUMN public.articles_stock.prix_reference_note IS 'Note explicative du prix (ex: tarif fournisseur X)';

-- Trigger pour mise à jour automatique de prix_reference_updated_at
CREATE OR REPLACE FUNCTION public.update_prix_reference_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.prix_reference IS DISTINCT FROM OLD.prix_reference THEN
    NEW.prix_reference_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_articles_stock_prix_reference_timestamp
BEFORE UPDATE ON public.articles_stock
FOR EACH ROW
EXECUTE FUNCTION public.update_prix_reference_timestamp();