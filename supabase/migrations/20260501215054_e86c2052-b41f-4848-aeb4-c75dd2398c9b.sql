-- Restaurar permisos EXECUTE en funciones SECURITY DEFINER usadas por RLS
GRANT EXECUTE ON FUNCTION public.is_church_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_church_role(uuid, uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_global_owner(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_owner_or_mod(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_global_role(uuid, public.global_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.setlist_church_id(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_setlist_song_drawing(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_user_id_by_email(text) TO authenticated;