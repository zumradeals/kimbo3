
-- Junction table: projet <-> caisse (many-to-many)
CREATE TABLE public.projet_caisses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id uuid NOT NULL REFERENCES public.projets(id) ON DELETE CASCADE,
  caisse_id uuid NOT NULL REFERENCES public.caisses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (projet_id, caisse_id)
);

ALTER TABLE public.projet_caisses ENABLE ROW LEVEL SECURITY;

-- SELECT: same visibility as projets (admin, dg, daf, aal, logistics, achats, comptable)
CREATE POLICY "Visibilité projet_caisses"
  ON public.projet_caisses FOR SELECT
  USING (
    is_admin(auth.uid()) OR is_dg(auth.uid()) OR has_role(auth.uid(), 'daf'::app_role)
    OR has_role(auth.uid(), 'aal'::app_role) OR is_logistics(auth.uid())
    OR is_achats(auth.uid()) OR is_comptable(auth.uid())
  );

-- INSERT: creators of projects (AAL, admin, logistics)
CREATE POLICY "Créateurs peuvent lier caisses"
  ON public.projet_caisses FOR INSERT
  WITH CHECK (
    is_admin(auth.uid()) OR has_role(auth.uid(), 'aal'::app_role) OR is_logistics(auth.uid())
  );

-- DELETE: same creators can unlink
CREATE POLICY "Créateurs peuvent délier caisses"
  ON public.projet_caisses FOR DELETE
  USING (
    is_admin(auth.uid()) OR has_role(auth.uid(), 'aal'::app_role) OR is_logistics(auth.uid())
  );

-- UPDATE: admin only
CREATE POLICY "Admin peut modifier liens caisses"
  ON public.projet_caisses FOR UPDATE
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
