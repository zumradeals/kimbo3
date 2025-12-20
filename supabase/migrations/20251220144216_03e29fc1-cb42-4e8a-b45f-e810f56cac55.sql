-- =====================================================
-- MODULE SERVICE ACHATS (v2) - Part 1: Enum extension
-- =====================================================

-- Étendre les statuts DA pour le flux Achats
ALTER TYPE public.da_status ADD VALUE IF NOT EXISTS 'en_analyse';
ALTER TYPE public.da_status ADD VALUE IF NOT EXISTS 'chiffree';
ALTER TYPE public.da_status ADD VALUE IF NOT EXISTS 'soumise_validation';