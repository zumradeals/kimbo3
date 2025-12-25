-- A. Table pour les unités administrables
CREATE TABLE IF NOT EXISTS public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Policies pour units
CREATE POLICY "Tous voient les unités actives" 
ON public.units 
FOR SELECT 
USING (is_active = true OR is_admin(auth.uid()));

CREATE POLICY "Admin peut gérer les unités" 
ON public.units 
FOR ALL 
USING (is_admin(auth.uid())) 
WITH CHECK (is_admin(auth.uid()));

-- Insérer les unités par défaut
INSERT INTO public.units (code, label, sort_order) VALUES
('unité', 'Unité', 1),
('pièce', 'Pièce', 2),
('kg', 'Kilogramme (kg)', 3),
('g', 'Gramme (g)', 4),
('t', 'Tonne (t)', 5),
('m', 'Mètre (m)', 6),
('cm', 'Centimètre (cm)', 7),
('m²', 'Mètre carré (m²)', 8),
('m³', 'Mètre cube (m³)', 9),
('L', 'Litre (L)', 10),
('mL', 'Millilitre (mL)', 11),
('boîte', 'Boîte', 12),
('carton', 'Carton', 13),
('palette', 'Palette', 14),
('rouleau', 'Rouleau', 15),
('sac', 'Sac', 16),
('bidon', 'Bidon', 17),
('paquet', 'Paquet', 18),
('paquets', 'Paquets', 19),
('lot', 'Lot', 20)
ON CONFLICT (code) DO NOTHING;

-- B. Ajout de deleted_at pour soft delete des fournisseurs
ALTER TABLE public.fournisseurs ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
ALTER TABLE public.fournisseurs ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- C. Mettre à jour les policies RLS pour permettre aux Achats de supprimer (soft delete)
DROP POLICY IF EXISTS "Achats peut supprimer fournisseurs" ON public.fournisseurs;
CREATE POLICY "Achats peut supprimer fournisseurs" 
ON public.fournisseurs 
FOR UPDATE 
USING (is_achats(auth.uid()) OR is_admin(auth.uid()) OR has_role(auth.uid(), 'daf'::app_role))
WITH CHECK (is_achats(auth.uid()) OR is_admin(auth.uid()) OR has_role(auth.uid(), 'daf'::app_role));

-- D. Permettre aux Achats et Comptabilité de voir les besoins (lecture seule)
DROP POLICY IF EXISTS "Achats voit les besoins" ON public.besoins;
CREATE POLICY "Achats voit les besoins" 
ON public.besoins 
FOR SELECT 
USING (is_achats(auth.uid()));

DROP POLICY IF EXISTS "Comptable voit les besoins" ON public.besoins;
CREATE POLICY "Comptable voit les besoins" 
ON public.besoins 
FOR SELECT 
USING (is_comptable(auth.uid()));

-- Permettre aussi aux Achats et Comptabilité de voir les lignes de besoins
DROP POLICY IF EXISTS "Achats voit les lignes besoins" ON public.besoin_lignes;
CREATE POLICY "Achats voit les lignes besoins" 
ON public.besoin_lignes 
FOR SELECT 
USING (is_achats(auth.uid()));

DROP POLICY IF EXISTS "Comptable voit les lignes besoins" ON public.besoin_lignes;
CREATE POLICY "Comptable voit les lignes besoins" 
ON public.besoin_lignes 
FOR SELECT 
USING (is_comptable(auth.uid()));

-- E. Politique pour suppression projets (empêcher si rattachements)
-- On va vérifier côté application car les FK n'empêchent pas la suppression directement

-- F. Trigger pour audit des modifications stock
CREATE OR REPLACE FUNCTION public.audit_stock_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Log si la quantité change
    IF OLD.quantity_available != NEW.quantity_available THEN
      INSERT INTO public.audit_logs (
        user_id, 
        action, 
        table_name, 
        record_id, 
        old_values, 
        new_values
      ) VALUES (
        auth.uid(),
        'STOCK_ADJUSTMENT',
        'articles_stock',
        NEW.id,
        jsonb_build_object('quantity_available', OLD.quantity_available),
        jsonb_build_object('quantity_available', NEW.quantity_available)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Créer le trigger pour audit stock
DROP TRIGGER IF EXISTS audit_stock_trigger ON public.articles_stock;
CREATE TRIGGER audit_stock_trigger
AFTER UPDATE ON public.articles_stock
FOR EACH ROW
EXECUTE FUNCTION public.audit_stock_changes();