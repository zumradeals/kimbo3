
CREATE OR REPLACE FUNCTION submit_expression_to_logistics(_expression_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Create the besoin
  INSERT INTO besoins (
    title,
    description,
    category,
    urgency,
    user_id,
    department_id,
    objet_besoin,
    estimated_quantity,
    unit,
    status
  ) VALUES (
    COALESCE(_expression.titre, _expression.nom_article),
    COALESCE(_expression.commentaire, '') || 
      CASE WHEN _expression.precision_technique IS NOT NULL 
        THEN E'\n\nPrécisions techniques: ' || _expression.precision_technique 
        ELSE '' 
      END,
    'materiel',
    'normale',
    _expression.user_id,
    _expression.department_id,
    _expression.nom_article,
    COALESCE(_expression.quantite, 1),
    COALESCE(_expression.unite, 'unité'),
    'cree'
  ) RETURNING id INTO _new_besoin_id;
  
  -- Check if there are validated lines
  SELECT EXISTS(
    SELECT 1 FROM expressions_besoin_lignes 
    WHERE expression_id = _expression_id AND status = 'validated'
  ) INTO _has_lignes;
  
  IF _has_lignes THEN
    -- Insert from validated lines
    FOR _ligne IN 
      SELECT * FROM expressions_besoin_lignes 
      WHERE expression_id = _expression_id AND status = 'validated'
    LOOP
      INSERT INTO besoin_lignes (
        besoin_id, designation, category, quantity, unit, urgency
      ) VALUES (
        _new_besoin_id,
        _ligne.nom_article,
        'materiel',
        COALESCE(_ligne.quantite, 1),
        COALESCE(_ligne.unite, 'unité'),
        'normale'
      );
    END LOOP;
  ELSE
    -- Fallback: use parent expression data
    INSERT INTO besoin_lignes (
      besoin_id, designation, category, quantity, unit, urgency
    ) VALUES (
      _new_besoin_id,
      _expression.nom_article,
      'materiel',
      COALESCE(_expression.quantite, 1),
      COALESCE(_expression.unite, 'unité'),
      'normale'
    );
  END IF;
  
  -- Update expression status
  UPDATE expressions_besoin 
  SET status = 'envoye_logistique',
      besoin_id = _new_besoin_id,
      sent_to_logistics_at = now(),
      updated_at = now()
  WHERE id = _expression_id;
  
  RETURN _new_besoin_id;
END;
$$;
