
-- 1. Add retour_aal to da_status enum
ALTER TYPE public.da_status ADD VALUE IF NOT EXISTS 'retour_aal';

-- 2. Add soumis_aal and retour_aal to note_frais_status enum
ALTER TYPE public.note_frais_status ADD VALUE IF NOT EXISTS 'soumis_aal';
ALTER TYPE public.note_frais_status ADD VALUE IF NOT EXISTS 'retour_aal';

-- 3. Add AAL tracking columns to notes_frais
ALTER TABLE public.notes_frais 
  ADD COLUMN IF NOT EXISTS validated_aal_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS validated_aal_at timestamptz,
  ADD COLUMN IF NOT EXISTS aal_comment text,
  ADD COLUMN IF NOT EXISTS aal_rejection_reason text,
  ADD COLUMN IF NOT EXISTS return_comment text;
