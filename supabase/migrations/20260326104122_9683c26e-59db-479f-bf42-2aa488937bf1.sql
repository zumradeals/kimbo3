
ALTER TABLE public.bons_livraison
ADD COLUMN IF NOT EXISTS receiver_name text,
ADD COLUMN IF NOT EXISTS delivery_signature text,
ADD COLUMN IF NOT EXISTS delivery_observations text;
