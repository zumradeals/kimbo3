-- Modifier la clé étrangère de demandes_achat.besoin_id pour CASCADE on DELETE
ALTER TABLE public.demandes_achat 
DROP CONSTRAINT IF EXISTS demandes_achat_besoin_id_fkey;

ALTER TABLE public.demandes_achat 
ADD CONSTRAINT demandes_achat_besoin_id_fkey 
FOREIGN KEY (besoin_id) REFERENCES public.besoins(id) ON DELETE CASCADE;

-- Modifier aussi la clé étrangère de bons_livraison.besoin_id pour CASCADE on DELETE
ALTER TABLE public.bons_livraison 
DROP CONSTRAINT IF EXISTS bons_livraison_besoin_id_fkey;

ALTER TABLE public.bons_livraison 
ADD CONSTRAINT bons_livraison_besoin_id_fkey 
FOREIGN KEY (besoin_id) REFERENCES public.besoins(id) ON DELETE CASCADE;