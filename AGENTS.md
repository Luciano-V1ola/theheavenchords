# Architecture rules

- Keep canonical-domain configuration in `src/lib/site.ts`; derive public song and section metadata through `src/lib/seo.ts` so runtime and static pages agree.
- Each route owns its head through `PageMetadata`; generated head tags are Helmet-managed and the base HTML must not contain a canonical link, preventing duplicates and stale metadata.
- Song title anchors preserve browser-native modified/middle clicks; only ordinary left clicks invoke the existing viewer callbacks, with card action buttons outside anchors.
- Prerender only approved, non-hidden public songs at deployment time using the existing `SongRenderer`, not a second music renderer; static catalog links make songs discoverable without JavaScript.