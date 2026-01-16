-- Tighten overly permissive RLS policies flagged by the linter

-- AUDIT_LOGS: allow inserts only when user_id matches the authenticated user
DROP POLICY IF EXISTS "Le système peut insérer des logs" ON public.audit_logs;
CREATE POLICY "Les utilisateurs peuvent insérer leurs logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
);

-- NOTIFICATIONS: prevent arbitrary inserts; only allow a user to insert notifications for themselves
DROP POLICY IF EXISTS "Système peut créer des notifications" ON public.notifications;
CREATE POLICY "Les utilisateurs peuvent s'auto-notifier"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
);
