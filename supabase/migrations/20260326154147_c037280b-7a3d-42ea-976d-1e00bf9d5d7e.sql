
DROP FUNCTION IF EXISTS public.get_public_profiles(uuid[]);

CREATE FUNCTION public.get_public_profiles(_user_ids uuid[])
RETURNS TABLE(id uuid, first_name text, last_name text, department_name text, fonction text, photo_url text, email text, matricule text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    d.name AS department_name,
    p.fonction,
    p.photo_url,
    p.email,
    p.matricule
  FROM public.profiles p
  LEFT JOIN public.departments d ON d.id = p.department_id
  WHERE p.id = ANY(_user_ids);
$function$;
