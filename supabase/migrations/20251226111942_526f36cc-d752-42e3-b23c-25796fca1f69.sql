-- Fix besoin_lignes RLS policy to allow logistics to edit both pris_en_charge and accepte statuses

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Logistique peut éditer besoin accepté non verrouillé" ON public.besoin_lignes;

-- Create new policy that allows editing for both pris_en_charge and accepte statuses
CREATE POLICY "Logistique peut éditer besoins en cours" 
ON public.besoin_lignes 
FOR ALL
USING ((is_logistics(auth.uid()) OR is_admin(auth.uid())) AND (EXISTS ( SELECT 1
   FROM besoins b
  WHERE b.id = besoin_lignes.besoin_id AND b.status IN ('pris_en_charge', 'accepte') AND b.is_locked = false)))
WITH CHECK ((is_logistics(auth.uid()) OR is_admin(auth.uid())) AND (EXISTS ( SELECT 1
   FROM besoins b
  WHERE b.id = besoin_lignes.besoin_id AND b.status IN ('pris_en_charge', 'accepte') AND b.is_locked = false)));

-- Also add DELETE permission for logistics on besoin_lignes
DROP POLICY IF EXISTS "Logistique peut supprimer lignes besoins en cours" ON public.besoin_lignes;

CREATE POLICY "Logistique peut supprimer lignes besoins en cours"
ON public.besoin_lignes
FOR DELETE
USING ((is_logistics(auth.uid()) OR is_admin(auth.uid())) AND (EXISTS ( SELECT 1
   FROM besoins b
  WHERE b.id = besoin_lignes.besoin_id AND b.status IN ('pris_en_charge', 'accepte') AND b.is_locked = false)));

-- Fix besoins RLS - Creator should be able to modify their own needs when status is 'cree' OR 'retourne'
-- In case there's a 'retourne' status flow in the future, keeping this open
DROP POLICY IF EXISTS "Créateur peut modifier si statut cree" ON public.besoins;

CREATE POLICY "Créateur peut modifier si statut cree"
ON public.besoins
FOR UPDATE
USING (user_id = auth.uid() AND status IN ('cree'))
WITH CHECK (user_id = auth.uid() AND status IN ('cree'));

-- Make sure logistics can also INSERT besoin_lignes for besoins they are processing
DROP POLICY IF EXISTS "Logistique peut ajouter lignes besoins en cours" ON public.besoin_lignes;

CREATE POLICY "Logistique peut ajouter lignes besoins en cours"
ON public.besoin_lignes
FOR INSERT
WITH CHECK ((is_logistics(auth.uid()) OR is_admin(auth.uid())) AND (EXISTS ( SELECT 1
   FROM besoins b
  WHERE b.id = besoin_lignes.besoin_id AND b.status IN ('pris_en_charge', 'accepte') AND b.is_locked = false)));

-- Update articles_stock to allow logistics to properly manage inventory
-- Already have "Logistique peut gérer le stock" for ALL, but let's ensure it covers all cases
DROP POLICY IF EXISTS "Logistique peut créer articles stock" ON public.articles_stock;

CREATE POLICY "Logistique peut créer articles stock"
ON public.articles_stock
FOR INSERT
WITH CHECK (is_logistics(auth.uid()) OR is_admin(auth.uid()) OR has_role(auth.uid(), 'daf'::app_role));

-- Ensure bl_articles can be properly managed by logistics
DROP POLICY IF EXISTS "Logistique peut créer articles BL" ON public.bl_articles;

CREATE POLICY "Logistique peut créer articles BL"
ON public.bl_articles
FOR INSERT
WITH CHECK (is_logistics(auth.uid()) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Logistique peut modifier articles BL" ON public.bl_articles;

CREATE POLICY "Logistique peut modifier articles BL"
ON public.bl_articles
FOR UPDATE
USING (is_logistics(auth.uid()) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Logistique peut supprimer articles BL" ON public.bl_articles;

CREATE POLICY "Logistique peut supprimer articles BL"
ON public.bl_articles
FOR DELETE
USING (is_logistics(auth.uid()) OR is_admin(auth.uid()));