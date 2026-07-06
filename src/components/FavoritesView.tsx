import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { GlobalSong } from "./GlobalCatalog";
import type { SongFont } from "./SongFormFields";

type Props = {
  onView: (s: GlobalSong) => void;
};

function unpackLyrics(lyrics: string): { font: SongFont; clean: string } {
  const m = lyrics.match(/^\[font:(arial|calibri)\]\s*\n?/i);
  if (!m) return { font: "arial", clean: lyrics };
  return { font: m[1].toLowerCase() as SongFont, clean: lyrics.slice(m[0].length) };
}

export default function FavoritesView({ onView }: Props) {
  const { user } = useAuth();
  const [songs, setSongs] = useState<GlobalSong[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) { setSongs([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("user_favorites")
      .select("global_song_id, global_songs(id, title, artist, song_key, lyrics, status, proposed_by, hidden, bpm, time_signature, slug)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }
    const rows = (data ?? [])
      .map((r: any) => r.global_songs)
      .filter(Boolean)
      .map((r: any) => {
        const { font, clean } = unpackLyrics(r.lyrics);
        return { ...r, font, lyrics: clean } as GlobalSong;
      });
    setSongs(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const remove = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("user_favorites").delete()
      .eq("user_id", user.id).eq("global_song_id", id);
    if (error) toast.error(error.message);
    else { toast.success("Quitada de favoritos"); load(); }
  };

  if (!user) {
    return <Card className="p-8 text-center text-muted-foreground">Iniciá sesión para tener tu lista de favoritos.</Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
        <h2 className="text-xl font-bold flex-1">Favoritos</h2>
      </div>
      <p className="text-xs text-muted-foreground">Tu lista personal. Solo vos la ves.</p>
      {loading ? (
        <p className="text-center text-muted-foreground py-8">Cargando...</p>
      ) : songs.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Aún no marcaste favoritos. Tocá la ⭐ en cualquier canción del catálogo.
        </Card>
      ) : songs.map(s => (
        <Card
          key={s.id}
          onClick={() => onView(s)}
          className="p-4 flex items-center gap-3 flex-wrap cursor-pointer transition-colors hover:bg-accent/50 active:scale-[0.99]"
        >
          <div className="flex-1 min-w-[180px]">
            <h4 className="font-semibold">{s.title}</h4>
            <p className="text-sm text-muted-foreground">{s.artist || "Sin artista"} · Tono: {s.song_key}</p>
          </div>
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="destructive" onClick={() => remove(s.id)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
