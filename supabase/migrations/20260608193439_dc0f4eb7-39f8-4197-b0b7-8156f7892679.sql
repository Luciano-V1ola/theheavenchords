
-- Permitir lectura pública (invitados) de canciones aprobadas y no ocultas
GRANT SELECT ON public.global_songs TO anon;

DROP POLICY IF EXISTS "Anon can view approved unhidden" ON public.global_songs;
CREATE POLICY "Anon can view approved unhidden"
ON public.global_songs
FOR SELECT
TO anon
USING (status = 'approved'::song_status AND hidden = false);

-- Permitir leer nombres de contribuyentes a invitados (solo display_name visible vía RLS existente)
GRANT SELECT ON public.profiles TO anon;

DROP POLICY IF EXISTS "Anon can view basic profile" ON public.profiles;
CREATE POLICY "Anon can view basic profile"
ON public.profiles
FOR SELECT
TO anon
USING (true);
