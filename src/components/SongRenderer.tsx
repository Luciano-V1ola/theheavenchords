import { useMemo } from "react";
import { noteIndex, renderLines } from "@/lib/chords";
import type { SongFont } from "./SongFormFields";

// Componente único de renderizado usado en:
//  - SongViewer (visor de canción)
//  - SongPreview (previsualización al editar/crear/revisar)
// Garantiza que la letra, acordes, grados, secciones, título y fuente
// se muestren exactamente igual en toda la aplicación.
type Props = {
  lyrics: string;
  song_key: string;
  originalKey?: string;
  currentKey?: string;
  displayMode?: "chords" | "degrees" | "lyrics";
  font?: SongFont | null;
  fontSize?: number;
  className?: string;
};

function ChordLyricPair({ chord, lyric }: { chord: string; lyric: string }) {
  const positions: { start: number; text: string }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chord)) !== null) positions.push({ start: m.index, text: m[0] });
  if (!positions.length) {
    return (
      <>
        <div className="chord-line whitespace-pre">{chord || "\u00A0"}</div>
        <div className="whitespace-pre">{lyric || "\u00A0"}</div>
      </>
    );
  }
  const segments: { chord: string; lyric: string }[] = [];
  if (positions[0].start > 0) segments.push({ chord: "", lyric: lyric.slice(0, positions[0].start) });
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].start;
    const end = i + 1 < positions.length ? positions[i + 1].start : Math.max(lyric.length, chord.length);
    segments.push({ chord: positions[i].text, lyric: lyric.slice(start, end) });
  }
  return (
    <div className="flex flex-nowrap items-end">
      {segments.map((s, i) => (
        <div key={i} className="flex flex-col shrink-0" style={{ whiteSpace: "pre" }}>
          <span className="chord-line" style={{ paddingRight: s.chord ? "0.5em" : 0 }}>
            {s.chord || "\u00A0"}
          </span>
          <span>{s.lyric.length ? s.lyric : "\u00A0"}</span>
        </div>
      ))}
    </div>
  );
}

export default function SongRenderer({
  lyrics,
  song_key,
  originalKey,
  currentKey,
  displayMode = "chords",
  font,
  fontSize,
  className,
}: Props) {
  const resolvedOriginal = originalKey ?? song_key;
  const resolvedCurrent = currentKey ?? song_key;
  const semitones = noteIndex(resolvedCurrent) - noteIndex(resolvedOriginal);
  const lines = useMemo(
    () => renderLines(lyrics, semitones, resolvedCurrent, displayMode, resolvedOriginal),
    [lyrics, semitones, resolvedCurrent, displayMode, resolvedOriginal],
  );

  const fontClass = (font ?? "arial") === "calibri" ? "font-calibri" : "font-arial";

  const rendered: JSX.Element[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.type === "skip") continue;
    if (l.type === "title") { rendered.push(<div key={i} className="title-line">{l.text}</div>); continue; }
    if (l.type === "section") { rendered.push(<div key={i} className="section-line">{l.text}</div>); continue; }
    if (l.type === "chord") {
      const nxt = lines[i + 1];
      if (nxt && nxt.type === "text" && nxt.text.trim() !== "") {
        rendered.push(<ChordLyricPair key={i} chord={l.text} lyric={nxt.text} />);
        i++;
        continue;
      }
      rendered.push(<div key={i} className="chord-line whitespace-pre">{l.text || "\u00A0"}</div>);
      continue;
    }
    rendered.push(<div key={i} className="whitespace-pre">{l.text || "\u00A0"}</div>);
  }

  return (
    <div
      className={`${fontClass} leading-relaxed ${className ?? ""}`}
      style={fontSize ? { fontSize: `${fontSize}px` } : undefined}
    >
      {rendered}
      {!lyrics.trim() && (
        <div className="text-muted-foreground italic">La preview aparecerá acá mientras escribís…</div>
      )}
    </div>
  );
}
