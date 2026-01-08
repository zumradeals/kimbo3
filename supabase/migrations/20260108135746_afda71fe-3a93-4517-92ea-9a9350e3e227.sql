-- Add note_frais_id to ecritures_comptables to support expense reports
ALTER TABLE public.ecritures_comptables 
  ALTER COLUMN da_id DROP NOT NULL,
  ADD COLUMN note_frais_id UUID REFERENCES public.notes_frais(id) ON DELETE CASCADE;

-- Add constraint to ensure either da_id or note_frais_id is set, but not both
ALTER TABLE public.ecritures_comptables 
  ADD CONSTRAINT ecritures_da_or_ndf_check 
  CHECK (
    (da_id IS NOT NULL AND note_frais_id IS NULL) OR 
    (da_id IS NULL AND note_frais_id IS NOT NULL)
  );

-- Add SYSCOHADA fields to notes_frais for accounting
ALTER TABLE public.notes_frais
  ADD COLUMN IF NOT EXISTS syscohada_classe INTEGER,
  ADD COLUMN IF NOT EXISTS syscohada_compte TEXT,
  ADD COLUMN IF NOT EXISTS syscohada_nature_charge TEXT,
  ADD COLUMN IF NOT EXISTS syscohada_centre_cout TEXT,
  ADD COLUMN IF NOT EXISTS caisse_id UUID REFERENCES public.caisses(id),
  ADD COLUMN IF NOT EXISTS comptabilise_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS comptabilise_by UUID REFERENCES public.profiles(id);

-- Create index for the new foreign key
CREATE INDEX IF NOT EXISTS idx_ecritures_note_frais_id ON public.ecritures_comptables(note_frais_id);

-- RLS policy for comptable to read notes_frais in validee_daf status
CREATE POLICY "Comptable can view validated expense reports"
ON public.notes_frais
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'comptable') AND status IN ('validee_daf', 'payee')
);

-- RLS policy for comptable to update notes_frais for payment
CREATE POLICY "Comptable can pay validated expense reports"
ON public.notes_frais
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'comptable') AND status = 'validee_daf'
)
WITH CHECK (
  public.has_role(auth.uid(), 'comptable') AND status IN ('validee_daf', 'payee')
);