import { siteUrl } from "./site";
import { songPath } from "./slug";

export const HOME_DESCRIPTION = "Letras y acordes de canciones en The Heaven Chords. Consultá tonalidades y organizá el repertorio de tu iglesia.";
export type SeoSong = { title: string; artist?: string | null; slug?: string | null; status?: string; hidden?: boolean; updated_at?: string | null };

export function isPublicSong(song: SeoSong) {
  return song.status === "approved" && song.hidden === false;
}

export function songMetadata(song: SeoSong) {
  return {
    title: `${song.title} - Letra y Acordes | The Heaven Chords`,
    description: `Letra y acordes de ${song.title}${song.artist ? ` de ${song.artist}` : ""}. Consultá la canción y su tonalidad en The Heaven Chords.`,
    url: siteUrl(songPath(song.slug, song.title)),
  };
}

export function sectionTitle(section?: string) {
  return section ? `${section} | The Heaven Chords` : "The Heaven Chords";
}

export function publicSongEntries(songs: SeoSong[]) {
  const entries = new Map<string, { path: string; lastmod?: string }>();
  for (const song of songs) {
    if (!isPublicSong(song) || !song.title.trim()) continue;
    const path = songPath(song.slug, song.title);
    const date = song.updated_at ? new Date(song.updated_at) : null;
    const lastmod = date && Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : undefined;
    const previous = entries.get(path);
    if (!previous || (lastmod && (!previous.lastmod || lastmod > previous.lastmod))) entries.set(path, { path, lastmod });
  }
  return [...entries.values()].sort((a, b) => a.path.localeCompare(b.path));
}