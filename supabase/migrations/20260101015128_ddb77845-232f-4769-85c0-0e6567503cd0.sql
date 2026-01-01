-- Fix the handle_new_user trigger to always set both role and role_id columns
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _employe_role_id UUID;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  
  -- Get the 'employe' role id from roles table
  SELECT id INTO _employe_role_id FROM public.roles WHERE code = 'employe';
  
  -- Always insert with role enum set (required NOT NULL), optionally with role_id
  INSERT INTO public.user_roles (user_id, role, role_id)
  VALUES (NEW.id, 'employe'::public.app_role, _employe_role_id);
  
  RETURN NEW;
END;
$function$;