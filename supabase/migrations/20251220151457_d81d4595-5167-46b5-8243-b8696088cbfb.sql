-- Étendre le ENUM bl_status avec les nouveaux statuts
ALTER TYPE public.bl_status ADD VALUE IF NOT EXISTS 'livree_partiellement';
ALTER TYPE public.bl_status ADD VALUE IF NOT EXISTS 'refusee';

-- Créer un ENUM pour les types de mouvement stock
CREATE TYPE public.stock_movement_type AS ENUM ('entree', 'sortie', 'ajustement', 'reservation', 'liberation');

-- Créer un ENUM pour les statuts stock
CREATE TYPE public.stock_status AS ENUM ('disponible', 'reserve', 'epuise');

-- Table des articles en stock
CREATE TABLE public.articles_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  designation TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'unité',
  quantity_available NUMERIC NOT NULL DEFAULT 0,
  quantity_reserved NUMERIC NOT NULL DEFAULT 0,
  quantity_min NUMERIC DEFAULT 0,
  status stock_status NOT NULL DEFAULT 'disponible',
  location TEXT, -- emplacement entrepôt
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Table des mouvements de stock
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_stock_id UUID NOT NULL REFERENCES public.articles_stock(id) ON DELETE RESTRICT,
  movement_type stock_movement_type NOT NULL,
  quantity NUMERIC NOT NULL,
  quantity_before NUMERIC NOT NULL,
  quantity_after NUMERIC NOT NULL,
  bl_id UUID REFERENCES public.bons_livraison(id),
  da_id UUID REFERENCES public.demandes_achat(id),
  reference TEXT,
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES public.profiles(id)
);

-- Ajouter des colonnes au BL pour les livraisons partielles
ALTER TABLE public.bons_livraison
  ADD COLUMN IF NOT EXISTS bl_type TEXT DEFAULT 'fournisseur' CHECK (bl_type IN ('fournisseur', 'interne')),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;

-- Ajouter des colonnes aux articles BL pour le suivi des quantités livrées
ALTER TABLE public.bl_articles
  ADD COLUMN IF NOT EXISTS quantity_ordered NUMERIC,
  ADD COLUMN IF NOT EXISTS quantity_delivered NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ecart_reason TEXT,
  ADD COLUMN IF NOT EXISTS article_stock_id UUID REFERENCES public.articles_stock(id);

-- Enable RLS
ALTER TABLE public.articles_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS pour articles_stock
CREATE POLICY "Logistique voit tout le stock"
ON public.articles_stock FOR SELECT
USING (is_logistics(auth.uid()) OR is_admin(auth.uid()) OR is_dg(auth.uid()) OR has_role(auth.uid(), 'daf'::app_role));

CREATE POLICY "Logistique peut gérer le stock"
ON public.articles_stock FOR ALL
USING (is_logistics(auth.uid()) OR is_admin(auth.uid()))
WITH CHECK (is_logistics(auth.uid()) OR is_admin(auth.uid()));

-- RLS pour stock_movements
CREATE POLICY "Logistique voit les mouvements"
ON public.stock_movements FOR SELECT
USING (is_logistics(auth.uid()) OR is_admin(auth.uid()) OR is_dg(auth.uid()) OR has_role(auth.uid(), 'daf'::app_role) OR is_comptable(auth.uid()));

CREATE POLICY "Logistique peut créer des mouvements"
ON public.stock_movements FOR INSERT
WITH CHECK ((is_logistics(auth.uid()) OR is_admin(auth.uid())) AND created_by = auth.uid());

-- Fonction pour mettre à jour le statut du stock automatiquement
CREATE OR REPLACE FUNCTION public.update_stock_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity_available <= 0 THEN
    NEW.status := 'epuise'::stock_status;
  ELSIF NEW.quantity_reserved >= NEW.quantity_available THEN
    NEW.status := 'reserve'::stock_status;
  ELSE
    NEW.status := 'disponible'::stock_status;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_stock_status_trigger
BEFORE UPDATE ON public.articles_stock
FOR EACH ROW
EXECUTE FUNCTION public.update_stock_status();

-- Fonction de notification pour livraison effectuée
CREATE OR REPLACE FUNCTION public.notify_on_bl_delivered()
RETURNS TRIGGER AS $$
DECLARE
  _dg_users UUID[];
  _daf_users UUID[];
  _user_id UUID;
BEGIN
  IF NEW.status = 'livre' AND (OLD.status IS NULL OR OLD.status != 'livre') THEN
    -- Récupérer DG
    SELECT ARRAY_AGG(user_id) INTO _dg_users
    FROM public.user_roles WHERE role = 'dg';
    
    -- Récupérer DAF
    SELECT ARRAY_AGG(user_id) INTO _daf_users
    FROM public.user_roles WHERE role = 'daf';
    
    -- Notifier DG
    IF _dg_users IS NOT NULL THEN
      FOREACH _user_id IN ARRAY _dg_users LOOP
        PERFORM public.create_notification(
          _user_id,
          'BL livré',
          'Le bon de livraison ' || NEW.reference || ' a été livré.',
          'success',
          '/bons-livraison/' || NEW.id
        );
      END LOOP;
    END IF;
    
    -- Notifier DAF
    IF _daf_users IS NOT NULL THEN
      FOREACH _user_id IN ARRAY _daf_users LOOP
        PERFORM public.create_notification(
          _user_id,
          'BL livré',
          'Le bon de livraison ' || NEW.reference || ' a été livré.',
          'success',
          '/bons-livraison/' || NEW.id
        );
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public SECURITY DEFINER;

CREATE TRIGGER notify_bl_delivered_trigger
AFTER UPDATE ON public.bons_livraison
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_bl_delivered();

-- Fonction de notification pour livraison partielle
CREATE OR REPLACE FUNCTION public.notify_on_bl_partial()
RETURNS TRIGGER AS $$
DECLARE
  _logistics_users UUID[];
  _achats_users UUID[];
  _user_id UUID;
BEGIN
  IF NEW.status = 'livree_partiellement' AND (OLD.status IS NULL OR OLD.status != 'livree_partiellement') THEN
    -- Récupérer Logistique
    SELECT ARRAY_AGG(user_id) INTO _logistics_users
    FROM public.user_roles WHERE role IN ('responsable_logistique', 'agent_logistique');
    
    -- Récupérer Achats
    SELECT ARRAY_AGG(user_id) INTO _achats_users
    FROM public.user_roles WHERE role IN ('responsable_achats', 'agent_achats');
    
    -- Notifier Logistique
    IF _logistics_users IS NOT NULL THEN
      FOREACH _user_id IN ARRAY _logistics_users LOOP
        PERFORM public.create_notification(
          _user_id,
          'Livraison partielle',
          'Le BL ' || NEW.reference || ' a été livré partiellement.',
          'warning',
          '/bons-livraison/' || NEW.id
        );
      END LOOP;
    END IF;
    
    -- Notifier Achats
    IF _achats_users IS NOT NULL THEN
      FOREACH _user_id IN ARRAY _achats_users LOOP
        PERFORM public.create_notification(
          _user_id,
          'Livraison partielle',
          'Le BL ' || NEW.reference || ' a été livré partiellement.',
          'warning',
          '/bons-livraison/' || NEW.id
        );
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public SECURITY DEFINER;

CREATE TRIGGER notify_bl_partial_trigger
AFTER UPDATE ON public.bons_livraison
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_bl_partial();