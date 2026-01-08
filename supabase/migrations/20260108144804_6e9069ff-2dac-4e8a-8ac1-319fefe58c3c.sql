-- 1. Add new columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS fonction TEXT,
ADD COLUMN IF NOT EXISTS chef_hierarchique_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS position_departement TEXT DEFAULT 'membre' CHECK (position_departement IN ('membre', 'chef_departement', 'adjoint')),
ADD COLUMN IF NOT EXISTS statut_utilisateur TEXT DEFAULT 'actif' CHECK (statut_utilisateur IN ('actif', 'interim', 'absent'));

-- 2. Create index for hierarchical queries
CREATE INDEX IF NOT EXISTS idx_profiles_chef_hierarchique ON public.profiles(chef_hierarchique_id);
CREATE INDEX IF NOT EXISTS idx_profiles_department_position ON public.profiles(department_id, position_departement);

-- 3. Create storage bucket for profile photos if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage policies for profile photos
CREATE POLICY "Users can upload their own photo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view profile photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can update their own photo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own photo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Update RLS policy for profiles to allow self-update of new fields
CREATE POLICY "Users can update their own profile fields"
ON public.profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());