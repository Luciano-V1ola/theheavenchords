
CREATE TABLE public.user_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  global_song_id uuid NOT NULL REFERENCES public.global_songs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, global_song_id)
);
CREATE INDEX idx_user_favorites_user ON public.user_favorites(user_id);

GRANT SELECT, INSERT, DELETE ON public.user_favorites TO authenticated;
GRANT ALL ON public.user_favorites TO service_role;

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favs_own_select" ON public.user_favorites
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "favs_own_insert" ON public.user_favorites
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "favs_own_delete" ON public.user_favorites
  FOR DELETE TO authenticated USING (user_id = auth.uid());
