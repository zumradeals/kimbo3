
-- Type pour le statut des rapports opérationnels
DO $$ BEGIN
  CREATE TYPE public.rapport_status AS ENUM ('brouillon', 'soumis', 'valide', 'rejete');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Table des rapports opérationnels (Achats/Logistique → AAL)
CREATE TABLE IF NOT EXISTS public.rapports_operationnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  contenu TEXT,
  type TEXT NOT NULL DEFAULT 'mensuel',
  periode_debut DATE NOT NULL,
  periode_fin DATE NOT NULL,
  status rapport_status NOT NULL DEFAULT 'brouillon',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES auth.users(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  validation_comment TEXT,
  donnees_kpi JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.rapports_operationnels ENABLE ROW LEVEL SECURITY;

-- Achats/Logistique peuvent créer des rapports
CREATE POLICY "Achats Logistique peuvent créer rapports"
  ON public.rapports_operationnels FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    (is_logistics(auth.uid()) OR is_achats(auth.uid()) OR is_admin(auth.uid()))
  );

-- Créateur peut voir ses rapports
CREATE POLICY "Créateur voit ses rapports"
  ON public.rapports_operationnels FOR SELECT
  USING (created_by = auth.uid());

-- Créateur peut modifier brouillon
CREATE POLICY "Créateur peut modifier brouillon"
  ON public.rapports_operationnels FOR UPDATE
  USING (created_by = auth.uid() AND status = 'brouillon')
  WITH CHECK (created_by = auth.uid());

-- Créateur peut supprimer brouillon
CREATE POLICY "Créateur peut supprimer brouillon"
  ON public.rapports_operationnels FOR DELETE
  USING (created_by = auth.uid() AND status = 'brouillon');

-- AAL peut voir tous les rapports soumis
CREATE POLICY "AAL voit rapports soumis"
  ON public.rapports_operationnels FOR SELECT
  USING (
    has_role(auth.uid(), 'aal'::app_role) AND status IN ('soumis', 'valide', 'rejete')
  );

-- AAL peut valider/rejeter les rapports soumis
CREATE POLICY "AAL peut valider rejeter rapports"
  ON public.rapports_operationnels FOR UPDATE
  USING (has_role(auth.uid(), 'aal'::app_role) AND status = 'soumis')
  WITH CHECK (has_role(auth.uid(), 'aal'::app_role));

-- Admin voit tout
CREATE POLICY "Admin voit tous les rapports"
  ON public.rapports_operationnels FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- DG DAF voient les rapports validés
CREATE POLICY "DG DAF voient rapports validés"
  ON public.rapports_operationnels FOR SELECT
  USING (
    (is_dg(auth.uid()) OR has_role(auth.uid(), 'daf'::app_role)) AND status = 'valide'
  );
