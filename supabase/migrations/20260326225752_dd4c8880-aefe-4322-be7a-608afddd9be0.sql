
-- 1. Enums
CREATE TYPE public.immobilisation_type AS ENUM ('corporel', 'incorporel');
CREATE TYPE public.immobilisation_etat AS ENUM ('neuf', 'bon', 'use', 'en_panne', 'hors_service');
CREATE TYPE public.immobilisation_status AS ENUM ('brouillon', 'validee', 'active', 'en_maintenance', 'sortie', 'reformee', 'cedee');
CREATE TYPE public.immobilisation_mode_acquisition AS ENUM ('achat_da', 'sortie_stock', 'don', 'autre');

-- 2. Sequence for code
CREATE SEQUENCE IF NOT EXISTS public.immobilisation_seq START WITH 1 INCREMENT BY 1 NO CYCLE;

-- 3. Main table
CREATE TABLE public.immobilisations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  designation TEXT NOT NULL,
  description TEXT,
  
  -- Classification
  type immobilisation_type NOT NULL DEFAULT 'corporel',
  classe_comptable INT NOT NULL DEFAULT 2,
  category TEXT,
  
  -- Acquisition
  date_acquisition DATE NOT NULL DEFAULT CURRENT_DATE,
  mode_acquisition immobilisation_mode_acquisition NOT NULL DEFAULT 'achat_da',
  valeur_acquisition NUMERIC NOT NULL DEFAULT 0,
  devise TEXT NOT NULL DEFAULT 'XOF',
  da_id UUID REFERENCES public.demandes_achat(id),
  stock_movement_id UUID REFERENCES public.stock_movements(id),
  article_stock_id UUID REFERENCES public.articles_stock(id),
  
  -- Localisation & responsibility
  emplacement TEXT,
  affecte_a UUID REFERENCES public.profiles(id),
  department_id UUID REFERENCES public.departments(id),
  
  -- Characteristics
  etat immobilisation_etat NOT NULL DEFAULT 'neuf',
  duree_vie_estimee INT, -- in months
  numero_serie TEXT,
  
  -- Workflow
  status immobilisation_status NOT NULL DEFAULT 'brouillon',
  
  -- Traceability
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  validated_by UUID REFERENCES public.profiles(id),
  validated_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. History table for all changes
CREATE TABLE public.immobilisation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  immobilisation_id UUID NOT NULL REFERENCES public.immobilisations(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'creation', 'validation', 'affectation', 'changement_etat', 'maintenance', 'sortie', 'reforme'
  old_values JSONB,
  new_values JSONB,
  comment TEXT,
  performed_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Auto-generate code trigger
CREATE OR REPLACE FUNCTION public.generate_immobilisation_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _seq INT;
  _year TEXT;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    _year := to_char(now(), 'YYYY');
    _seq := nextval('public.immobilisation_seq');
    NEW.code := 'IMMO-' || _year || '-' || LPAD(_seq::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_generate_immobilisation_code ON public.immobilisations;
CREATE TRIGGER trg_generate_immobilisation_code
  BEFORE INSERT ON public.immobilisations
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_immobilisation_code();

-- 6. Updated_at trigger
CREATE TRIGGER trg_immobilisations_updated_at
  BEFORE UPDATE ON public.immobilisations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 7. Auto-log history on status/etat/affectation changes
CREATE OR REPLACE FUNCTION public.log_immobilisation_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _action TEXT;
  _old JSONB := '{}'::JSONB;
  _new JSONB := '{}'::JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.immobilisation_history (immobilisation_id, action, new_values, performed_by)
    VALUES (NEW.id, 'creation', jsonb_build_object('status', NEW.status, 'etat', NEW.etat::TEXT, 'designation', NEW.designation), NEW.created_by);
    RETURN NEW;
  END IF;

  -- Status change
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    _action := 'changement_statut';
    _old := jsonb_build_object('status', OLD.status::TEXT);
    _new := jsonb_build_object('status', NEW.status::TEXT);
    INSERT INTO public.immobilisation_history (immobilisation_id, action, old_values, new_values, performed_by)
    VALUES (NEW.id, _action, _old, _new, COALESCE(auth.uid(), NEW.created_by));
  END IF;

  -- Etat change
  IF OLD.etat IS DISTINCT FROM NEW.etat THEN
    INSERT INTO public.immobilisation_history (immobilisation_id, action, old_values, new_values, performed_by)
    VALUES (NEW.id, 'changement_etat', jsonb_build_object('etat', OLD.etat::TEXT), jsonb_build_object('etat', NEW.etat::TEXT), COALESCE(auth.uid(), NEW.created_by));
  END IF;

  -- Affectation change
  IF OLD.affecte_a IS DISTINCT FROM NEW.affecte_a THEN
    INSERT INTO public.immobilisation_history (immobilisation_id, action, old_values, new_values, performed_by)
    VALUES (NEW.id, 'affectation', jsonb_build_object('affecte_a', OLD.affecte_a), jsonb_build_object('affecte_a', NEW.affecte_a), COALESCE(auth.uid(), NEW.created_by));
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_log_immobilisation_changes ON public.immobilisations;
CREATE TRIGGER trg_log_immobilisation_changes
  AFTER INSERT OR UPDATE ON public.immobilisations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_immobilisation_changes();

-- 8. RLS
ALTER TABLE public.immobilisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.immobilisation_history ENABLE ROW LEVEL SECURITY;

-- Immobilisations: read for authenticated, write for admin/logistics/daf
CREATE POLICY "Authenticated can read immobilisations"
  ON public.immobilisations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/logistics/daf can insert immobilisations"
  ON public.immobilisations FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid()) 
    OR public.is_logistics(auth.uid()) 
    OR public.has_role(auth.uid(), 'daf')
    OR public.has_role(auth.uid(), 'aal')
  );

CREATE POLICY "Admin/logistics/daf can update immobilisations"
  ON public.immobilisations FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid()) 
    OR public.is_logistics(auth.uid()) 
    OR public.has_role(auth.uid(), 'daf')
    OR public.has_role(auth.uid(), 'aal')
  );

-- No delete policy - archival only

-- History: read for authenticated
CREATE POLICY "Authenticated can read immobilisation history"
  ON public.immobilisation_history FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "System can insert immobilisation history"
  ON public.immobilisation_history FOR INSERT TO authenticated
  WITH CHECK (true);
