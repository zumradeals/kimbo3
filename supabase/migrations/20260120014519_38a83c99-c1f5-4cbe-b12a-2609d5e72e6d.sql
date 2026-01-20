-- Fix generate_ndf_reference to use MAX instead of COUNT to avoid duplicate key errors
CREATE OR REPLACE FUNCTION public.generate_ndf_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year TEXT;
  _month TEXT;
  _max_num INT;
  _ref TEXT;
  _prefix TEXT;
BEGIN
  _year := to_char(now(), 'YYYY');
  _month := to_char(now(), 'MM');
  _prefix := 'NDF-' || _year || _month || '-';
  
  -- Get the maximum number used, not count (which can skip numbers on deletions)
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(reference, '^NDF-\d{6}-', ''), '')::INT
  ), 0) + 1 INTO _max_num
  FROM public.notes_frais 
  WHERE reference LIKE _prefix || '%';
  
  _ref := _prefix || lpad(_max_num::TEXT, 4, '0');
  
  -- Safety: if reference already exists (concurrent insert), increment
  WHILE EXISTS (SELECT 1 FROM public.notes_frais WHERE reference = _ref) LOOP
    _max_num := _max_num + 1;
    _ref := _prefix || lpad(_max_num::TEXT, 4, '0');
  END LOOP;
  
  RETURN _ref;
END;
$$;