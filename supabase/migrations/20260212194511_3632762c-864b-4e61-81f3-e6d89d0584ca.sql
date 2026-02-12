
-- Phase 1: Add enum values and columns only
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'aal';
ALTER TYPE public.da_status ADD VALUE IF NOT EXISTS 'validee_aal' AFTER 'chiffree';
ALTER TYPE public.da_status ADD VALUE IF NOT EXISTS 'rejetee_aal' AFTER 'validee_aal';

ALTER TABLE public.demandes_achat 
  ADD COLUMN IF NOT EXISTS validated_aal_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS validated_aal_at timestamptz,
  ADD COLUMN IF NOT EXISTS aal_rejection_reason text,
  ADD COLUMN IF NOT EXISTS aal_comment text;
