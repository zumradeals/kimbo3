-- Allow all authenticated users to see all profiles (for the directory)
CREATE POLICY "Tous les utilisateurs authentifiés peuvent voir les profils"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Drop the old restrictive SELECT policy (now redundant)
DROP POLICY IF EXISTS "Les utilisateurs peuvent voir leur propre profil" ON public.profiles;
