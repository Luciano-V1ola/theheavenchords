
-- 1) Fix is_global_owner: rely solely on user_global_roles
CREATE OR REPLACE FUNCTION public.is_global_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_global_roles
    WHERE user_id = _user_id AND role = 'owner'::public.global_role
  );
$$;

-- 2) Profiles: drop the duplicate looser UPDATE policy
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

-- 3) Church members: restrict INSERT policies to authenticated role
DROP POLICY IF EXISTS "Admins can add members to their church" ON public.church_members;
CREATE POLICY "Admins can add members to their church"
ON public.church_members FOR INSERT TO authenticated
WITH CHECK (has_church_role(auth.uid(), church_id, 'admin'::app_role));

DROP POLICY IF EXISTS "Self-insert as admin only as church creator" ON public.church_members;
CREATE POLICY "Self-insert as admin only as church creator"
ON public.church_members FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() = user_id)
  AND (role = 'admin'::app_role)
  AND EXISTS (SELECT 1 FROM public.churches c WHERE c.id = church_id AND c.created_by = auth.uid())
);

DROP POLICY IF EXISTS "Self-insert as member only with valid invitation" ON public.church_members;
CREATE POLICY "Self-insert as member only with valid invitation"
ON public.church_members FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() = user_id)
  AND (role = 'member'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.invitations i
    JOIN auth.users u ON lower(u.email) = lower(i.email)
    WHERE i.church_id = church_members.church_id
      AND u.id = auth.uid()
      AND i.accepted_at IS NULL
  )
);

-- 4) Setlist songs: drop overpermissive member UPDATE policy and add scoped RPC
DROP POLICY IF EXISTS "Members can update drawing on setlist songs" ON public.setlist_songs;

CREATE OR REPLACE FUNCTION public.update_setlist_song_drawing(_id uuid, _drawing jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT s.church_id INTO v_church
  FROM public.setlist_songs ss
  JOIN public.setlists s ON s.id = ss.setlist_id
  WHERE ss.id = _id;
  IF v_church IS NULL THEN
    RAISE EXCEPTION 'Setlist song not found';
  END IF;
  IF NOT public.is_church_member(auth.uid(), v_church) THEN
    RAISE EXCEPTION 'Not a church member';
  END IF;
  UPDATE public.setlist_songs SET drawing = _drawing, updated_at = now() WHERE id = _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_setlist_song_drawing(uuid, jsonb) TO authenticated;

-- 5) Resolve user id by email (owner-only) for moderator promotion
CREATE OR REPLACE FUNCTION public.resolve_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  IF NOT public.has_global_role(auth.uid(), 'owner'::public.global_role) THEN
    RAISE EXCEPTION 'Only the app owner can resolve users by email';
  END IF;
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  RETURN v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_user_id_by_email(text) TO authenticated;
