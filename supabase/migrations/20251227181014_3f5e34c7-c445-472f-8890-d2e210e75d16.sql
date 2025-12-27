-- Create stock_categories table
CREATE TABLE public.stock_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  parent_id uuid REFERENCES public.stock_categories(id) ON DELETE SET NULL,
  code text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  UNIQUE(name, parent_id)
);

-- Add category_id to articles_stock
ALTER TABLE public.articles_stock 
ADD COLUMN category_id uuid REFERENCES public.stock_categories(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_stock_categories_parent_id ON public.stock_categories(parent_id);
CREATE INDEX idx_stock_categories_name ON public.stock_categories(name);
CREATE INDEX idx_stock_categories_is_active ON public.stock_categories(is_active);
CREATE INDEX idx_articles_stock_category_id ON public.articles_stock(category_id);

-- Enable RLS
ALTER TABLE public.stock_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stock_categories

-- Everyone with stock access can read active categories
CREATE POLICY "Lecture catégories actives pour rôles autorisés"
ON public.stock_categories
FOR SELECT
USING (
  (is_active = true AND (
    is_logistics(auth.uid()) OR 
    is_admin(auth.uid()) OR 
    is_dg(auth.uid()) OR 
    has_role(auth.uid(), 'daf'::app_role) OR 
    is_achats(auth.uid())
  ))
  OR is_admin(auth.uid()) 
  OR has_role(auth.uid(), 'daf'::app_role)
);

-- Admin and DAF can create categories
CREATE POLICY "Admin DAF peuvent créer catégories"
ON public.stock_categories
FOR INSERT
WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'daf'::app_role));

-- Admin and DAF can update categories
CREATE POLICY "Admin DAF peuvent modifier catégories"
ON public.stock_categories
FOR UPDATE
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'daf'::app_role));

-- Only Admin can delete categories (but we'll block this in app logic if articles exist)
CREATE POLICY "Admin peut supprimer catégories"
ON public.stock_categories
FOR DELETE
USING (is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_stock_categories_updated_at
  BEFORE UPDATE ON public.stock_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Seed initial categories
INSERT INTO public.stock_categories (name, code, description) VALUES
  ('Peinture', 'CAT-PEINT', 'Peintures et accessoires de peinture'),
  ('Plomberie', 'CAT-PLOMB', 'Matériel et fournitures de plomberie'),
  ('Fournitures bureau', 'CAT-FOURB', 'Fournitures et consommables de bureau'),
  ('Matériels bureau', 'CAT-MATB', 'Équipements et matériels de bureau'),
  ('Étanchéité', 'CAT-ETANCH', 'Produits et matériaux d''étanchéité'),
  ('Électricité', 'CAT-ELEC', 'Matériel électrique et accessoires'),
  ('Gros œuvre', 'CAT-GROS', 'Matériaux de construction gros œuvre'),
  ('Quincaillerie', 'CAT-QUINC', 'Quincaillerie et divers chantier')
ON CONFLICT DO NOTHING;