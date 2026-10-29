import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadPublicSongs } from "./public-songs";
import { sitemapXml } from "./static-pages";

const songs = await loadPublicSongs();
writeFileSync(resolve("public/sitemap.xml"), sitemapXml(songs));
console.log(`[sitemap] public catalog loaded (${songs.length} songs)`);
