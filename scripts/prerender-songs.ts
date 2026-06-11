// Genera HTML estático prerenderizado por canción en dist/cancion/<slug>/index.html
// con sus metadatos SEO (title, description, canonical, og:*, twitter:*) inyectados
// en el HTML que sirve Vercel. La SPA hidrata normalmente después.
//
// Se ejecuta como `postbuild` (después de `vite build`).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.SITE_URL || "https://theheavenchords.xyz";

const SUPABASE_URL = "https://ympwrlneuzndczpkfrnv.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltcHdybG5ldXpuZGN6cGtmcm52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTA2MzEsImV4cCI6MjA5MjI4NjYzMX0.M0tJ_1uorvl_gLqSZ3n4A_hrVzjpjAffJmh048EeKrU";

function slugify(t: string) {
  return (t || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Song = {
  title: string;
  artist: string | null;
  slug: string | null;
  song_key: string | null;
  bpm: number | null;
  time_signature: string | null;
};

function buildMeta(song: Song) {
  const slug = song.slug || slugify(song.title);
  const url = `${BASE_URL}/cancion/${slug}`;
  const title = `${song.title} - Acordes, Letra, BPM, Compás y Transposición | The Heaven Chords`;
  const description = `Acordes, letra, BPM, compás, tono y transposición de ${song.title}${
    song.artist ? ` de ${song.artist}` : ""
  } en The Heaven Chords.`;
  return { slug, url, title, description };
}

function injectMeta(template: string, meta: ReturnType<typeof buildMeta>) {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const u = escapeHtml(meta.url);

  let html = template;

  // <title>
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${t}</title>`);
  // description
  html = html.replace(
    /<meta\s+name="description"[^>]*>/i,
    `<meta name="description" content="${d}">`
  );
  // canonical
  html = html.replace(
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${u}" />`
  );
  // og:url
  html = html.replace(
    /<meta\s+property="og:url"[^>]*>/i,
    `<meta property="og:url" content="${u}" />`
  );
  // og:title
  html = html.replace(
    /<meta\s+property="og:title"[^>]*>/i,
    `<meta property="og:title" content="${t}" />`
  );
  // og:description
  html = html.replace(
    /<meta\s+property="og:description"[^>]*>/i,
    `<meta property="og:description" content="${d}" />`
  );
  // og:type → music.song
  html = html.replace(
    /<meta\s+property="og:type"[^>]*>/i,
    `<meta property="og:type" content="music.song" />`
  );
  // twitter:url
  html = html.replace(
    /<meta\s+name="twitter:url"[^>]*>/i,
    `<meta name="twitter:url" content="${u}" />`
  );
  // twitter:title
  html = html.replace(
    /<meta\s+name="twitter:title"[^>]*>/i,
    `<meta name="twitter:title" content="${t}" />`
  );
  // twitter:description
  html = html.replace(
    /<meta\s+name="twitter:description"[^>]*>/i,
    `<meta name="twitter:description" content="${d}" />`
  );

  // og:locale (insertar si no existe)
  if (!/property="og:locale"/i.test(html)) {
    html = html.replace(
      /<meta\s+property="og:type"[^>]*>/i,
      (m) => `${m}\n    <meta property="og:locale" content="es_ES" />`
    );
  }

  return html;
}

(async () => {
  const distDir = resolve("dist");
  const templatePath = resolve(distDir, "index.html");
  if (!existsSync(templatePath)) {
    console.warn("[prerender] dist/index.html no existe, salto prerender.");
    return;
  }
  const template = readFileSync(templatePath, "utf8");

  let songs: Song[] = [];
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await supabase
      .from("global_songs")
      .select("title, artist, slug, song_key, bpm, time_signature")
      .eq("status", "approved")
      .eq("hidden", false);
    if (error) {
      console.warn("[prerender] no se pudieron cargar canciones:", error.message);
      return;
    }
    songs = (data ?? []) as Song[];
  } catch (e: any) {
    console.warn("[prerender] error al cargar canciones:", e?.message);
    return;
  }

  let count = 0;
  for (const song of songs) {
    if (!song.title) continue;
    const meta = buildMeta(song);
    const html = injectMeta(template, meta);
    const outPath = resolve(distDir, "cancion", meta.slug, "index.html");
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html);
    count++;
  }
  console.log(`[prerender] ${count} páginas de canción generadas.`);
})();
