-- Fix notes_frais RLS policies

-- Drop the restrictive policy that prevents submission
DROP POLICY IF EXISTS "Créateur peut modifier brouillon" ON public.notes_frais;

-- Create a proper policy that allows creator to submit (change from brouillon to soumise)
CREATE POLICY "Créateur peut soumettre note" 
ON public.notes_frais 
FOR UPDATE
USING (user_id = auth.uid() AND status IN ('brouillon', 'rejetee'))
WITH CHECK (user_id = auth.uid() AND status IN ('brouillon', 'soumise'));

-- Fix DAF validation policy - needs WITH CHECK clause
DROP POLICY IF EXISTS "DAF peut valider notes" ON public.notes_frais;

CREATE POLICY "DAF peut valider notes" 
ON public.notes_frais 
FOR UPDATE
USING (has_role(auth.uid(), 'daf'::app_role) AND status = 'soumise')
WITH CHECK (has_role(auth.uid(), 'daf'::app_role) AND status IN ('soumise', 'validee_daf', 'rejetee'));

-- Fix Comptable payment policy - needs WITH CHECK clause
DROP POLICY IF EXISTS "Comptable peut payer notes" ON public.notes_frais;

CREATE POLICY "Comptable peut payer notes" 
ON public.notes_frais 
FOR UPDATE
USING (is_comptable(auth.uid()) AND status = 'validee_daf')
WITH CHECK (is_comptable(auth.uid()) AND status IN ('validee_daf', 'payee'));

-- Fix DAF payment policy - needs WITH CHECK clause
DROP POLICY IF EXISTS "DAF peut payer notes frais" ON public.notes_frais;

CREATE POLICY "DAF peut payer notes frais" 
ON public.notes_frais 
FOR UPDATE
USING (has_role(auth.uid(), 'daf'::app_role) AND status = 'validee_daf')
WITH CHECK (has_role(auth.uid(), 'daf'::app_role) AND status IN ('validee_daf', 'payee'));

-- Fix articles_stock SELECT policy to allow all authenticated users with relevant roles
DROP POLICY IF EXISTS "Logistique voit tout le stock" ON public.articles_stock;

CREATE POLICY "Roles autorisés voient le stock"
ON public.articles_stock
FOR SELECT
USING (
  is_logistics(auth.uid()) OR 
  is_admin(auth.uid()) OR 
  is_dg(auth.uid()) OR 
  has_role(auth.uid(), 'daf'::app_role) OR
  is_achats(auth.uid())
);

-- Add policy allowing notes_frais rejection by DAF/DG
DROP POLICY IF EXISTS "DAF DG peuvent rejeter notes" ON public.notes_frais;

CREATE POLICY "DAF DG peuvent rejeter notes"
ON public.notes_frais
FOR UPDATE
USING ((has_role(auth.uid(), 'daf'::app_role) OR is_dg(auth.uid()) OR is_admin(auth.uid())) AND status IN ('soumise', 'validee_daf'))
WITH CHECK ((has_role(auth.uid(), 'daf'::app_role) OR is_dg(auth.uid()) OR is_admin(auth.uid())) AND status IN ('soumise', 'validee_daf', 'rejetee'));