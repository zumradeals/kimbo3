-- =====================================================
-- MODULE ENTREPOTS (Multi-Stocks) - Migration
-- =====================================================

-- 1) Table des entrepôts / dépôts
CREATE TABLE public.entrepots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'interne' CHECK (type IN ('interne', 'chantier')),
  localisation TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour recherche rapide
CREATE INDEX idx_entrepots_type ON public.entrepots(type);
CREATE INDEX idx_entrepots_active ON public.entrepots(is_active);

-- Un seul entrepôt par défaut
CREATE UNIQUE INDEX idx_entrepots_single_default ON public.entrepots(is_default) WHERE is_default = true;

-- RLS pour entrepots
ALTER TABLE public.entrepots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Entrepots viewable by authenticated users"
  ON public.entrepots FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Entrepots manageable by logistics and admin"
  ON public.entrepots FOR ALL
  USING (
    public.is_logistics(auth.uid()) OR public.is_admin(auth.uid())
  );

-- 2) Ajouter entrepot_id aux mouvements de stock
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS entrepot_id UUID REFERENCES public.entrepots(id);

CREATE INDEX idx_stock_movements_entrepot ON public.stock_movements(entrepot_id);

-- 3) Ajouter entrepot_id aux articles de stock (optionnel - certains articles peuvent être multi-entrepôts)
ALTER TABLE public.articles_stock
ADD COLUMN IF NOT EXISTS entrepot_id UUID REFERENCES public.entrepots(id);

CREATE INDEX idx_articles_stock_entrepot ON public.articles_stock(entrepot_id);

-- 4) Table de niveaux de stock par entrepôt (pour gestion multi-entrepôts future)
CREATE TABLE public.stock_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrepot_id UUID NOT NULL REFERENCES public.entrepots(id) ON DELETE CASCADE,
  article_stock_id UUID NOT NULL REFERENCES public.articles_stock(id) ON DELETE CASCADE,
  quantite_disponible NUMERIC NOT NULL DEFAULT 0,
  quantite_reservee NUMERIC NOT NULL DEFAULT 0,
  quantite_min NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(entrepot_id, article_stock_id)
);

CREATE INDEX idx_stock_levels_entrepot ON public.stock_levels(entrepot_id);
CREATE INDEX idx_stock_levels_article ON public.stock_levels(article_stock_id);

-- RLS pour stock_levels
ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stock levels viewable by authenticated users"
  ON public.stock_levels FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Stock levels manageable by logistics and admin"
  ON public.stock_levels FOR ALL
  USING (
    public.is_logistics(auth.uid()) OR public.is_admin(auth.uid())
  );

-- 5) Ajouter entrepot_source_id aux bons de livraison
ALTER TABLE public.bons_livraison
ADD COLUMN IF NOT EXISTS entrepot_id UUID REFERENCES public.entrepots(id);

CREATE INDEX idx_bons_livraison_entrepot ON public.bons_livraison(entrepot_id);

-- 6) MIGRATION NON DESTRUCTIVE: Créer l'entrepôt par défaut
INSERT INTO public.entrepots (nom, type, localisation, is_active, is_default)
VALUES ('Stock Kimbo interne', 'interne', 'Dépôt principal', true, true)
ON CONFLICT DO NOTHING;

-- 7) Assigner l'entrepôt par défaut aux données existantes
-- Articles sans entrepôt → entrepôt par défaut
UPDATE public.articles_stock
SET entrepot_id = (SELECT id FROM public.entrepots WHERE is_default = true LIMIT 1)
WHERE entrepot_id IS NULL;

-- Mouvements sans entrepôt → entrepôt par défaut
UPDATE public.stock_movements
SET entrepot_id = (SELECT id FROM public.entrepots WHERE is_default = true LIMIT 1)
WHERE entrepot_id IS NULL;

-- BL sans entrepôt → entrepôt par défaut
UPDATE public.bons_livraison
SET entrepot_id = (SELECT id FROM public.entrepots WHERE is_default = true LIMIT 1)
WHERE entrepot_id IS NULL;

-- 8) Créer les niveaux de stock initiaux à partir des articles existants
INSERT INTO public.stock_levels (entrepot_id, article_stock_id, quantite_disponible, quantite_reservee, quantite_min)
SELECT 
  a.entrepot_id,
  a.id,
  a.quantity_available,
  a.quantity_reserved,
  a.quantity_min
FROM public.articles_stock a
WHERE a.entrepot_id IS NOT NULL
ON CONFLICT (entrepot_id, article_stock_id) DO UPDATE
SET 
  quantite_disponible = EXCLUDED.quantite_disponible,
  quantite_reservee = EXCLUDED.quantite_reservee,
  quantite_min = EXCLUDED.quantite_min,
  updated_at = now();

-- 9) Fonction pour obtenir la quantité disponible par entrepôt
CREATE OR REPLACE FUNCTION public.get_stock_by_entrepot(_article_id uuid, _entrepot_id uuid)
RETURNS TABLE(quantite_disponible numeric, quantite_reservee numeric, quantite_effective numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    sl.quantite_disponible,
    sl.quantite_reservee,
    GREATEST(0, sl.quantite_disponible - sl.quantite_reservee) as quantite_effective
  FROM public.stock_levels sl
  WHERE sl.article_stock_id = _article_id 
    AND sl.entrepot_id = _entrepot_id;
$$;

-- 10) Fonction pour transférer du stock entre entrepôts
CREATE OR REPLACE FUNCTION public.transferer_stock_entrepots(
  _article_id uuid,
  _entrepot_source_id uuid,
  _entrepot_dest_id uuid,
  _quantite numeric,
  _observations text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_source_level RECORD;
  v_dest_level RECORD;
  v_reference TEXT;
  v_mouvement_sortie_id UUID;
  v_mouvement_entree_id UUID;
  v_article RECORD;
BEGIN
  -- Validations
  IF _quantite <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être positive';
  END IF;
  
  IF _entrepot_source_id = _entrepot_dest_id THEN
    RAISE EXCEPTION 'Les entrepôts source et destination doivent être différents';
  END IF;
  
  -- Récupérer l'article
  SELECT * INTO v_article FROM public.articles_stock WHERE id = _article_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Article introuvable';
  END IF;
  
  -- Verrouiller et récupérer le niveau source
  SELECT * INTO v_source_level 
  FROM public.stock_levels 
  WHERE article_stock_id = _article_id AND entrepot_id = _entrepot_source_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucun stock pour cet article dans l''entrepôt source';
  END IF;
  
  IF v_source_level.quantite_disponible - v_source_level.quantite_reservee < _quantite THEN
    RAISE EXCEPTION 'Stock insuffisant dans l''entrepôt source (disponible: %)', 
      v_source_level.quantite_disponible - v_source_level.quantite_reservee;
  END IF;
  
  -- Créer ou récupérer le niveau destination
  INSERT INTO public.stock_levels (entrepot_id, article_stock_id, quantite_disponible, quantite_reservee)
  VALUES (_entrepot_dest_id, _article_id, 0, 0)
  ON CONFLICT (entrepot_id, article_stock_id) DO NOTHING;
  
  SELECT * INTO v_dest_level 
  FROM public.stock_levels 
  WHERE article_stock_id = _article_id AND entrepot_id = _entrepot_dest_id
  FOR UPDATE;
  
  v_reference := 'TRANSF-STOCK-' || to_char(now(), 'YYYYMMDD-HH24MISS');
  
  -- Créer mouvement de sortie
  INSERT INTO public.stock_movements (
    article_stock_id, entrepot_id, movement_type, quantity,
    quantity_before, quantity_after, reference, observations, created_by
  ) VALUES (
    _article_id, _entrepot_source_id, 'sortie', _quantite,
    v_source_level.quantite_disponible, v_source_level.quantite_disponible - _quantite,
    v_reference, COALESCE(_observations, 'Transfert inter-entrepôts'), auth.uid()
  ) RETURNING id INTO v_mouvement_sortie_id;
  
  -- Créer mouvement d'entrée
  INSERT INTO public.stock_movements (
    article_stock_id, entrepot_id, movement_type, quantity,
    quantity_before, quantity_after, reference, observations, created_by
  ) VALUES (
    _article_id, _entrepot_dest_id, 'entree', _quantite,
    v_dest_level.quantite_disponible, v_dest_level.quantite_disponible + _quantite,
    v_reference, COALESCE(_observations, 'Transfert inter-entrepôts'), auth.uid()
  ) RETURNING id INTO v_mouvement_entree_id;
  
  -- Mettre à jour les niveaux
  UPDATE public.stock_levels 
  SET quantite_disponible = quantite_disponible - _quantite, updated_at = now()
  WHERE article_stock_id = _article_id AND entrepot_id = _entrepot_source_id;
  
  UPDATE public.stock_levels 
  SET quantite_disponible = quantite_disponible + _quantite, updated_at = now()
  WHERE article_stock_id = _article_id AND entrepot_id = _entrepot_dest_id;
  
  RETURN v_mouvement_sortie_id;
END;
$$;