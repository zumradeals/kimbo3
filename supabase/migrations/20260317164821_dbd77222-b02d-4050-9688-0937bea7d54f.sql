
-- Add JSONB columns to store multiple SYSCOHADA entries for DEBIT and CREDIT
ALTER TABLE public.demandes_achat
ADD COLUMN IF NOT EXISTS syscohada_debits jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS syscohada_credits jsonb DEFAULT '[]'::jsonb;

-- Migrate existing single entries to the new JSON arrays
UPDATE public.demandes_achat
SET syscohada_debits = jsonb_build_array(
  jsonb_build_object(
    'classe', syscohada_classe,
    'compte', syscohada_compte,
    'nature_charge', syscohada_nature_charge,
    'centre_cout', syscohada_centre_cout
  )
)
WHERE syscohada_classe IS NOT NULL AND (syscohada_debits IS NULL OR syscohada_debits = '[]'::jsonb);

UPDATE public.demandes_achat
SET syscohada_credits = jsonb_build_array(
  jsonb_build_object(
    'classe', syscohada_classe_2,
    'compte', syscohada_compte_2,
    'nature_charge', syscohada_nature_charge_2,
    'centre_cout', syscohada_centre_cout_2
  )
)
WHERE syscohada_classe_2 IS NOT NULL AND (syscohada_credits IS NULL OR syscohada_credits = '[]'::jsonb);
