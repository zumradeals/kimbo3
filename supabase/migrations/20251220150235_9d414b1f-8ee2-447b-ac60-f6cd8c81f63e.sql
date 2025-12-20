-- Migration 1: Ajouter les nouveaux statuts DA pour la comptabilité
ALTER TYPE public.da_status ADD VALUE IF NOT EXISTS 'payee';
ALTER TYPE public.da_status ADD VALUE IF NOT EXISTS 'rejetee_comptabilite';