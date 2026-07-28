import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SongFont } from "./SongFormFields";
import SongRenderer from "./SongRenderer";

// Vista previa en vivo de una canción tal como se verá publicada.
// Utiliza el renderer unificado (SongRenderer) — misma salida en todos lados.
type Props = {
  title: string;
  artist?: string;
  song_key: string;
  lyrics: string;
  chordsLyrics?: string;
  degreesLyrics?: string;
  font?: SongFont;
  bpm?: number | null;
  time_signature?: string | null;
};

export default function SongPreview({ title, artist, song_key, lyrics, chordsLyrics, degreesLyrics, font, bpm, time_signature }: Props) {
  const fontClass = (font ?? "arial") === "calibri" ? "font-calibri" : "font-arial";
  const [displayMode, setDisplayMode] = useState<"chords" | "degrees" | "lyrics">("chords");
  // Siempre usar la letra que se está editando en vivo. El renderer se encarga
  // de convertir acordes ↔ grados según `displayMode`, así cualquier cambio en
  // el textarea se refleja inmediatamente sin depender de buffers cacheados.
  void chordsLyrics; void degreesLyrics;
  const sourceLyrics = lyrics;

  return (
    <Card className="p-3 sm:p-4 overflow-x-auto">
      <div className="mb-2 flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h3 className={`font-bold text-lg ${fontClass} truncate`}>{title || "Sin título"}</h3>
          {(artist || bpm || time_signature) && (
            <p className="text-xs text-muted-foreground truncate">
              {artist ? `${artist} · ` : ""}Tono: {song_key}
              {bpm ? ` · BPM: ${bpm}` : ""}
              {time_signature ? ` · Compás: ${time_signature}` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">Ver:</span>
          <Select value={displayMode} onValueChange={(v) => setDisplayMode(v as "chords" | "degrees" | "lyrics")}>
            <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="chords">Acordes</SelectItem>
              <SelectItem value="degrees">Grados</SelectItem>
              <SelectItem value="lyrics">Solo Letra</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <SongRenderer
        lyrics={sourceLyrics}
        song_key={song_key}
        displayMode={displayMode}
        font={font}
        className="text-sm sm:text-base"
      />
    </Card>
  );
}

