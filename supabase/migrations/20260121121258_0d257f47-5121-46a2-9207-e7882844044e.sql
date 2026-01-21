-- Ajouter les champs projet, lieu et date souhaitée à expressions_besoin
ALTER TABLE public.expressions_besoin
ADD COLUMN IF NOT EXISTS projet_id uuid REFERENCES public.projets(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS lieu_projet text,
ADD COLUMN IF NOT EXISTS date_souhaitee date;

-- Ajouter le champ justification aux lignes d'expression
ALTER TABLE public.expressions_besoin_lignes
ADD COLUMN IF NOT EXISTS justification text;

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_expressions_besoin_projet_id ON public.expressions_besoin(projet_id);

-- Commentaires pour documentation
COMMENT ON COLUMN public.expressions_besoin.projet_id IS 'Projet lié à cette expression de besoin';
COMMENT ON COLUMN public.expressions_besoin.lieu_projet IS 'Lieu du projet ou de livraison';
COMMENT ON COLUMN public.expressions_besoin.date_souhaitee IS 'Date souhaitée pour la livraison/réalisation';
COMMENT ON COLUMN public.expressions_besoin_lignes.justification IS 'Justification du besoin pour cet article';