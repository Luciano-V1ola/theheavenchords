-- Tightening church RLS: prevent admins from moving rows across churches via UPDATE,
-- and prevent invited users from changing the invitation email/role/church when accepting.

DROP POLICY IF EXISTS "Admins can update members" ON public.church_members;
CREATE POLICY "Admins can update members"
  ON public.church_members FOR UPDATE
  TO authenticated
  USING (public.has_church_role(auth.uid(), church_id, 'admin'::public.app_role))
  WITH CHECK (public.has_church_role(auth.uid(), church_id, 'admin'::public.app_role));

-- Prevent admin from removing the last admin (would leave church orphaned).
CREATE OR REPLACE FUNCTION public.prevent_last_admin_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_count int;
BEGIN
  IF TG_OP = 'DELETE' AND OLD.role = 'admin' THEN
    SELECT count(*) INTO v_admin_count FROM public.church_members
    WHERE church_id = OLD.church_id AND role = 'admin';
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'No se puede eliminar al único administrador de la iglesia';
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.role = 'admin' AND NEW.role <> 'admin' THEN
    SELECT count(*) INTO v_admin_count FROM public.church_members
    WHERE church_id = OLD.church_id AND role = 'admin';
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'No se puede degradar al único administrador de la iglesia';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_admin_removal ON public.church_members;
CREATE TRIGGER trg_prevent_last_admin_removal
  BEFORE UPDATE OR DELETE ON public.church_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_last_admin_removal();