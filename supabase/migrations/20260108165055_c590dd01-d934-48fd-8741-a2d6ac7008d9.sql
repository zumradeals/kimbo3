-- Créer l'enum pour la classe de paiement
CREATE TYPE public.payment_class AS ENUM ('REGLEMENT', 'DEPENSE');

-- Ajouter le champ payment_class à demandes_achat avec valeur par défaut REGLEMENT
ALTER TABLE public.demandes_achat 
ADD COLUMN payment_class public.payment_class DEFAULT 'REGLEMENT';

-- Ajouter le champ payment_class à notes_frais avec valeur par défaut REGLEMENT
ALTER TABLE public.notes_frais 
ADD COLUMN payment_class public.payment_class DEFAULT 'REGLEMENT';

-- Ajouter le champ payment_class à caisse_mouvements pour traçabilité
ALTER TABLE public.caisse_mouvements 
ADD COLUMN payment_class public.payment_class DEFAULT 'REGLEMENT';

-- Mettre à jour les enregistrements existants avec la valeur par défaut (REGLEMENT)
UPDATE public.demandes_achat SET payment_class = 'REGLEMENT' WHERE payment_class IS NULL;
UPDATE public.notes_frais SET payment_class = 'REGLEMENT' WHERE payment_class IS NULL;
UPDATE public.caisse_mouvements SET payment_class = 'REGLEMENT' WHERE payment_class IS NULL;