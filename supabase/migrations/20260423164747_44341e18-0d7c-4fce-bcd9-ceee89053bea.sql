-- 1. Add attachment columns to notes_frais
ALTER TABLE public.notes_frais
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_name text;

-- 2. Create storage bucket for notes de frais attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('notes-frais-attachments', 'notes-frais-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies
DROP POLICY IF EXISTS "Public can view notes-frais attachments" ON storage.objects;
CREATE POLICY "Public can view notes-frais attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'notes-frais-attachments');

DROP POLICY IF EXISTS "Authenticated can upload notes-frais attachments" ON storage.objects;
CREATE POLICY "Authenticated can upload notes-frais attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'notes-frais-attachments');

DROP POLICY IF EXISTS "Authenticated can update notes-frais attachments" ON storage.objects;
CREATE POLICY "Authenticated can update notes-frais attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'notes-frais-attachments');

DROP POLICY IF EXISTS "Authenticated can delete notes-frais attachments" ON storage.objects;
CREATE POLICY "Authenticated can delete notes-frais attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'notes-frais-attachments');

-- 4. RLS policies for logistique roles on notes_frais
DROP POLICY IF EXISTS "Logistique voit toutes les notes" ON public.notes_frais;
CREATE POLICY "Logistique voit toutes les notes"
ON public.notes_frais FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'responsable_logistique'::app_role)
  OR public.has_role(auth.uid(), 'agent_logistique'::app_role)
);

DROP POLICY IF EXISTS "Logistique peut creer notes" ON public.notes_frais;
CREATE POLICY "Logistique peut creer notes"
ON public.notes_frais FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'responsable_logistique'::app_role)
  OR public.has_role(auth.uid(), 'agent_logistique'::app_role)
);

DROP POLICY IF EXISTS "Logistique peut modifier notes non payees" ON public.notes_frais;
CREATE POLICY "Logistique peut modifier notes non payees"
ON public.notes_frais FOR UPDATE
TO authenticated
USING (
  (public.has_role(auth.uid(), 'responsable_logistique'::app_role)
   OR public.has_role(auth.uid(), 'agent_logistique'::app_role))
  AND status <> 'payee'::note_frais_status
)
WITH CHECK (
  public.has_role(auth.uid(), 'responsable_logistique'::app_role)
  OR public.has_role(auth.uid(), 'agent_logistique'::app_role)
);

DROP POLICY IF EXISTS "Logistique peut supprimer notes non payees" ON public.notes_frais;
CREATE POLICY "Logistique peut supprimer notes non payees"
ON public.notes_frais FOR DELETE
TO authenticated
USING (
  (public.has_role(auth.uid(), 'responsable_logistique'::app_role)
   OR public.has_role(auth.uid(), 'agent_logistique'::app_role))
  AND status <> 'payee'::note_frais_status
);

-- 5. Allow logistique to manage note_frais_lignes
DROP POLICY IF EXISTS "Logistique gere lignes notes" ON public.note_frais_lignes;
CREATE POLICY "Logistique gere lignes notes"
ON public.note_frais_lignes FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'responsable_logistique'::app_role)
  OR public.has_role(auth.uid(), 'agent_logistique'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'responsable_logistique'::app_role)
  OR public.has_role(auth.uid(), 'agent_logistique'::app_role)
);