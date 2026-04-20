import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Pencil, Copy, Play, Pause, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { NOTES_SHARP, noteIndex, renderLines, transposeChordLine, isChordLine } from "@/lib/chords";
import type { Membership } from "@/hooks/useChurch";

type Song = { id: string; title: string; artist: string | null; song_key: string; lyrics: string };
type Props = { church: Membership; songId: string; onBack: () => void; onEdit: () => void };

// Visor con transposición, auto-scroll y copiar
export default function SongViewer({ church, songId, onBack, onEdit }: Props) {
  const [song, setSong] = useState<Song | null>(null);
  const [currentKey, setCurrentKey] = useState("C");
  const [scrolling, setScrolling] = useState(false);
  const scrollRef = useRef<number | null>(null);

  useEffect(() => {
    supabase.from("songs").select("*").eq("id", songId).single().then(({ data, error }) => {
      if (error) toast.error(error.message);
      else { setSong(data); setCurrentKey(data.song_key); }
    });
  }, [songId]);

  // Auto-scroll suave
  useEffect(() => {
    if (!scrolling) {
      if (scrollRef.current) { window.clearInterval(scrollRef.current); scrollRef.current = null; }
      return;
    }
    scrollRef.current = window.setInterval(() => {
      window.scrollBy({ top: 1 });
      if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 2) setScrolling(false);
    }, 80);
    return () => { if (scrollRef.current) window.clearInterval(scrollRef.current); };
  }, [scrolling]);

  if (!song) return <p className="text-muted-foreground">Cargando...</p>;

  const semitones = noteIndex(currentKey) - noteIndex(song.song_key);
  const lines = renderLines(song.lyrics, semitones);
  const transpose = (n: number) => {
    const idx = noteIndex(currentKey);
    setCurrentKey(NOTES_SHARP[(idx + n + 12) % 12]);
  };

  const copy = async () => {
    const text = song.lyrics.split("\n").map(l => isChordLine(l) ? transposeChordLine(l, semitones) : l).join("\n");
    const full = `${song.title}${song.artist ? " - " + song.artist : ""}\nTono: ${currentKey}\n\n${text}`;
    await navigator.clipboard.writeText(full);
    toast.success("Copiado");
  };

  const isAdmin = church.role === "admin";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Volver</Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold truncate">{song.title}</h2>
          {song.artist && <p className="text-sm text-muted-foreground truncate">{song.artist}</p>}
        </div>
        {isAdmin && <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="w-4 h-4" /></Button>}
      </div>

      <Card className="p-3 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => transpose(-1)}><Minus className="w-4 h-4" /></Button>
          <div className="flex items-center gap-2">
            <span className="text-sm">Tono:</span>
            <Select value={currentKey} onValueChange={setCurrentKey}>
              <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {NOTES_SHARP.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="icon" variant="outline" onClick={() => transpose(1)}><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setScrolling(s => !s)}>
            {scrolling ? <><Pause className="w-4 h-4 mr-1" /> Detener</> : <><Play className="w-4 h-4 mr-1" /> Auto-scroll</>}
          </Button>
          <Button size="sm" variant="outline" onClick={copy}><Copy className="w-4 h-4 mr-1" /> Copiar</Button>
        </div>
      </Card>

      <Card className="p-4 sm:p-6 overflow-x-auto">
        <pre className="font-song text-sm sm:text-base leading-relaxed whitespace-pre">
          {lines.map((l, i) => (
            <div key={i} className={l.type === "chord" ? "chord-line" : ""}>{l.text || "\u00A0"}</div>
          ))}
        </pre>
      </Card>
    </div>
  );
}
