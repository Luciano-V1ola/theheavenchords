import { Helmet } from "react-helmet-async";
import { HOME_DESCRIPTION, sectionTitle, songMetadata, type SeoSong } from "@/lib/seo";
import { siteUrl } from "@/lib/site";

type Props = { song?: SeoSong | null; section?: string; path?: string; noindex?: boolean };

export default function PageMetadata({ song, section, path = "/", noindex = false }: Props) {
  const meta = song ? songMetadata(song) : { title: sectionTitle(section), description: HOME_DESCRIPTION, url: siteUrl(path) };
  return (
    <Helmet>
      <html lang="es" />
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <meta name="robots" content={noindex ? "noindex, follow" : "index, follow"} />
      <link rel="canonical" href={meta.url} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={meta.url} />
      <meta property="og:type" content={song ? "music.song" : "website"} />
      <meta property="og:locale" content="es_ES" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
      <meta name="twitter:url" content={meta.url} />
    </Helmet>
  );
}