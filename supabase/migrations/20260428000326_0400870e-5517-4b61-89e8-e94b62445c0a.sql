-- 1) Invitations: allow invited user to mark their own invitation accepted, and tighten join-time checks
CREATE POLICY "Invited user can accept own invitation"
ON public.invitations
FOR UPDATE
TO authenticated
USING (
  accepted_at IS NULL
  AND lower(email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))
)
WITH CHECK (
  accepted_at IS NOT NULL
  AND lower(email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))
);

-- Update accept_invitation to be defensive (already marks accepted; keep behavior)
-- (no change needed; function already sets accepted_at)

-- 2) Profiles: hide is_owner from non co-members. Restrict broad SELECT.
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

-- Own profile always
CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Co-members of any shared church can read each other's profile
CREATE POLICY "Co-members can read profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.church_members me
    JOIN public.church_members other
      ON other.church_id = me.church_id
    WHERE me.user_id = auth.uid()
      AND other.user_id = profiles.user_id
  )
);

-- Owners/mods can read all profiles (admin tooling)
CREATE POLICY "Owners and mods can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_owner_or_mod(auth.uid()));

-- 3) Revoke EXECUTE on SECURITY DEFINER helpers from anon and authenticated where not needed.
-- Keep accept_invitation callable by authenticated (used from Auth page).
REVOKE EXECUTE ON FUNCTION public.is_church_member(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_church_role(uuid, uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_global_owner(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_global_role(uuid, public.global_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_owner_or_mod(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.setlist_church_id(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_global_role() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_church() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, public;

-- These should remain callable by signed-in users from the app:
REVOKE EXECUTE ON FUNCTION public.accept_invitation(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_setlist_song_drawing(uuid, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.update_setlist_song_drawing(uuid, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.resolve_user_id_by_email(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.resolve_user_id_by_email(text) TO authenticated;
