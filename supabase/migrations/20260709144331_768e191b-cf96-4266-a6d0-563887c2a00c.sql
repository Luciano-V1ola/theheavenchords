
-- 1) Restrict SECURITY DEFINER helper functions to authenticated only.
--    They are invoked inside RLS policies where the definer's privileges apply,
--    so no anon/public execute is needed.
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'is_church_member(uuid,uuid)',
    'has_church_role(uuid,uuid,app_role)',
    'setlist_church_id(uuid)',
    'is_owner_or_mod(uuid)',
    'is_global_owner(uuid)',
    'has_global_role(uuid,global_role)',
    'accept_invitation(uuid)',
    'resolve_user_id_by_email(text)',
    'update_setlist_song_drawing(uuid,jsonb)',
    'slugify(text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', fn);
  END LOOP;
END $$;

-- 2) Restrict anonymous access to profiles to only display_name + user_id.
--    Drop the broad anon SELECT policy and replace with a column-scoped grant.
DROP POLICY IF EXISTS "Anon can view basic profile" ON public.profiles;

-- Ensure no table-wide SELECT to anon
REVOKE SELECT ON public.profiles FROM anon;

-- Column-scoped: anon can only read these two columns (never is_owner, etc.)
GRANT SELECT (user_id, display_name) ON public.profiles TO anon;

-- Recreate an anon SELECT policy so RLS lets rows through; column privileges
-- above still restrict which columns anon can actually read.
CREATE POLICY "Anon can view public profile columns"
ON public.profiles
FOR SELECT
TO anon
USING (true);
