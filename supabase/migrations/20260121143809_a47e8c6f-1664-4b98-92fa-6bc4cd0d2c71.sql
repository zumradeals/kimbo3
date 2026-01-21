
-- Allow Logistique to delete besoins that are in progress (not locked, not final status)
CREATE POLICY "Logistique peut supprimer besoins en cours"
ON public.besoins
FOR DELETE
USING (
  (is_logistics(auth.uid()) OR is_achats(auth.uid()))
  AND status NOT IN ('annulee')
  AND is_locked = false
);

-- Allow Logistique/Achats to delete DA that are not paid
DROP POLICY IF EXISTS "Achats peut annuler ses DA" ON public.demandes_achat;
DROP POLICY IF EXISTS "Admin peut supprimer DA" ON public.demandes_achat;

CREATE POLICY "Logistique Achats peuvent supprimer DA non payees"
ON public.demandes_achat
FOR DELETE
USING (
  (is_logistics(auth.uid()) OR is_achats(auth.uid()) OR is_admin(auth.uid()))
  AND status NOT IN ('payee')
);
