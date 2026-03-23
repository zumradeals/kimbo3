ALTER TABLE public.projets DROP CONSTRAINT IF EXISTS projets_status_check;

ALTER TABLE public.projets
ADD CONSTRAINT projets_status_check
CHECK (
  status = ANY (
    ARRAY[
      'brouillon'::text,
      'soumis_daf'::text,
      'valide_daf'::text,
      'actif'::text,
      'termine'::text,
      'suspendu'::text,
      'en_pause'::text,
      'annule'::text
    ]
  )
);

ALTER TABLE public.projets
ALTER COLUMN status SET DEFAULT 'brouillon'::text;