import { createClient } from "@supabase/supabase-js";
import { isPublicSong, type SeoSong } from "../src/lib/seo";

export type PublicSong = SeoSong & { lyrics: string; song_key: string; bpm: number | null; time_signature: string | null };

export async function loadPublicSongs(): Promise<PublicSong[]> {
  const client = createClient(process.env.VITE_SUPABASE_URL || "https://ympwrlneuzndczpkfrnv.supabase.co", process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltcHdybG5ldXpuZGN6cGtmcm52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTA2MzEsImV4cCI6MjA5MjI4NjYzMX0.M0tJ_1uorvl_gLqSZ3n4A_hrVzjpjAffJmh048EeKrU");
  const songs: PublicSong[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from("global_songs")
      .select("title, artist, slug, lyrics, song_key, bpm, time_signature, status, hidden, updated_at")
      .eq("status", "approved").eq("hidden", false).order("id").range(offset, offset + 999);
    if (error) throw new Error(`[public songs] ${error.message}`);
    songs.push(...(data ?? []).filter(isPublicSong) as PublicSong[]);
    if (!data || data.length < 1000) break;
  }
  return songs;
}