
-- 1) Owner global hardcoded por email
CREATE OR REPLACE FUNCTION public.is_global_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND lower(email) = 'dva.lucho@gmail.com'
  );
$$;

-- 2) Catálogo global de canciones (aprobadas + pendientes + rechazadas)
CREATE TYPE public.song_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.global_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist text,
  song_key text NOT NULL DEFAULT 'C',
  lyrics text NOT NULL,
  status public.song_status NOT NULL DEFAULT 'pending',
  proposed_by uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.global_songs ENABLE ROW LEVEL SECURITY;

-- Cualquiera autenticado ve las aprobadas; el proponente ve las suyas; owner ve todo
CREATE POLICY "View approved or own or owner all"
ON public.global_songs FOR SELECT TO authenticated
USING (
  status = 'approved'
  OR proposed_by = auth.uid()
  OR public.is_global_owner(auth.uid())
);

-- Cualquiera autenticado puede proponer (queda como pending)
CREATE POLICY "Authenticated can propose"
ON public.global_songs FOR INSERT TO authenticated
WITH CHECK (proposed_by = auth.uid() AND status = 'pending');

-- Solo owner puede actualizar (aprobar/rechazar/editar)
CREATE POLICY "Owner can update"
ON public.global_songs FOR UPDATE TO authenticated
USING (public.is_global_owner(auth.uid()));

-- Owner o proponente (si sigue pending) pueden borrar
CREATE POLICY "Owner or proposer pending can delete"
ON public.global_songs FOR DELETE TO authenticated
USING (
  public.is_global_owner(auth.uid())
  OR (proposed_by = auth.uid() AND status = 'pending')
);

CREATE TRIGGER trg_global_songs_updated
BEFORE UPDATE ON public.global_songs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Setlists (listas) por iglesia
CREATE TABLE public.setlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.setlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view setlists"
ON public.setlists FOR SELECT TO authenticated
USING (public.is_church_member(auth.uid(), church_id));

CREATE POLICY "Admins create setlists"
ON public.setlists FOR INSERT TO authenticated
WITH CHECK (
  public.has_church_role(auth.uid(), church_id, 'admin'::app_role)
  AND created_by = auth.uid()
);

CREATE POLICY "Admins update setlists"
ON public.setlists FOR UPDATE TO authenticated
USING (public.has_church_role(auth.uid(), church_id, 'admin'::app_role));

CREATE POLICY "Admins delete setlists"
ON public.setlists FOR DELETE TO authenticated
USING (public.has_church_role(auth.uid(), church_id, 'admin'::app_role));

CREATE TRIGGER trg_setlists_updated
BEFORE UPDATE ON public.setlists
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Items de una setlist: copia editable de la canción global para esa iglesia
CREATE TABLE public.setlist_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id uuid NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
  global_song_id uuid REFERENCES public.global_songs(id) ON DELETE SET NULL,
  position int NOT NULL DEFAULT 0,
  -- Copia editable (la iglesia puede modificar sin afectar el global)
  title text NOT NULL,
  artist text,
  song_key text NOT NULL DEFAULT 'C',
  lyrics text NOT NULL,
  added_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_setlist_songs_setlist ON public.setlist_songs(setlist_id);

ALTER TABLE public.setlist_songs ENABLE ROW LEVEL SECURITY;

-- Helper: ¿el usuario es miembro/admin de la iglesia dueña de la setlist?
CREATE OR REPLACE FUNCTION public.setlist_church_id(_setlist_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT church_id FROM public.setlists WHERE id = _setlist_id; $$;

CREATE POLICY "Members view setlist songs"
ON public.setlist_songs FOR SELECT TO authenticated
USING (public.is_church_member(auth.uid(), public.setlist_church_id(setlist_id)));

CREATE POLICY "Admins add setlist songs"
ON public.setlist_songs FOR INSERT TO authenticated
WITH CHECK (
  public.has_church_role(auth.uid(), public.setlist_church_id(setlist_id), 'admin'::app_role)
  AND added_by = auth.uid()
);

CREATE POLICY "Admins update setlist songs"
ON public.setlist_songs FOR UPDATE TO authenticated
USING (public.has_church_role(auth.uid(), public.setlist_church_id(setlist_id), 'admin'::app_role));

CREATE POLICY "Admins delete setlist songs"
ON public.setlist_songs FOR DELETE TO authenticated
USING (public.has_church_role(auth.uid(), public.setlist_church_id(setlist_id), 'admin'::app_role));

CREATE TRIGGER trg_setlist_songs_updated
BEFORE UPDATE ON public.setlist_songs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
