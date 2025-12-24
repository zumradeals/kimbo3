-- Drop and recreate get_public_profiles to include email
DROP FUNCTION IF EXISTS public.get_public_profiles(uuid[]);

CREATE OR REPLACE FUNCTION public.get_public_profiles(_user_ids uuid[])
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  department_name text,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.first_name,
    p.last_name,
    d.name as department_name,
    p.email
  FROM public.profiles p
  LEFT JOIN public.departments d ON p.department_id = d.id
  WHERE p.id = ANY(_user_ids);
$$;