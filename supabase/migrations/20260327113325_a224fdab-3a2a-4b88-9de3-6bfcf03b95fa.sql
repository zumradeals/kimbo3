
-- Fix security definer views by setting security_invoker
ALTER VIEW public.stock_kimbo_view SET (security_invoker = on);
ALTER VIEW public.stock_cump_view SET (security_invoker = on);
