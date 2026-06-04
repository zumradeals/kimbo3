
-- 1) Champs enrichis sur expressions_besoin
ALTER TABLE public.expressions_besoin
  ADD COLUMN IF NOT EXISTS objet text,
  ADD COLUMN IF NOT EXISTS besoin_type text DEFAULT 'article',
  ADD COLUMN IF NOT EXISTS urgence besoin_urgency NOT NULL DEFAULT 'normale',
  ADD COLUMN IF NOT EXISTS description text;

-- Backfill: utiliser titre comme objet pour les expressions existantes
UPDATE public.expressions_besoin
SET objet = COALESCE(objet, titre, nom_article)
WHERE objet IS NULL;

-- 2) Champs enrichis sur les lignes
ALTER TABLE public.expressions_besoin_lignes
  ADD COLUMN IF NOT EXISTS category besoin_ligne_category NOT NULL DEFAULT 'materiel',
  ADD COLUMN IF NOT EXISTS urgency besoin_urgency NOT NULL DEFAULT 'normale';

-- 3) Table de pièces jointes pour les EB
CREATE TABLE IF NOT EXISTS public.expression_besoin_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expression_id uuid NOT NULL REFERENCES public.expressions_besoin(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expression_besoin_attachments TO authenticated;
GRANT ALL ON public.expression_besoin_attachments TO service_role;

ALTER TABLE public.expression_besoin_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "EB attachments select"
ON public.expression_besoin_attachments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.expressions_besoin eb
    WHERE eb.id = expression_id
      AND (
        eb.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = eb.user_id AND p.chef_hierarchique_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.department_id = eb.department_id)
        OR is_admin(auth.uid())
        OR is_dg(auth.uid())
        OR is_logistics(auth.uid())
        OR has_role(auth.uid(), 'daf'::app_role)
        OR has_role(auth.uid(), 'aal'::app_role)
      )
  )
);

CREATE POLICY "EB attachments insert by owner brouillon"
ON public.expression_besoin_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.expressions_besoin eb
    WHERE eb.id = expression_id
      AND eb.user_id = auth.uid()
      AND eb.status IN ('brouillon'::expression_besoin_status_v2, 'soumis'::expression_besoin_status_v2)
  )
);

CREATE POLICY "EB attachments delete by owner brouillon or admin"
ON public.expression_besoin_attachments
FOR DELETE
TO authenticated
USING (
  is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.expressions_besoin eb
    WHERE eb.id = expression_id
      AND eb.user_id = auth.uid()
      AND eb.status = 'brouillon'::expression_besoin_status_v2
  )
);

-- 4) Mise à jour de la fonction de conversion EB -> Besoin
CREATE OR REPLACE FUNCTION public.submit_expression_to_logistics(_expression_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _expression RECORD;
  _new_besoin_id uuid;
  _ligne RECORD;
  _has_lignes boolean;
BEGIN
  IF NOT can_validate_expression(_expression_id) THEN
    RAISE EXCEPTION 'Vous n''êtes pas autorisé à soumettre cette expression à la logistique';
  END IF;

  SELECT * INTO _expression FROM expressions_besoin WHERE id = _expression_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expression non trouvée';
  END IF;

  IF _expression.status != 'valide_departement' THEN
    RAISE EXCEPTION 'Seules les expressions validées par le département peuvent être soumises à la logistique';
  END IF;

  IF _expression.besoin_id IS NOT NULL THEN
    RETURN _expression.besoin_id;
  END IF;

  INSERT INTO besoins (
    title,
    description,
    category,
    urgency,
    user_id,
    department_id,
    objet_besoin,
    besoin_type,
    estimated_quantity,
    unit,
    status,
    lieu_livraison,
    site_projet,
    desired_date,
    projet_id
  ) VALUES (
    COALESCE(_expression.objet, _expression.titre, _expression.nom_article),
    COALESCE(_expression.description, _expression.commentaire, '') ||
      CASE WHEN _expression.precision_technique IS NOT NULL
        THEN E'\n\nPrécisions techniques: ' || _expression.precision_technique
        ELSE ''
      END,
    'materiel',
    COALESCE(_expression.urgence, 'normale'::besoin_urgency),
    _expression.user_id,
    _expression.department_id,
    COALESCE(_expression.objet, _expression.titre, _expression.nom_article),
    COALESCE(_expression.besoin_type, 'article'),
    COALESCE(_expression.quantite, 1),
    COALESCE(_expression.unite, 'unité'),
    'cree',
    _expression.lieu_projet,
    _expression.lieu_projet,
    _expression.date_souhaitee,
    _expression.projet_id
  ) RETURNING id INTO _new_besoin_id;

  SELECT EXISTS(
    SELECT 1 FROM expressions_besoin_lignes
    WHERE expression_id = _expression_id AND status = 'validated'
  ) INTO _has_lignes;

  IF _has_lignes THEN
    FOR _ligne IN
      SELECT * FROM expressions_besoin_lignes
      WHERE expression_id = _expression_id AND status = 'validated'
    LOOP
      INSERT INTO besoin_lignes (
        besoin_id, designation, category, quantity, unit, urgency, justification
      ) VALUES (
        _new_besoin_id,
        _ligne.nom_article,
        COALESCE(_ligne.category, 'materiel'::besoin_ligne_category),
        COALESCE(_ligne.quantite, 1),
        COALESCE(_ligne.unite, 'unité'),
        COALESCE(_ligne.urgency, _expression.urgence, 'normale'::besoin_urgency),
        _ligne.justification
      );
    END LOOP;
  ELSE
    INSERT INTO besoin_lignes (
      besoin_id, designation, category, quantity, unit, urgency
    ) VALUES (
      _new_besoin_id,
      _expression.nom_article,
      'materiel'::besoin_ligne_category,
      COALESCE(_expression.quantite, 1),
      COALESCE(_expression.unite, 'unité'),
      COALESCE(_expression.urgence, 'normale'::besoin_urgency)
    );
  END IF;

  UPDATE expressions_besoin
  SET status = 'envoye_logistique',
      besoin_id = _new_besoin_id,
      sent_to_logistics_at = now(),
      updated_at = now()
  WHERE id = _expression_id;

  RETURN _new_besoin_id;
END;
$function$;
