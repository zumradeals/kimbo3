-- Ajouter la colonne article_stock_id à besoin_lignes pour lier aux articles du stock
ALTER TABLE public.besoin_lignes 
ADD COLUMN article_stock_id uuid REFERENCES public.articles_stock(id) ON DELETE SET NULL;

-- Ajouter un index pour améliorer les performances des jointures
CREATE INDEX idx_besoin_lignes_article_stock_id ON public.besoin_lignes(article_stock_id);

-- Ajouter un commentaire pour documenter l'utilisation
COMMENT ON COLUMN public.besoin_lignes.article_stock_id IS 'Référence optionnelle vers un article du stock existant';