
-- Add DG validation columns to demandes_achat
ALTER TABLE demandes_achat 
  ADD COLUMN IF NOT EXISTS validated_dg_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS validated_dg_at timestamptz,
  ADD COLUMN IF NOT EXISTS dg_comment text;

-- Add DG validation columns to notes_frais
ALTER TABLE notes_frais
  ADD COLUMN IF NOT EXISTS validated_dg_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS validated_dg_at timestamptz,
  ADD COLUMN IF NOT EXISTS dg_comment text;
