DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'demandes_achat') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.demandes_achat;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'bons_livraison') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bons_livraison;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notes_frais') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notes_frais;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'projet_caisses') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.projet_caisses;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'caisse_mouvements') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.caisse_mouvements;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'caisses') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.caisses;
  END IF;
END $$;