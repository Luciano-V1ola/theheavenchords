// Single source of truth for the canonical public domain of the app.
// Update this if the domain ever changes — everything else (sitemap, SEO,
// canonical, Open Graph, share links, invitation emails) reads from here.
export const SITE_URL = "https://theheavenchords.xyz";

/** Returns SITE_URL when in the browser AND the current host matches, else SITE_URL.
 *  Always returns the canonical xyz domain for share/SEO purposes. */
export function siteUrl(path: string = "/") {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${p}`;
}
