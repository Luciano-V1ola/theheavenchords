-- Cada usuario puede crear sólo una iglesia
CREATE UNIQUE INDEX IF NOT EXISTS churches_one_per_creator ON public.churches(created_by);