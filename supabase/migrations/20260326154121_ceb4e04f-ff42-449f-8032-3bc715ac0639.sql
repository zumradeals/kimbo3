
-- 1. Add matricule column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS matricule TEXT UNIQUE;

-- 2. Create sequence
CREATE SEQUENCE IF NOT EXISTS public.matricule_seq START WITH 1 INCREMENT BY 1 NO CYCLE;

-- 3. Auto-generate trigger function
CREATE OR REPLACE FUNCTION public.generate_matricule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _seq INT;
BEGIN
  IF NEW.matricule IS NULL THEN
    _seq := nextval('public.matricule_seq');
    NEW.matricule := 'KPM-' || LPAD(_seq::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. Trigger
DROP TRIGGER IF EXISTS trg_generate_matricule ON profiles;
CREATE TRIGGER trg_generate_matricule
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_matricule();

-- 5. Backfill existing users
WITH ordered_profiles AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM public.profiles
  WHERE matricule IS NULL
)
UPDATE public.profiles p
SET matricule = 'KPM-' || LPAD(op.rn::TEXT, 6, '0')
FROM ordered_profiles op
WHERE p.id = op.id;

-- 6. Advance sequence
SELECT setval('public.matricule_seq', COALESCE((SELECT COUNT(*) FROM public.profiles), 0));

-- 7. Make NOT NULL
ALTER TABLE public.profiles ALTER COLUMN matricule SET NOT NULL;

-- 8. Update audit trigger to include matricule
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _matricule TEXT;
BEGIN
  SELECT matricule INTO _matricule FROM public.profiles WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values)
    VALUES (auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id, jsonb_build_object('data', to_jsonb(NEW), 'matricule', _matricule));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), jsonb_build_object('data', to_jsonb(NEW), 'matricule', _matricule));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values)
    VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, jsonb_build_object('data', to_jsonb(OLD), 'matricule', _matricule));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;
