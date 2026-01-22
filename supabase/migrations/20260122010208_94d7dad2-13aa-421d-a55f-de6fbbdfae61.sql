
-- 1. Create tiers_type enum (if not exists)
DO $$ BEGIN
  CREATE TYPE public.tiers_type AS ENUM (
    'fournisseur',
    'prestataire',
    'transporteur',
    'particulier',
    'autre'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create tiers table
CREATE TABLE IF NOT EXISTS public.tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  type public.tiers_type NOT NULL DEFAULT 'autre',
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  numero_contribuable TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- 3. Add tiers_id to fournisseurs table
ALTER TABLE public.fournisseurs 
ADD COLUMN IF NOT EXISTS tiers_id UUID REFERENCES public.tiers(id);

-- 4. Add tiers_id to demandes_achat for direct tiers payments
ALTER TABLE public.demandes_achat 
ADD COLUMN IF NOT EXISTS tiers_id UUID REFERENCES public.tiers(id);

-- 5. Add tiers_id to notes_frais for expense reports
ALTER TABLE public.notes_frais 
ADD COLUMN IF NOT EXISTS tiers_id UUID REFERENCES public.tiers(id);

-- 6. Add tiers_id to ecritures_comptables
ALTER TABLE public.ecritures_comptables 
ADD COLUMN IF NOT EXISTS tiers_id UUID REFERENCES public.tiers(id);

-- 7. Migrate existing fournisseurs to tiers
INSERT INTO public.tiers (nom, type, telephone, email, adresse, is_active, notes)
SELECT 
  name,
  'fournisseur'::public.tiers_type,
  phone,
  email,
  address,
  is_active,
  notes
FROM public.fournisseurs
WHERE deleted_at IS NULL;

-- 8. Link fournisseurs to their newly created tiers
UPDATE public.fournisseurs f
SET tiers_id = t.id
FROM public.tiers t
WHERE t.nom = f.name 
  AND t.type = 'fournisseur'
  AND f.deleted_at IS NULL;

-- 9. Enable RLS on tiers
ALTER TABLE public.tiers ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies for tiers
CREATE POLICY "Roles autorisés peuvent voir les tiers"
ON public.tiers FOR SELECT
USING (
  is_logistics(auth.uid()) 
  OR is_achats(auth.uid()) 
  OR is_comptable(auth.uid()) 
  OR has_role(auth.uid(), 'daf'::app_role) 
  OR is_dg(auth.uid()) 
  OR is_admin(auth.uid())
);

CREATE POLICY "Roles autorisés peuvent créer des tiers"
ON public.tiers FOR INSERT
WITH CHECK (
  is_logistics(auth.uid()) 
  OR is_achats(auth.uid()) 
  OR is_comptable(auth.uid()) 
  OR has_role(auth.uid(), 'daf'::app_role) 
  OR is_dg(auth.uid()) 
  OR is_admin(auth.uid())
);

CREATE POLICY "Roles autorisés peuvent modifier les tiers"
ON public.tiers FOR UPDATE
USING (
  is_logistics(auth.uid()) 
  OR is_achats(auth.uid()) 
  OR is_comptable(auth.uid()) 
  OR has_role(auth.uid(), 'daf'::app_role) 
  OR is_dg(auth.uid()) 
  OR is_admin(auth.uid())
);

CREATE POLICY "Admin peut supprimer les tiers"
ON public.tiers FOR DELETE
USING (is_admin(auth.uid()));

-- 11. Trigger for updated_at
DROP TRIGGER IF EXISTS update_tiers_updated_at ON public.tiers;
CREATE TRIGGER update_tiers_updated_at
BEFORE UPDATE ON public.tiers
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 12. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tiers_type ON public.tiers(type);
CREATE INDEX IF NOT EXISTS idx_tiers_is_active ON public.tiers(is_active);
CREATE INDEX IF NOT EXISTS idx_fournisseurs_tiers_id ON public.fournisseurs(tiers_id);
