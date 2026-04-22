
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;

UPDATE public.profiles p
SET is_owner = true
FROM auth.users u
WHERE p.user_id = u.id AND lower(u.email) = 'dva.lucho@gmail.com';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, is_owner)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    lower(NEW.email) = 'dva.lucho@gmail.com'
  )
  ON CONFLICT (user_id) DO UPDATE SET is_owner = EXCLUDED.is_owner;
  RETURN NEW;
END;
$function$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can read own profile'
  ) THEN
    CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can update own profile'
  ) THEN
    DROP POLICY "Users can update own profile" ON public.profiles;
  END IF;
END $$;

CREATE POLICY "Users can update own profile (no owner escalation)"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND is_owner = (SELECT p.is_owner FROM public.profiles p WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "User can insert self as member (via invitation flow)" ON public.church_members;

CREATE POLICY "Self-insert as admin only as church creator"
ON public.church_members FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND role = 'admin'
  AND EXISTS (
    SELECT 1 FROM public.churches c
    WHERE c.id = church_id AND c.created_by = auth.uid()
  )
);

CREATE POLICY "Self-insert as member only with valid invitation"
ON public.church_members FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND role = 'member'
  AND EXISTS (
    SELECT 1 FROM public.invitations i
    JOIN auth.users u ON lower(u.email) = lower(i.email)
    WHERE i.church_id = church_members.church_id
      AND u.id = auth.uid()
      AND i.accepted_at IS NULL
  )
);

CREATE POLICY "Admins can add members to their church"
ON public.church_members FOR INSERT
WITH CHECK (
  public.has_church_role(auth.uid(), church_id, 'admin')
);
