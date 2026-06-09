// Helpers to generate URL slugs for songs.
// Must stay in sync with the SQL slugify() function in the database.

export function slugify(input: string): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function songPath(slug: string | null | undefined, fallbackTitle?: string): string {
  const s = (slug && slug.length ? slug : slugify(fallbackTitle || "")) || "cancion";
  return `/cancion/${s}`;
}
