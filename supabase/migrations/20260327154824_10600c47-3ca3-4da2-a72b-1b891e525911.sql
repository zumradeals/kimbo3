-- Add destination enum type
CREATE TYPE public.article_destination AS ENUM ('stock', 'immobilisation');

-- Add destination column to besoin_lignes
ALTER TABLE public.besoin_lignes 
ADD COLUMN destination public.article_destination NOT NULL DEFAULT 'stock';

-- Add destination column to da_articles
ALTER TABLE public.da_articles 
ADD COLUMN destination public.article_destination NOT NULL DEFAULT 'stock';

-- Add destination column to bl_articles
ALTER TABLE public.bl_articles 
ADD COLUMN destination public.article_destination NOT NULL DEFAULT 'stock';