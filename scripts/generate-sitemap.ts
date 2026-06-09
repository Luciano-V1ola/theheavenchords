// Generates public/sitemap.xml at predev/prebuild.
// Lists static routes + every approved, non-hidden song from the global catalog.

import { writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://theheavenchords.lovable.app";

const SUPABASE_URL = "https://ympwrlneuzndczpkfrnv.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltcHdybG5ldXpuZGN6cGtmcm52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTA2MzEsImV4cCI6MjA5MjI4NjYzMX0.M0tJ_1uorvl_gLqSZ3n4A_hrVzjpjAffJmh048EeKrU";

type Entry = { path: string; lastmod?: string; changefreq?: string; priority?: string };

function slugify(t: string) {
  return (t || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
}

async function loadSongs(): Promise<Entry[]> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await supabase
      .from("global_songs")
      .select("title, slug, updated_at")
      .eq("status", "approved")
      .eq("hidden", false);
    if (error) {
      console.warn("[sitemap] could not load songs:", error.message);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      path: `/cancion/${r.slug || slugify(r.title)}`,
      lastmod: r.updated_at ? new Date(r.updated_at).toISOString().slice(0, 10) : undefined,
      changefreq: "monthly",
      priority: "0.7",
    }));
  } catch (e: any) {
    console.warn("[sitemap] song fetch failed:", e?.message);
    return [];
  }
}

function render(entries: Entry[]) {
  const urls = entries.map((e) => [
    "  <url>",
    `    <loc>${BASE_URL}${e.path}</loc>`,
    e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
    e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
    e.priority ? `    <priority>${e.priority}</priority>` : null,
    "  </url>",
  ].filter(Boolean).join("\n"));
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

(async () => {
  const entries: Entry[] = [
    { path: "/", changefreq: "weekly", priority: "1.0" },
  ];
  entries.push(...(await loadSongs()));
  writeFileSync(resolve("public/sitemap.xml"), render(entries));
  console.log(`sitemap.xml written (${entries.length} entries)`);
})();
