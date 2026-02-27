
-- Drop restrictive delete policies for besoins
DROP POLICY IF EXISTS "Logistique peut supprimer besoins en cours" ON public.besoins;

-- Create new policy: Logistique/Achats can delete besoins regardless of status
CREATE POLICY "Logistique Achats peuvent supprimer besoins"
ON public.besoins FOR DELETE TO authenticated
USING (is_logistics(auth.uid()) OR is_achats(auth.uid()));

-- Drop restrictive delete policies for DA
DROP POLICY IF EXISTS "Logistique Achats peuvent supprimer DA non payees" ON public.demandes_achat;
DROP POLICY IF EXISTS "Logistique peut supprimer DA brouillon" ON public.demandes_achat;

-- Create new policy: Logistique/Achats can delete DA regardless of status
CREATE POLICY "Logistique Achats peuvent supprimer DA"
ON public.demandes_achat FOR DELETE TO authenticated
USING (is_logistics(auth.uid()) OR is_achats(auth.uid()));
