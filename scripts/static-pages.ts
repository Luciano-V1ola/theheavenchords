import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SongRenderer from "../src/components/SongRenderer";
import { HOME_DESCRIPTION, publicSongEntries, songMetadata } from "../src/lib/seo";
import { SITE_URL } from "../src/lib/site";
import { songPath } from "../src/lib/slug";
import type { PublicSong } from "./public-songs";

export function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function injectHead(template: string, meta: { title: string; description: string; url: string }, song = false) {
  // Remove ALL old route-owned tags, including template canonical and robots.
  const cleaned = template.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi, "")
    .replace(/<meta\b[^>]*\b(?:name|property)=["'](?:description|robots|og:(?:title|description|url|type|locale)|twitter:(?:title|description|url|card))["'][^>]*>/gi, "");
  const tags = [
    `<title data-rh="true">${escapeHtml(meta.title)}</title>`,
    `<link data-rh="true" rel="canonical" href="${escapeHtml(meta.url)}" />`,
    ...Object.entries({ description: meta.description, robots: "index, follow", "twitter:card": "summary_large_image", "twitter:title": meta.title, "twitter:description": meta.description, "twitter:url": meta.url }).map(([name, value]) => `<meta data-rh="true" name="${name}" content="${escapeHtml(value)}" />`),
    ...Object.entries({ "og:title": meta.title, "og:description": meta.description, "og:url": meta.url, "og:type": song ? "music.song" : "website", "og:locale": "es_ES" }).map(([name, value]) => `<meta data-rh="true" property="${name}" content="${escapeHtml(value)}" />`),
  ].join("\n    ");
  return cleaned.replace("</head>", `    ${tags}\n  </head>`);
}

export function songHtml(template: string, song: PublicSong) {
  const match = song.lyrics.match(/^\[font:(arial|calibri)\]\s*\n?/i);
  const lyrics = match ? song.lyrics.slice(match[0].length) : song.lyrics;
  const font = match?.[1].toLowerCase() === "calibri" ? "calibri" : "arial";
  const body = renderToStaticMarkup(createElement(SongRenderer, { lyrics, song_key: song.song_key, font, fontSize: 16 }));
  const content = `<main class="max-w-4xl mx-auto p-4"><a href="/">The Heaven Chords</a><article><h1 class="font-bold text-2xl">${escapeHtml(song.title)}</h1>${song.artist ? `<p>${escapeHtml(song.artist)}</p>` : ""}<p>Tono: ${escapeHtml(song.song_key)}${song.bpm ? ` · BPM: ${song.bpm}` : ""}${song.time_signature ? ` · Compás: ${escapeHtml(song.time_signature)}` : ""}</p>${body}</article></main>`;
  return injectHead(template, songMetadata(song), true).replace(/<div\s+id="root"[^>]*>\s*<\/div>/, `<div id="root">${content}</div>`);
}

export function catalogHtml(template: string, songs: PublicSong[]) {
  const byPath = new Map(songs.map(song => [songPath(song.slug, song.title), song]));
  const links = publicSongEntries(songs).map(entry => `<li><a href="${escapeHtml(entry.path)}">${escapeHtml(byPath.get(entry.path)?.title ?? "")}</a></li>`).join("\n");
  return injectHead(template, { title: "The Heaven Chords", description: HOME_DESCRIPTION, url: `${SITE_URL}/` }).replace(/<div\s+id="root"[^>]*>\s*<\/div>/, `<div id="root"><main class="max-w-4xl mx-auto p-4"><h1>The Heaven Chords</h1><h2>Catálogo</h2><ul>${links}</ul></main></div>`);
}

export function sitemapXml(songs: PublicSong[]) {
  const entries = [{ path: "/", lastmod: undefined }, ...publicSongEntries(songs)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(entry => `  <url><loc>${escapeHtml(`${SITE_URL}${entry.path}`)}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`;
}