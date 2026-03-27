
-- Add amortization fields to immobilisations table
ALTER TABLE public.immobilisations 
  ADD COLUMN IF NOT EXISTS mode_amortissement text NOT NULL DEFAULT 'lineaire',
  ADD COLUMN IF NOT EXISTS date_debut_exercice date,
  ADD COLUMN IF NOT EXISTS mois_acquisition text;

-- Add constraint for valid values
ALTER TABLE public.immobilisations 
  ADD CONSTRAINT check_mode_amortissement 
  CHECK (mode_amortissement IN ('lineaire', 'degressif', 'non_amortissable'));

COMMENT ON COLUMN public.immobilisations.mode_amortissement IS 'Mode amortissement: lineaire, degressif, non_amortissable';
COMMENT ON COLUMN public.immobilisations.date_debut_exercice IS 'Date de début exercice comptable pour calcul prorata';
COMMENT ON COLUMN public.immobilisations.mois_acquisition IS 'Mois acquisition pour amortissement dégressif';
