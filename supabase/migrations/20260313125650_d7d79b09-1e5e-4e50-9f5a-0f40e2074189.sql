
-- Add second SYSCOHADA classification (treasury/Class 5) to demandes_achat
ALTER TABLE public.demandes_achat
  ADD COLUMN IF NOT EXISTS syscohada_classe_2 integer,
  ADD COLUMN IF NOT EXISTS syscohada_compte_2 text,
  ADD COLUMN IF NOT EXISTS syscohada_nature_charge_2 text,
  ADD COLUMN IF NOT EXISTS syscohada_centre_cout_2 text;

-- Add second SYSCOHADA classification to notes_frais
ALTER TABLE public.notes_frais
  ADD COLUMN IF NOT EXISTS syscohada_classe_2 integer,
  ADD COLUMN IF NOT EXISTS syscohada_compte_2 text,
  ADD COLUMN IF NOT EXISTS syscohada_nature_charge_2 text,
  ADD COLUMN IF NOT EXISTS syscohada_centre_cout_2 text;

-- Add second SYSCOHADA classification to ecritures_comptables
ALTER TABLE public.ecritures_comptables
  ADD COLUMN IF NOT EXISTS classe_syscohada_2 integer,
  ADD COLUMN IF NOT EXISTS compte_comptable_2 text,
  ADD COLUMN IF NOT EXISTS nature_charge_2 text,
  ADD COLUMN IF NOT EXISTS centre_cout_2 text;
