-- Fix: Generate unique DA reference by finding max existing number
CREATE OR REPLACE FUNCTION public.generate_da_reference()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _year TEXT;
  _max_num INT;
  _ref TEXT;
BEGIN
  _year := to_char(now(), 'YYYY');
  
  -- Find the maximum existing number for this year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(reference FROM 'DA-' || _year || '-([0-9]+)') AS INT)
  ), 0) + 1
  INTO _max_num
  FROM public.demandes_achat 
  WHERE reference LIKE 'DA-' || _year || '-%';
  
  _ref := 'DA-' || _year || '-' || lpad(_max_num::TEXT, 4, '0');
  RETURN _ref;
END;
$function$;