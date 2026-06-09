
-- Add slug + previous_slugs to global_songs with auto-maintenance
ALTER TABLE public.global_songs
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS previous_slugs text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.slugify(_t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    trim(both '-' from
      regexp_replace(
        regexp_replace(
          lower(
            translate(
              coalesce(_t,''),
              'áàäâãåéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÅÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
              'aaaaaaeeeeiiiiooooouuuuncAAAAAAEEEEIIIIOOOOOUUUUNC'
            )
          ),
          '[^a-z0-9]+', '-', 'g'
        ),
        '-{2,}', '-', 'g'
      )
    )
$$;

-- Backfill
UPDATE public.global_songs SET slug = public.slugify(title) WHERE slug IS NULL OR slug = '';

-- Ensure uniqueness with a suffix for collisions
DO $$
DECLARE r record; n int; candidate text;
BEGIN
  FOR r IN SELECT id, slug FROM public.global_songs ORDER BY created_at NULLS LAST, id LOOP
    n := 1;
    candidate := r.slug;
    WHILE EXISTS (SELECT 1 FROM public.global_songs g WHERE g.slug = candidate AND g.id <> r.id) LOOP
      n := n + 1;
      candidate := r.slug || '-' || n;
    END LOOP;
    IF candidate <> r.slug THEN
      UPDATE public.global_songs SET slug = candidate WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS global_songs_slug_unique ON public.global_songs (slug);
CREATE INDEX IF NOT EXISTS global_songs_previous_slugs_gin ON public.global_songs USING gin (previous_slugs);

-- Trigger to maintain slug on insert/update
CREATE OR REPLACE FUNCTION public.global_songs_maintain_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  n int := 1;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
      base := public.slugify(NEW.title);
      IF base = '' THEN base := 'cancion'; END IF;
      candidate := base;
      WHILE EXISTS (SELECT 1 FROM public.global_songs WHERE slug = candidate) LOOP
        n := n + 1;
        candidate := base || '-' || n;
      END LOOP;
      NEW.slug := candidate;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      base := public.slugify(NEW.title);
      IF base = '' THEN base := 'cancion'; END IF;
      IF base <> OLD.slug THEN
        candidate := base;
        WHILE EXISTS (SELECT 1 FROM public.global_songs WHERE slug = candidate AND id <> NEW.id) LOOP
          n := n + 1;
          candidate := base || '-' || n;
        END LOOP;
        NEW.slug := candidate;
        -- Track the previous slug for redirects
        IF OLD.slug IS NOT NULL AND OLD.slug <> '' AND NOT (OLD.slug = ANY(NEW.previous_slugs)) THEN
          NEW.previous_slugs := array_append(NEW.previous_slugs, OLD.slug);
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_global_songs_maintain_slug ON public.global_songs;
CREATE TRIGGER trg_global_songs_maintain_slug
BEFORE INSERT OR UPDATE ON public.global_songs
FOR EACH ROW EXECUTE FUNCTION public.global_songs_maintain_slug();
