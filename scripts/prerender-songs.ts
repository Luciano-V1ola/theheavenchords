// Build-time public snapshot, using the same renderer as the interactive viewer.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { loadPublicSongs } from "./public-songs";
import { catalogHtml, songHtml, sitemapXml } from "./static-pages";
import { publicSongEntries } from "../src/lib/seo";
import { songPath } from "../src/lib/slug";

const distDir = resolve("dist");
const templatePath = resolve(distDir, "index.html");
if (!existsSync(templatePath)) throw new Error("[prerender] Missing dist/index.html");
const template = readFileSync(templatePath, "utf8");
const songs = await loadPublicSongs(); // Fail deployment rather than publish a silently incomplete catalog.
const byPath = new Map(songs.map(song => [songPath(song.slug, song.title), song]));
rmSync(resolve(distDir, "cancion"), { recursive: true, force: true });
let count = 0;
for (const entry of publicSongEntries(songs)) {
  const song = byPath.get(entry.path);
  if (!song) continue;
  const outPath = resolve(distDir, entry.path.slice(1), "index.html");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, songHtml(template, song));
  count++;
}
writeFileSync(templatePath, catalogHtml(template, songs));
writeFileSync(resolve(distDir, "sitemap.xml"), sitemapXml(songs));
console.log(`[prerender] ${count} public song pages with content generated`);
