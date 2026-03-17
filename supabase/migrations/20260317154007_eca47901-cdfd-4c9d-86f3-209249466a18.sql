-- Full recreation of tiers_type enum
CREATE TYPE public.tiers_type_v2 AS ENUM ('fournisseur', 'sous_traitant', 'salarie', 'client', 'banque', 'autre');

ALTER TABLE public.tiers ALTER COLUMN type DROP DEFAULT;
ALTER TABLE public.tiers ALTER COLUMN type TYPE text;

UPDATE public.tiers SET type = 'sous_traitant' WHERE type = 'prestataire';
UPDATE public.tiers SET type = 'autre' WHERE type = 'transporteur';
UPDATE public.tiers SET type = 'autre' WHERE type = 'particulier';

ALTER TABLE public.tiers ALTER COLUMN type TYPE public.tiers_type_v2 USING type::public.tiers_type_v2;
ALTER TABLE public.tiers ALTER COLUMN type SET DEFAULT 'autre'::public.tiers_type_v2;

DROP TYPE public.tiers_type;
ALTER TYPE public.tiers_type_v2 RENAME TO tiers_type;