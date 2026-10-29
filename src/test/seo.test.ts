import { describe, it, expect } from "vitest";
import { isPublicSong, publicSongEntries, sectionTitle, songMetadata } from "../lib/seo";
import { isPlainLeftClick } from "../components/SongTitleLink";
import { catalogHtml, injectHead, sitemapXml, songHtml } from "../../scripts/static-pages";

const song = { title: "Maranata (Ahora Ven)", artist: null, slug: "maranata-ahora-ven", lyrics: "INTRO\nC G Am F\nAhora ven", song_key: "C", bpm: null, time_signature: null, status: "approved", hidden: false, updated_at: "2026-10-29T12:00:00Z" };
const template = '<html lang="es"><head><title>Old</title><meta name="description" content="old"><link rel="canonical" href="/old"><meta property="og:title" content="old"></head><body><div id="root"></div></body></html>';

describe("public song metadata and indexing", () => {
  it("uses the requested real-title format and official song canonical", () => {
    expect(songMetadata(song).title).toBe("Maranata (Ahora Ven) - Letra y Acordes | The Heaven Chords");
    expect(songMetadata(song).url).toBe("https://theheavenchords.xyz/cancion/maranata-ahora-ven");
    expect(songMetadata({ ...song, slug: "nos-ama", title: "Nos Ama" }).url).toBe("https://theheavenchords.xyz/cancion/nos-ama");
  });
  it("restores home and names favorites/lists independently", () => {
    expect(sectionTitle()).toBe("The Heaven Chords");
    expect(sectionTitle("Favoritos")).toBe("Favoritos | The Heaven Chords");
    expect(sectionTitle("Listas")).toBe("Listas | The Heaven Chords");
  });
  it("excludes pending, rejected and hidden songs", () => {
    expect(isPublicSong(song)).toBe(true);
    expect(publicSongEntries([song, { ...song, status: "pending", slug: "pending" }, { ...song, status: "rejected", slug: "rejected" }, { ...song, hidden: true, slug: "hidden" }]).map(e => e.path)).toEqual(["/cancion/maranata-ahora-ven"]);
  });
  it("deduplicates canonical URLs and only uses real valid modification dates", () => {
    expect(publicSongEntries([song, song])).toEqual([{ path: "/cancion/maranata-ahora-ven", lastmod: "2026-10-29" }]);
    expect(publicSongEntries([{ ...song, updated_at: null }])[0].lastmod).toBeUndefined();
    expect(publicSongEntries([{ ...song, updated_at: "invalid" }])[0].lastmod).toBeUndefined();
    expect(sitemapXml([song, song]).match(/<loc>/g)).toHaveLength(2);
  });
  it("leaves modified and middle clicks to the browser", () => {
    const event = { button: 0, defaultPrevented: false, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false };
    expect(isPlainLeftClick(event)).toBe(true);
    expect(isPlainLeftClick({ ...event, button: 1 })).toBe(false);
    expect(isPlainLeftClick({ ...event, ctrlKey: true })).toBe(false);
    expect(isPlainLeftClick({ ...event, metaKey: true })).toBe(false);
  });
  it("replaces route identity instead of retaining previous canonical values", () => {
    const html = injectHead(template, songMetadata(song), true);
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html).not.toContain('href="/old"');
  });
  it("includes real song content and catalog discovery links before JavaScript", () => {
    expect(songHtml(template, song)).toContain("Ahora ven");
    expect(songHtml(template, song)).toContain("chord-line");
    expect(catalogHtml(template, [song])).toContain('href="/cancion/maranata-ahora-ven"');
    expect(catalogHtml(template, [{ ...song, hidden: true }])).not.toContain('href="/cancion/maranata-ahora-ven"');
  });
});