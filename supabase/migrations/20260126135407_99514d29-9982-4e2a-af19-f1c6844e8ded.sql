-- Drop the existing foreign key constraint
ALTER TABLE public.fournisseurs 
DROP CONSTRAINT IF EXISTS fournisseurs_tiers_id_fkey;

-- Recreate with ON DELETE SET NULL (preserves fournisseur but removes link)
ALTER TABLE public.fournisseurs 
ADD CONSTRAINT fournisseurs_tiers_id_fkey 
FOREIGN KEY (tiers_id) REFERENCES public.tiers(id) 
ON DELETE SET NULL;