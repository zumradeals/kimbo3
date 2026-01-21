-- ============================================
-- Refactoring: Expression de Besoin en structure Groupe + Lignes
-- ============================================

-- 1. Créer la table expressions_besoin_lignes pour les articles individuels
CREATE TABLE IF NOT EXISTS public.expressions_besoin_lignes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expression_id UUID NOT NULL REFERENCES public.expressions_besoin(id) ON DELETE CASCADE,
  nom_article TEXT NOT NULL,
  
  -- Champs remplis lors de la validation par le chef
  quantite INTEGER,
  unite TEXT DEFAULT 'unité',
  precision_technique TEXT,
  
  -- Statut individuel de la ligne (validée/rejetée séparément si besoin)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'rejected')),
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Migrer les données existantes: chaque expression devient un groupe avec une seule ligne
INSERT INTO public.expressions_besoin_lignes (
  expression_id,
  nom_article,
  quantite,
  unite,
  precision_technique,
  status,
  created_at,
  updated_at
)
SELECT 
  id,
  nom_article,
  quantite,
  unite,
  precision_technique,
  CASE 
    WHEN status = 'valide_departement' OR status = 'envoye_logistique' THEN 'validated'
    WHEN status = 'rejete_departement' THEN 'rejected'
    ELSE 'pending'
  END,
  created_at,
  updated_at
FROM public.expressions_besoin
WHERE NOT EXISTS (
  SELECT 1 FROM public.expressions_besoin_lignes ebl 
  WHERE ebl.expression_id = expressions_besoin.id
);

-- 3. Ajouter un titre à expressions_besoin pour identifier le groupe
ALTER TABLE public.expressions_besoin 
ADD COLUMN IF NOT EXISTS titre TEXT;

-- 4. Générer un titre par défaut pour les expressions existantes
UPDATE public.expressions_besoin 
SET titre = 'Expression du ' || to_char(created_at, 'DD/MM/YYYY')
WHERE titre IS NULL;

-- 5. Activer RLS sur la nouvelle table
ALTER TABLE public.expressions_besoin_lignes ENABLE ROW LEVEL SECURITY;

-- 6. Policies RLS pour expressions_besoin_lignes
-- Voir toutes les lignes si on peut voir l'expression parente
CREATE POLICY "Users can view expression lines they have access to"
ON public.expressions_besoin_lignes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.expressions_besoin eb
    WHERE eb.id = expression_id
    AND (
      eb.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = eb.user_id AND p.chef_hierarchique_id = auth.uid()
      )
      OR is_admin(auth.uid())
      OR is_dg(auth.uid())
      OR is_logistics(auth.uid())
    )
  )
);

-- Insérer des lignes seulement sur ses propres expressions
CREATE POLICY "Users can insert lines on their own expressions"
ON public.expressions_besoin_lignes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.expressions_besoin eb
    WHERE eb.id = expression_id
    AND eb.user_id = auth.uid()
    AND eb.status = 'brouillon'
  )
);

-- Modifier des lignes seulement sur ses propres expressions en brouillon OU si manager
CREATE POLICY "Users can update lines on their own expressions or as manager"
ON public.expressions_besoin_lignes FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.expressions_besoin eb
    WHERE eb.id = expression_id
    AND (
      -- Propriétaire en brouillon
      (eb.user_id = auth.uid() AND eb.status = 'brouillon')
      -- Ou manager pendant validation
      OR (
        eb.status IN ('soumis', 'en_examen') AND
        EXISTS (
          SELECT 1 FROM public.profiles p 
          WHERE p.id = eb.user_id AND p.chef_hierarchique_id = auth.uid()
        )
      )
      -- Ou admin
      OR is_admin(auth.uid())
    )
  )
);

-- Supprimer des lignes seulement sur ses propres expressions en brouillon
CREATE POLICY "Users can delete lines on their own draft expressions"
ON public.expressions_besoin_lignes FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.expressions_besoin eb
    WHERE eb.id = expression_id
    AND eb.user_id = auth.uid()
    AND eb.status = 'brouillon'
  )
  OR is_admin(auth.uid())
);

-- 7. Trigger updated_at
CREATE TRIGGER update_expressions_besoin_lignes_updated_at
BEFORE UPDATE ON public.expressions_besoin_lignes
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 8. Modifier le trigger de notification pour n'envoyer qu'UNE notification par expression (pas par ligne)
-- Supprimer l'ancien trigger
DROP TRIGGER IF EXISTS trigger_notify_manager_on_expression_created ON public.expressions_besoin;

-- Recréer avec logique groupée (notification sur l'expression parente, pas les lignes)
CREATE OR REPLACE FUNCTION public.notify_manager_on_expression_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _manager_id UUID;
  _manager_name TEXT;
  _user_name TEXT;
  _article_count INT;
  _message TEXT;
BEGIN
  -- Notification seulement si statut = 'soumis' (pas brouillon)
  IF NEW.status != 'soumis' THEN
    RETURN NEW;
  END IF;

  -- Récupérer le chef hiérarchique du demandeur
  SELECT chef_hierarchique_id INTO _manager_id
  FROM profiles
  WHERE id = NEW.user_id;

  IF _manager_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Récupérer le nom du demandeur
  SELECT COALESCE(first_name || ' ' || last_name, 'Un utilisateur')
  INTO _user_name
  FROM profiles
  WHERE id = NEW.user_id;

  -- Compter les articles dans cette expression
  SELECT COUNT(*) INTO _article_count
  FROM expressions_besoin_lignes
  WHERE expression_id = NEW.id;

  -- Générer le message avec le nombre d'articles
  IF _article_count > 1 THEN
    _message := _user_name || ' a soumis une expression de besoin avec ' || _article_count || ' articles pour validation.';
  ELSE
    _message := _user_name || ' a soumis une expression de besoin pour validation.';
  END IF;

  -- Créer une seule notification pour le groupe entier
  PERFORM create_notification(
    _manager_id,
    'expression_submitted',
    'Nouvelle expression à valider',
    _message,
    '/expressions-besoin/' || NEW.id
  );

  RETURN NEW;
END;
$$;

-- Recréer le trigger (maintenant ne se déclenche que sur UPDATE vers 'soumis' aussi)
CREATE TRIGGER trigger_notify_manager_on_expression_created
  AFTER INSERT ON public.expressions_besoin
  FOR EACH ROW
  WHEN (NEW.status = 'soumis')
  EXECUTE FUNCTION public.notify_manager_on_expression_created();

-- Ajouter un trigger pour la soumission différée (brouillon -> soumis)
CREATE OR REPLACE FUNCTION public.notify_manager_on_expression_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _manager_id UUID;
  _user_name TEXT;
  _article_count INT;
  _message TEXT;
BEGIN
  -- Seulement si le statut change de brouillon vers soumis
  IF OLD.status = 'brouillon' AND NEW.status = 'soumis' THEN
    -- Récupérer le chef hiérarchique
    SELECT chef_hierarchique_id INTO _manager_id
    FROM profiles
    WHERE id = NEW.user_id;

    IF _manager_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Nom du demandeur
    SELECT COALESCE(first_name || ' ' || last_name, 'Un utilisateur')
    INTO _user_name
    FROM profiles
    WHERE id = NEW.user_id;

    -- Compter les articles
    SELECT COUNT(*) INTO _article_count
    FROM expressions_besoin_lignes
    WHERE expression_id = NEW.id;

    IF _article_count > 1 THEN
      _message := _user_name || ' a soumis une expression de besoin avec ' || _article_count || ' articles pour validation.';
    ELSE
      _message := _user_name || ' a soumis une expression de besoin pour validation.';
    END IF;

    PERFORM create_notification(
      _manager_id,
      'expression_submitted',
      'Nouvelle expression à valider',
      _message,
      '/expressions-besoin/' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_manager_on_expression_submitted
  AFTER UPDATE ON public.expressions_besoin
  FOR EACH ROW
  WHEN (OLD.status = 'brouillon' AND NEW.status = 'soumis')
  EXECUTE FUNCTION public.notify_manager_on_expression_submitted();

-- 9. Créer un index pour les performances
CREATE INDEX IF NOT EXISTS idx_expressions_besoin_lignes_expression_id 
ON public.expressions_besoin_lignes(expression_id);

-- 10. Activer realtime sur la nouvelle table
ALTER PUBLICATION supabase_realtime ADD TABLE public.expressions_besoin_lignes;