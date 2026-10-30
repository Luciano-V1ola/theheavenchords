# The Heaven Chords

## Public-song SEO and deployment

Public canonical URLs use the official domain configured in `src/lib/site.ts`. Song titles are native HTML links; ordinary left-clicks keep the existing app navigation, while middle-click and modified clicks use browser defaults.

`PageMetadata` owns route and section titles, descriptions, canonical URLs and social metadata. `scripts/prerender-songs.ts` reuses `SongRenderer` to generate initial public song content and a catalog of HTML links. Only approved, non-hidden songs are included. `scripts/generate-sitemap.ts` creates a deduplicated sitemap using genuine modification dates.

### Vercel

Deploy with the package build lifecycle (`npm run build` or `bun run build`), not just `vite build`, so prebuild and postbuild run. The output directory is `dist`; retain `vercel.json` for direct-route refresh support. A deployment must serve the generated `dist/cancion/<slug>/index.html` files before falling back to the SPA. The existing live Vercel deployment already serves per-song static HTML.

These pages are a build-time public snapshot. Additions, edits, approvals, hiding or deletion of songs require a fresh deployment to update the static HTML and sitemap. Browser-side metadata updates do not update the published initial HTML by themselves. Do not treat hiding a public song as immediate removal of a previously deployed public snapshot.

### Google Search Console

After deploying, submit `https://theheavenchords.xyz/sitemap.xml` for the verified official domain, and optionally inspect representative song URLs. No Search Console settings were changed automatically. A valid sitemap and accessible pages do not guarantee indexing.

### Verification

Seven focused SEO tests passed. Browser checks passed for ordinary/middle/Ctrl clicks, song-to-catalog titles, Back/Forward titles, unique route metadata, direct reload and musician mode, with no runtime errors. All 78 current public songs rendered through the shared static renderer; the sitemap has 79 unique official URLs including home.

Authenticated list, favorite-button and edit flows were not verified end-to-end: a session could not be minted for the requesting account. Their existing handlers and access rules were preserved. The new static output has been validated locally; it requires deployment before it can be verified on the official live URL.
