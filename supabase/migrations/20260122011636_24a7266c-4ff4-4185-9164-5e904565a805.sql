-- Ajouter la colonne article_stock_id à da_articles pour lier aux articles du stock
ALTER TABLE public.da_articles 
ADD COLUMN IF NOT EXISTS article_stock_id uuid REFERENCES public.articles_stock(id) ON DELETE SET NULL;

-- Ajouter un index pour améliorer les performances des jointures
CREATE INDEX IF NOT EXISTS idx_da_articles_article_stock_id ON public.da_articles(article_stock_id);

-- Ajouter un commentaire pour documenter l'utilisation
COMMENT ON COLUMN public.da_articles.article_stock_id IS 'Référence optionnelle vers un article du stock existant (pour pré-remplir les prix de référence)';