-- Add caisse_id column to demandes_achat for linking payments to a specific cash register
ALTER TABLE public.demandes_achat ADD COLUMN IF NOT EXISTS caisse_id UUID REFERENCES public.caisses(id);

-- Create a trigger function to automatically create a caisse movement when a DA is paid
CREATE OR REPLACE FUNCTION public.create_caisse_movement_on_da_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caisse RECORD;
  _besoin RECORD;
BEGIN
  -- Only trigger when status changes to 'payee' and caisse_id is set
  IF NEW.status = 'payee' AND OLD.status = 'validee_finance' AND NEW.caisse_id IS NOT NULL THEN
    -- Get the caisse
    SELECT * INTO _caisse FROM public.caisses WHERE id = NEW.caisse_id FOR UPDATE;
    
    IF _caisse IS NOT NULL AND NEW.total_amount IS NOT NULL AND NEW.total_amount > 0 THEN
      -- Get besoin info for the reference
      SELECT title INTO _besoin FROM public.besoins WHERE id = NEW.besoin_id;
      
      -- Create the caisse movement
      INSERT INTO public.caisse_mouvements (
        caisse_id,
        type,
        montant,
        solde_avant,
        solde_apres,
        motif,
        reference,
        da_id,
        observations,
        created_by
      ) VALUES (
        NEW.caisse_id,
        'sortie',
        NEW.total_amount,
        _caisse.solde_actuel,
        _caisse.solde_actuel - NEW.total_amount,
        'Paiement DA: ' || COALESCE(_besoin.title, NEW.description),
        NEW.reference,
        NEW.id,
        'Paiement automatique - Fournisseur: ' || COALESCE(
          (SELECT name FROM public.fournisseurs WHERE id = NEW.selected_fournisseur_id),
          'Non spécifié'
        ),
        COALESCE(NEW.comptabilise_by, auth.uid())
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_create_caisse_movement_on_da_paid ON public.demandes_achat;
CREATE TRIGGER trigger_create_caisse_movement_on_da_paid
  AFTER UPDATE ON public.demandes_achat
  FOR EACH ROW
  EXECUTE FUNCTION public.create_caisse_movement_on_da_paid();