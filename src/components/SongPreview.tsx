import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { renderLines, noteIndex } from "@/lib/chords";
import { SongFont } from "./SongFormFields";

// Vista previa en vivo de una canción tal como se verá publicada.
// Usa la misma lógica de render que SongViewer.
type Props = {
  title: string;
  artist?: string;
  song_key: string;
  lyrics: string;
  font?: SongFont;
};

export default function SongPreview({ title, artist, song_key, lyrics, font }: Props) {
  const fontClass = (font ?? "arial") === "calibri" ? "font-calibri" : "font-arial";
  // Sin transposición: previsualizamos en el tono original
  const lines = useMemo(() => renderLines(lyrics, 0, song_key), [lyrics, song_key]);
  // Validamos que noteIndex no rompa con tonos vacíos
  void noteIndex;

  return (
    <Card className="p-3 sm:p-4 overflow-x-auto">
      <div className="mb-2">
        <h3 className={`font-bold text-lg ${fontClass}`}>{title || "Sin título"}</h3>
        {artist && <p className="text-xs text-muted-foreground">{artist} · Tono: {song_key}</p>}
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
