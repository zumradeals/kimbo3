-- Fix storage policies for besoins-attachments bucket
-- The upload path uses besoinId as folder, not userId

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can upload their own besoins attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own besoins attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view besoins attachments" ON storage.objects;

-- Create new policies that work with besoinId as folder structure
-- Allow authenticated users to upload to besoins-attachments bucket
CREATE POLICY "Authenticated users can upload besoins attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'besoins-attachments');

-- Allow viewing attachments for authenticated users (bucket is public anyway)
CREATE POLICY "Authenticated users can view besoins attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'besoins-attachments');

-- Allow delete for admin and logistics roles
CREATE POLICY "Admin and logistics can delete besoins attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'besoins-attachments' 
  AND (is_admin(auth.uid()) OR is_logistics(auth.uid()))
);