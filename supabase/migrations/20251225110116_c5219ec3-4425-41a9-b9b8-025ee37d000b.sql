-- Drop the old restrictive check constraint
ALTER TABLE public.besoins DROP CONSTRAINT IF EXISTS besoins_besoin_type_check;

-- Add new check constraint with all valid values from besoin_type_enum
ALTER TABLE public.besoins ADD CONSTRAINT besoins_besoin_type_check 
CHECK (besoin_type IS NULL OR besoin_type = ANY (ARRAY[
  'article'::text, 
  'service'::text, 
  'achat'::text, 
  'transport'::text, 
  'reparation'::text, 
  'location'::text, 
  'main_oeuvre'::text
]));