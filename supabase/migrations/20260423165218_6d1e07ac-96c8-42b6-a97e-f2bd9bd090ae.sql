-- Multi-attachments table for notes de frais
CREATE TABLE public.note_frais_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_frais_id UUID NOT NULL REFERENCES public.notes_frais(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nfa_note_frais_id ON public.note_frais_attachments(note_frais_id);
CREATE INDEX idx_nfa_created_at ON public.note_frais_attachments(created_at DESC);

ALTER TABLE public.note_frais_attachments ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone who can see the parent note_frais can see attachments
CREATE POLICY "Voir pieces jointes notes frais"
ON public.note_frais_attachments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.notes_frais nf
    WHERE nf.id = note_frais_attachments.note_frais_id
    AND (
      nf.user_id = auth.uid()
      OR is_admin(auth.uid())
      OR is_dg(auth.uid())
      OR has_role(auth.uid(), 'daf'::app_role)
      OR is_comptable(auth.uid())
      OR has_role(auth.uid(), 'aal'::app_role)
      OR is_logistics(auth.uid())
      OR is_achats(auth.uid())
      OR nf.department_id = get_user_department(auth.uid())
    )
  )
);

-- INSERT: créateur (si pas payée), admin, logistique
CREATE POLICY "Ajouter pieces jointes notes frais"
ON public.note_frais_attachments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.notes_frais nf
    WHERE nf.id = note_frais_attachments.note_frais_id
    AND nf.status <> 'payee'
    AND (
      nf.user_id = auth.uid()
      OR is_admin(auth.uid())
      OR is_logistics(auth.uid())
      OR has_role(auth.uid(), 'daf'::app_role)
    )
  )
);

-- DELETE: créateur (si pas payée), admin, logistique
CREATE POLICY "Supprimer pieces jointes notes frais"
ON public.note_frais_attachments FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.notes_frais nf
    WHERE nf.id = note_frais_attachments.note_frais_id
    AND nf.status <> 'payee'
    AND (
      nf.user_id = auth.uid()
      OR is_admin(auth.uid())
      OR is_logistics(auth.uid())
      OR has_role(auth.uid(), 'daf'::app_role)
    )
  )
);