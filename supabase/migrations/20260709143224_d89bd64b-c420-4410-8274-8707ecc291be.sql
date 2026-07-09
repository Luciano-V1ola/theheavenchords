
-- 1) profiles: restrict anon exposure to only display_name via column-level GRANT
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (user_id, display_name) ON public.profiles TO anon;

-- 2) user_global_roles: least privilege — user sees own row; owner/mod see all
DROP POLICY IF EXISTS "Anyone authenticated can read global roles" ON public.user_global_roles;
CREATE POLICY "Users can read their own global role"
  ON public.user_global_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Owners and mods can read all global roles"
  ON public.user_global_roles FOR SELECT TO authenticated
  USING (public.is_owner_or_mod(auth.uid()));

-- 3) Revoke public/anon/authenticated EXECUTE from trigger-only SECURITY DEFINER functions.
-- Triggers execute regardless of caller EXECUTE privilege, so this doesn't break anything.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_global_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_church() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_last_admin_removal() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.global_songs_maintain_slug() FROM PUBLIC, anon, authenticated;

-- 4) Restrict RPCs called from the client to authenticated only (revoke anon)
REVOKE ALL ON FUNCTION public.accept_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.resolve_user_id_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_user_id_by_email(text) TO authenticated;

REVOKE ALL ON FUNCTION public.update_setlist_song_drawing(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_setlist_song_drawing(uuid, jsonb) TO authenticated;
