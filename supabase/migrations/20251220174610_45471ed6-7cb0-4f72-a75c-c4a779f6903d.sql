-- Add Comptable to audit_logs SELECT policy
DROP POLICY IF EXISTS "Comptable peut lire les logs" ON public.audit_logs;

CREATE POLICY "Comptable peut lire les logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (is_comptable(auth.uid()));