-- ============================================================
-- MIGRATION: Notification pour statut 'retourne'
-- Date: 2025-12-30
-- ============================================================

-- Mettre à jour la fonction de notification pour inclure le statut 'retourne'
CREATE OR REPLACE FUNCTION public.notify_creator_on_besoin_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _title TEXT;
  _message TEXT;
BEGIN
  IF OLD.status <> NEW.status THEN
    CASE NEW.status
      WHEN 'pris_en_charge' THEN
        _title := 'Besoin pris en charge';
        _message := CONCAT('Votre besoin "', NEW.title, '" a été pris en charge par la Logistique.');
      WHEN 'accepte' THEN
        _title := 'Besoin accepté';
        _message := CONCAT('Votre besoin "', NEW.title, '" a été accepté pour transformation.');
      WHEN 'refuse' THEN
        _title := 'Besoin refusé';
        _message := CONCAT('Votre besoin "', NEW.title, '" a été refusé. Motif: ', COALESCE(NEW.rejection_reason, 'Non spécifié'));
      WHEN 'retourne' THEN
        _title := 'Besoin à corriger';
        _message := CONCAT('Votre besoin "', NEW.title, '" doit être corrigé. Commentaire: ', COALESCE(NEW.return_comment, 'Non spécifié'));
      WHEN 'cree' THEN
        -- Resoumission après retour
        IF OLD.status = 'retourne' THEN
          _title := 'Besoin resoumis';
          _message := CONCAT('Votre besoin "', NEW.title, '" a été resoumis pour traitement.');
        ELSE
          RETURN NEW;
        END IF;
      ELSE
        RETURN NEW;
    END CASE;
    
    PERFORM create_notification(
      NEW.user_id,
      'besoin_status_changed',
      _title,
      _message,
      '/besoins/' || NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$function$;