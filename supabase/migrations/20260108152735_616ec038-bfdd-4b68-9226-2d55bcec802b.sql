-- ===========================================
-- MODULE: EXPRESSIONS DE BESOIN (AMONT DU SYSTÈME)
-- ===========================================

-- 1. Créer l'enum pour le statut des expressions
CREATE TYPE public.expression_besoin_status AS ENUM ('en_attente', 'validee', 'rejetee');

-- 2. Créer la table expressions_besoin
CREATE TABLE public.expressions_besoin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identification
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  chef_validateur_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Contenu (strictement limité à la création)
  nom_article TEXT NOT NULL,
  commentaire TEXT,
  
  -- Champs remplis à la validation par le chef
  quantite INTEGER,
  unite TEXT DEFAULT 'unité',
  precision_technique TEXT,
  
  -- Statut et workflow
  status public.expression_besoin_status NOT NULL DEFAULT 'en_attente',
  
  -- Traçabilité création
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Traçabilité validation/rejet
  validated_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Lien vers le besoin créé après validation
  besoin_id UUID REFERENCES public.besoins(id) ON DELETE SET NULL,
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Index pour les performances
CREATE INDEX idx_expressions_besoin_user_id ON public.expressions_besoin(user_id);
CREATE INDEX idx_expressions_besoin_department_id ON public.expressions_besoin(department_id);
CREATE INDEX idx_expressions_besoin_chef_validateur_id ON public.expressions_besoin(chef_validateur_id);
CREATE INDEX idx_expressions_besoin_status ON public.expressions_besoin(status);
CREATE INDEX idx_expressions_besoin_created_at ON public.expressions_besoin(created_at DESC);

-- 4. Trigger pour updated_at
CREATE TRIGGER set_expressions_besoin_updated_at
  BEFORE UPDATE ON public.expressions_besoin
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5. Activer RLS
ALTER TABLE public.expressions_besoin ENABLE ROW LEVEL SECURITY;

-- 6. Politiques RLS

-- 6.1 Les utilisateurs peuvent voir leurs propres expressions
CREATE POLICY "Users can view their own expressions"
ON public.expressions_besoin
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 6.2 Les chefs hiérarchiques peuvent voir les expressions de leurs subordonnés
CREATE POLICY "Managers can view subordinate expressions"
ON public.expressions_besoin
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = expressions_besoin.user_id
      AND p.chef_hierarchique_id = auth.uid()
  )
);

-- 6.3 Admin/DG/DAF peuvent tout voir
CREATE POLICY "Admin/DG/DAF can view all expressions"
ON public.expressions_besoin
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid()) OR 
  public.is_dg(auth.uid()) OR 
  public.has_role(auth.uid(), 'daf'::app_role)
);

-- 6.4 Tout utilisateur avec un département peut créer une expression
CREATE POLICY "Users with department can create expressions"
ON public.expressions_besoin
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.department_id IS NOT NULL
  )
);

-- 6.5 Les chefs hiérarchiques peuvent valider/rejeter
CREATE POLICY "Managers can update subordinate expressions"
ON public.expressions_besoin
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = expressions_besoin.user_id
      AND p.chef_hierarchique_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = expressions_besoin.user_id
      AND p.chef_hierarchique_id = auth.uid()
  )
);

-- 6.6 Admin peut tout modifier
CREATE POLICY "Admin can update all expressions"
ON public.expressions_besoin
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 6.7 Suppression par admin uniquement
CREATE POLICY "Admin can delete expressions"
ON public.expressions_besoin
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- 7. Ajouter la permission pour le module expressions dans la table permissions
INSERT INTO public.permissions (code, name, module, description) VALUES
  ('expressions.voir', 'Voir les expressions de besoin', 'expressions', 'Permet de voir le module Expressions de besoin'),
  ('expressions.creer', 'Créer une expression de besoin', 'expressions', 'Permet de créer une expression de besoin'),
  ('expressions.valider', 'Valider les expressions', 'expressions', 'Permet de valider ou rejeter les expressions de ses subordonnés')
ON CONFLICT (code) DO NOTHING;

-- 8. Fonction pour notifier le chef hiérarchique lors de la création
CREATE OR REPLACE FUNCTION public.notify_manager_on_expression_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _chef_id UUID;
  _user_name TEXT;
BEGIN
  -- Récupérer l'ID du chef hiérarchique
  SELECT chef_hierarchique_id INTO _chef_id
  FROM public.profiles
  WHERE id = NEW.user_id;
  
  -- Récupérer le nom de l'utilisateur
  SELECT CONCAT(first_name, ' ', last_name) INTO _user_name
  FROM public.profiles
  WHERE id = NEW.user_id;
  
  -- Notifier le chef s'il existe
  IF _chef_id IS NOT NULL THEN
    PERFORM create_notification(
      _chef_id,
      'expression_created',
      'Nouvelle expression de besoin',
      CONCAT(_user_name, ' a soumis une expression de besoin : ', NEW.nom_article),
      '/expressions-besoin/' || NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_manager_on_expression_created
  AFTER INSERT ON public.expressions_besoin
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_manager_on_expression_created();

-- 9. Fonction pour notifier le créateur lors de la validation/rejet
CREATE OR REPLACE FUNCTION public.notify_user_on_expression_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _title TEXT;
  _message TEXT;
BEGIN
  IF OLD.status = 'en_attente' AND NEW.status != 'en_attente' THEN
    IF NEW.status = 'validee' THEN
      _title := 'Expression validée';
      _message := CONCAT('Votre expression de besoin "', NEW.nom_article, '" a été validée par votre responsable.');
    ELSIF NEW.status = 'rejetee' THEN
      _title := 'Expression rejetée';
      _message := CONCAT('Votre expression de besoin "', NEW.nom_article, '" a été rejetée. Motif: ', COALESCE(NEW.rejection_reason, 'Non spécifié'));
    END IF;
    
    IF _title IS NOT NULL THEN
      PERFORM create_notification(
        NEW.user_id,
        'expression_status_changed',
        _title,
        _message,
        '/expressions-besoin/' || NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_user_on_expression_status_change
  AFTER UPDATE ON public.expressions_besoin
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_user_on_expression_status_change();