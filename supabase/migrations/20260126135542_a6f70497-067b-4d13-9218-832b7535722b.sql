-- Fix demandes_achat foreign key
ALTER TABLE public.demandes_achat 
DROP CONSTRAINT IF EXISTS demandes_achat_tiers_id_fkey;

ALTER TABLE public.demandes_achat 
ADD CONSTRAINT demandes_achat_tiers_id_fkey 
FOREIGN KEY (tiers_id) REFERENCES public.tiers(id) 
ON DELETE SET NULL;

-- Fix notes_frais foreign key
ALTER TABLE public.notes_frais 
DROP CONSTRAINT IF EXISTS notes_frais_tiers_id_fkey;

ALTER TABLE public.notes_frais 
ADD CONSTRAINT notes_frais_tiers_id_fkey 
FOREIGN KEY (tiers_id) REFERENCES public.tiers(id) 
ON DELETE SET NULL;

-- Fix ecritures_comptables foreign key
ALTER TABLE public.ecritures_comptables 
DROP CONSTRAINT IF EXISTS ecritures_comptables_tiers_id_fkey;

ALTER TABLE public.ecritures_comptables 
ADD CONSTRAINT ecritures_comptables_tiers_id_fkey 
FOREIGN KEY (tiers_id) REFERENCES public.tiers(id) 
ON DELETE SET NULL;