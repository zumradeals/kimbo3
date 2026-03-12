
-- Add en_attente_dg to da_status enum
ALTER TYPE da_status ADD VALUE IF NOT EXISTS 'en_attente_dg';

-- Add en_attente_dg to note_frais_status enum
ALTER TYPE note_frais_status ADD VALUE IF NOT EXISTS 'en_attente_dg';
