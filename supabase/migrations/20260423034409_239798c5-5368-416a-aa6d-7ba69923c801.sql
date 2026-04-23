-- 1) Roles globales separados (patrón recomendado)
CREATE TYPE public.global_role AS ENUM ('owner', 'moderator', 'user');

CREATE TABLE public.user_global_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  role public.global_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_global_roles ENABLE ROW LEVEL SECURITY;

-- Función security definer para evitar recursión
CREATE OR REPLACE FUNCTION public.has_global_role(_user_id uuid, _role public.global_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_global_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_owner_or_mod(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_global_roles WHERE user_id = _user_id AND role IN ('owner','moderator'));
$$;

-- Cualquier autenticado puede leer roles (necesario para mostrar UI)
CREATE POLICY "Anyone authenticated can read global roles"
ON public.user_global_roles FOR SELECT TO authenticated USING (true);

-- Solo Dueño puede insertar/actualizar/borrar
CREATE POLICY "Only owner can insert global roles"
ON public.user_global_roles FOR INSERT TO authenticated
WITH CHECK (public.has_global_role(auth.uid(), 'owner'));

CREATE POLICY "Only owner can update global roles"
ON public.user_global_roles FOR UPDATE TO authenticated
USING (public.has_global_role(auth.uid(), 'owner'));

CREATE POLICY "Only owner can delete global roles"
ON public.user_global_roles FOR DELETE TO authenticated
USING (public.has_global_role(auth.uid(), 'owner'));

-- Sembrar el dueño actual
INSERT INTO public.user_global_roles (user_id, role)
SELECT u.id, 'owner'::public.global_role
FROM auth.users u
WHERE lower(u.email) = 'dva.lucho@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'owner';

-- Trigger: nuevos usuarios obtienen rol 'user' por defecto (excepto el dueño)
CREATE OR REPLACE FUNCTION public.handle_new_user_global_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_global_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE WHEN lower(NEW.email) = 'dva.lucho@gmail.com' THEN 'owner'::public.global_role
         ELSE 'user'::public.global_role END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_global_role ON auth.users;
CREATE TRIGGER on_auth_user_created_global_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_global_role();

-- 2) Catálogo: columnas hidden y pending_changes
ALTER TABLE public.global_songs
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_changes text;

-- Reescribir política SELECT: oculta del catálogo si hidden=true (salvo para owner/mod o el proponente)
DROP POLICY IF EXISTS "View approved or own or owner all" ON public.global_songs;
CREATE POLICY "View approved unhidden or own or owner/mod all"
ON public.global_songs FOR SELECT TO authenticated
USING (
  (status = 'approved' AND hidden = false)
  OR proposed_by = auth.uid()
  OR public.is_owner_or_mod(auth.uid())
);

-- Permitir que moderadores también actualicen
DROP POLICY IF EXISTS "Owner can update" ON public.global_songs;
CREATE POLICY "Owner or moderator can update"
ON public.global_songs FOR UPDATE TO authenticated
USING (public.is_owner_or_mod(auth.uid()));

-- 3) setlist_songs: dibujo persistido por canción de lista
ALTER TABLE public.setlist_songs
  ADD COLUMN IF NOT EXISTS drawing jsonb;

-- Permitir a cualquier miembro de la iglesia actualizar el dibujo
-- (la política existente "Admins update setlist songs" sigue para otros campos)
CREATE POLICY "Members can update drawing on setlist songs"
ON public.setlist_songs FOR UPDATE TO authenticated
USING (public.is_church_member(auth.uid(), public.setlist_church_id(setlist_id)))
WITH CHECK (public.is_church_member(auth.uid(), public.setlist_church_id(setlist_id)));