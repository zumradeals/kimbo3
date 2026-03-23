-- Fix: update_caisse_solde should NOT handle 'ajustement' type
-- because adjust_caisse_solde_initial already sets NEW.solde_actuel in BEFORE trigger
CREATE OR REPLACE FUNCTION public.update_caisse_solde()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.type = 'entree' THEN
    UPDATE public.caisses SET solde_actuel = solde_actuel + NEW.montant, updated_at = now()
    WHERE id = NEW.caisse_id;
  ELSIF NEW.type = 'sortie' THEN
    UPDATE public.caisses SET solde_actuel = solde_actuel - NEW.montant, updated_at = now()
    WHERE id = NEW.caisse_id;
  END IF;
  -- 'ajustement' type is handled by adjust_caisse_solde_initial trigger (BEFORE UPDATE on caisses)
  -- Removing the ajustement handler here prevents recursive trigger loops
  RETURN NEW;
END;
$function$;