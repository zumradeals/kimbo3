-- Create caisses table for managing different cash registers
CREATE TABLE public.caisses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'principale' CHECK (type IN ('principale', 'logistique', 'chantier', 'projet')),
  responsable_id UUID REFERENCES public.profiles(id),
  solde_initial NUMERIC NOT NULL DEFAULT 0,
  solde_actuel NUMERIC NOT NULL DEFAULT 0,
  devise TEXT NOT NULL DEFAULT 'XAF',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Create caisse_mouvements table for tracking cash movements
CREATE TABLE public.caisse_mouvements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caisse_id UUID NOT NULL REFERENCES public.caisses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('entree', 'sortie', 'ajustement')),
  montant NUMERIC NOT NULL,
  solde_avant NUMERIC NOT NULL,
  solde_apres NUMERIC NOT NULL,
  motif TEXT NOT NULL,
  reference TEXT,
  da_id UUID REFERENCES public.demandes_achat(id),
  note_frais_id UUID REFERENCES public.notes_frais(id),
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.caisses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caisse_mouvements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for caisses
CREATE POLICY "Admin peut gérer les caisses" ON public.caisses
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "DAF peut gérer les caisses" ON public.caisses
  FOR ALL USING (has_role(auth.uid(), 'daf'::app_role))
  WITH CHECK (has_role(auth.uid(), 'daf'::app_role));

CREATE POLICY "Comptable peut voir les caisses" ON public.caisses
  FOR SELECT USING (is_comptable(auth.uid()));

CREATE POLICY "Responsable voit sa caisse" ON public.caisses
  FOR SELECT USING (responsable_id = auth.uid());

CREATE POLICY "DG voit toutes les caisses" ON public.caisses
  FOR SELECT USING (is_dg(auth.uid()));

-- RLS Policies for caisse_mouvements
CREATE POLICY "Admin peut gérer les mouvements" ON public.caisse_mouvements
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "DAF peut gérer les mouvements" ON public.caisse_mouvements
  FOR ALL USING (has_role(auth.uid(), 'daf'::app_role))
  WITH CHECK (has_role(auth.uid(), 'daf'::app_role));

CREATE POLICY "Comptable peut créer et voir les mouvements" ON public.caisse_mouvements
  FOR ALL USING (is_comptable(auth.uid()))
  WITH CHECK (is_comptable(auth.uid()));

CREATE POLICY "Responsable voit mouvements de sa caisse" ON public.caisse_mouvements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.caisses c 
      WHERE c.id = caisse_mouvements.caisse_id 
      AND c.responsable_id = auth.uid()
    )
  );

CREATE POLICY "DG voit tous les mouvements" ON public.caisse_mouvements
  FOR SELECT USING (is_dg(auth.uid()));

-- Trigger to update solde_actuel
CREATE OR REPLACE FUNCTION public.update_caisse_solde()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'entree' THEN
    UPDATE public.caisses SET solde_actuel = solde_actuel + NEW.montant, updated_at = now()
    WHERE id = NEW.caisse_id;
  ELSIF NEW.type = 'sortie' THEN
    UPDATE public.caisses SET solde_actuel = solde_actuel - NEW.montant, updated_at = now()
    WHERE id = NEW.caisse_id;
  ELSIF NEW.type = 'ajustement' THEN
    UPDATE public.caisses SET solde_actuel = NEW.solde_apres, updated_at = now()
    WHERE id = NEW.caisse_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_caisse_solde
  AFTER INSERT ON public.caisse_mouvements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_caisse_solde();

-- Trigger for updated_at
CREATE TRIGGER update_caisses_updated_at
  BEFORE UPDATE ON public.caisses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();