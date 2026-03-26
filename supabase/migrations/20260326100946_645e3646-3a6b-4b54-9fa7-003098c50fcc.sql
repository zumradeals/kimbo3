
-- Fix security definer view - set to SECURITY INVOKER
ALTER VIEW public.stock_kimbo_view SET (security_invoker = on);
