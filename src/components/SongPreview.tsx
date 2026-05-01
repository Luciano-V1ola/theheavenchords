import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { renderLines } from "@/lib/chords";
import { SongFont } from "./SongFormFields";

// Vista previa en vivo de una canción tal como se verá publicada.
// Permite alternar entre Acordes y Grados directamente desde el editor.
type Props = {
  title: string;
  artist?: string;
  song_key: string;
  lyrics: string;
  font?: SongFont;
};

export default function SongPreview({ title, artist, song_key, lyrics, font }: Props) {
  const fontClass = (font ?? "arial") === "calibri" ? "font-calibri" : "font-arial";
  const [displayMode, setDisplayMode] = useState<"chords" | "degrees">("chords");
  // Sin transposición: previsualizamos en el tono original
  const lines = useMemo(
    () => renderLines(lyrics, 0, song_key, displayMode, song_key),
    [lyrics, song_key, displayMode],
  );

  return (
    <Card className="p-3 sm:p-4 overflow-x-auto">
      <div className="mb-2 flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h3 className={`font-bold text-lg ${fontClass} truncate`}>{title || "Sin título"}</h3>
          {artist && <p className="text-xs text-muted-foreground truncate">{artist} · Tono: {song_key}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">Ver:</span>
          <Select value={displayMode} onValueChange={(v) => setDisplayMode(v as "chords" | "degrees")}>
            <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="chords">Acordes</SelectItem>
              <SelectItem value="degrees">Grados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <pre className={`${fontClass} text-sm sm:text-base leading-relaxed whitespace-pre`}>
        {lines.map((l, i) => {
          if (l.type === "title") return <div key={i} className="title-line">{l.text}</div>;
          if (l.type === "chord") return <div key={i} className="chord-line">{l.text || "\u00A0"}</div>;
          if (l.type === "section") return <div key={i} className="section-line">{l.text}</div>;
          return <div key={i}>{l.text || "\u00A0"}</div>;
        })}
        {!lyrics.trim() && <div className="text-muted-foreground italic">La preview aparecerá acá mientras escribís…</div>}
      </pre>
    </Card>
  );
}
