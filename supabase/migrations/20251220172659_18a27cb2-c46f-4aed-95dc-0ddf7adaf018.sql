-- Fix RLS: allow admin, DG and DAF to view audit logs (not just admin)

DROP POLICY IF EXISTS "Seuls les admins peuvent voir les logs" ON public.audit_logs;

CREATE POLICY "Admin DG DAF peuvent voir les logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid()) 
  OR is_dg(auth.uid()) 
  OR has_role(auth.uid(), 'daf')
);