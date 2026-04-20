
-- Enum para roles dentro de una iglesia
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

-- Tabla de iglesias
CREATE TABLE public.churches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

-- Miembros de una iglesia con rol
CREATE TABLE public.church_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member',
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (church_id, user_id)
);
ALTER TABLE public.church_members ENABLE ROW LEVEL SECURITY;

-- Canciones (compartidas dentro de la iglesia)
CREATE TABLE public.songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT,
  song_key TEXT NOT NULL DEFAULT 'C',
  lyrics TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- Invitaciones por email
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'member',
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- ============== FUNCIONES SECURITY DEFINER (evitan recursión en RLS) ==============

CREATE OR REPLACE FUNCTION public.is_church_member(_user_id UUID, _church_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.church_members
    WHERE user_id = _user_id AND church_id = _church_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_church_role(_user_id UUID, _church_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.church_members
    WHERE user_id = _user_id AND church_id = _church_id AND role = _role
  );
$$;

-- ============== POLÍTICAS RLS ==============

-- churches: ver si soy miembro; crear cualquiera; actualizar/borrar solo admin
CREATE POLICY "Members can view their churches"
  ON public.churches FOR SELECT TO authenticated
  USING (public.is_church_member(auth.uid(), id));

CREATE POLICY "Authenticated users can create churches"
  ON public.churches FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update their church"
  ON public.churches FOR UPDATE TO authenticated
  USING (public.has_church_role(auth.uid(), id, 'admin'));

CREATE POLICY "Admins can delete their church"
  ON public.churches FOR DELETE TO authenticated
  USING (public.has_church_role(auth.uid(), id, 'admin'));

-- church_members
CREATE POLICY "Members can view co-members"
  ON public.church_members FOR SELECT TO authenticated
  USING (public.is_church_member(auth.uid(), church_id));

CREATE POLICY "User can insert self as member (via invitation flow)"
  ON public.church_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update members"
  ON public.church_members FOR UPDATE TO authenticated
  USING (public.has_church_role(auth.uid(), church_id, 'admin'));

CREATE POLICY "Admins can remove members; users can remove themselves"
  ON public.church_members FOR DELETE TO authenticated
  USING (public.has_church_role(auth.uid(), church_id, 'admin') OR auth.uid() = user_id);

-- songs: ver si soy miembro; modificar solo admin
CREATE POLICY "Members can view songs"
  ON public.songs FOR SELECT TO authenticated
  USING (public.is_church_member(auth.uid(), church_id));

CREATE POLICY "Admins can insert songs"
  ON public.songs FOR INSERT TO authenticated
  WITH CHECK (public.has_church_role(auth.uid(), church_id, 'admin') AND auth.uid() = created_by);

CREATE POLICY "Admins can update songs"
  ON public.songs FOR UPDATE TO authenticated
  USING (public.has_church_role(auth.uid(), church_id, 'admin'));

CREATE POLICY "Admins can delete songs"
  ON public.songs FOR DELETE TO authenticated
  USING (public.has_church_role(auth.uid(), church_id, 'admin'));

-- invitations: admins de la iglesia las gestionan; el invitado puede leer la suya por token (pero accederemos vía RPC pública)
CREATE POLICY "Admins manage invitations - select"
  ON public.invitations FOR SELECT TO authenticated
  USING (public.has_church_role(auth.uid(), church_id, 'admin'));

CREATE POLICY "Admins create invitations"
  ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (public.has_church_role(auth.uid(), church_id, 'admin') AND auth.uid() = invited_by);

CREATE POLICY "Admins delete invitations"
  ON public.invitations FOR DELETE TO authenticated
  USING (public.has_church_role(auth.uid(), church_id, 'admin'));

-- ============== RPC para aceptar invitación por token ==============
-- El usuario autenticado pasa un token; si coincide, se agrega a la iglesia con el rol indicado.
CREATE OR REPLACE FUNCTION public.accept_invitation(_token UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invitation public.invitations%ROWTYPE;
  v_user_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_invitation FROM public.invitations
  WHERE token = _token AND accepted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or already used invitation';
  END IF;

  IF lower(v_invitation.email) <> lower(v_user_email) THEN
    RAISE EXCEPTION 'Invitation email does not match your account';
  END IF;

  INSERT INTO public.church_members (church_id, user_id, role)
  VALUES (v_invitation.church_id, auth.uid(), v_invitation.role)
  ON CONFLICT (church_id, user_id) DO NOTHING;

  UPDATE public.invitations SET accepted_at = now() WHERE id = v_invitation.id;

  RETURN v_invitation.church_id;
END;
$$;

-- ============== Trigger: cuando se crea una iglesia, su creador es admin automáticamente ==============
CREATE OR REPLACE FUNCTION public.handle_new_church()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.church_members (church_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_church_created
AFTER INSERT ON public.churches
FOR EACH ROW EXECUTE FUNCTION public.handle_new_church();

-- Trigger updated_at en songs
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER songs_touch_updated
BEFORE UPDATE ON public.songs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
