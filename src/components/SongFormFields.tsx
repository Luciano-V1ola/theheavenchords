import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  KEY_OPTIONS,
  isChordLine,
  isDegreeLine,
  chordLineToDegrees,
  degreeLineToChords,
} from "@/lib/chords";
import SongPreview from "./SongPreview";

// Convierte solo las líneas de acordes a grados (deja letras y secciones intactas)
function lyricsToDegrees(lyrics: string, key: string): string {
  return lyrics.split("\n").map(line => {
    if (isChordLine(line) && !isDegreeLine(line)) return chordLineToDegrees(line, key, "degrees", 0);
    return line;
  }).join("\n");
}
// Convierte solo las líneas de grados a acordes
function lyricsToChords(lyrics: string, key: string): string {
  return lyrics.split("\n").map(line => {
    if (isDegreeLine(line)) return degreeLineToChords(line, key);
    return line;
  }).join("\n");
}

// Tipografías disponibles para mostrar la canción
export type SongFont = "arial" | "calibri";
export const FONT_OPTIONS: { value: SongFont; label: string }[] = [
  { value: "arial", label: "Arial" },
  { value: "calibri", label: "Calibri" },
];

// Compases comunes (sugerencias rápidas)
export const TIME_SIGNATURE_OPTIONS = ["4/4", "3/4", "6/8", "2/4", "12/8", "5/4"];

// Campos compartidos para crear/editar una canción (catálogo global o item de setlist)
export type SongFields = {
  title: string;
  artist: string;
  song_key: string;
  lyrics: string;
  chordsLyrics?: string;
  degreesLyrics?: string;
  editMode?: "chords" | "degrees";
  font?: SongFont;
  bpm?: number | null;
  time_signature?: string | null;
};

type Props = { value: SongFields; onChange: (v: SongFields) => void; showPreview?: boolean };

export default function SongFormFields({ value, onChange, showPreview = true }: Props) {
  const set = (patch: Partial<SongFields>) => onChange({ ...value, ...patch });
  const { editMode, chordsLyrics, degreesLyrics, visibleLyrics } = useMemo(() => {
    const rawLyrics = value.lyrics ?? "";
    const rawLooksLikeDegrees = rawLyrics.split("\n").some((line) => isDegreeLine(line));
    const resolvedChords = value.chordsLyrics ?? (rawLooksLikeDegrees ? lyricsToChords(rawLyrics, value.song_key) : rawLyrics);
    const resolvedDegrees = value.degreesLyrics ?? (rawLooksLikeDegrees ? rawLyrics : lyricsToDegrees(rawLyrics, value.song_key));
    const resolvedMode = value.editMode ?? (rawLooksLikeDegrees ? "degrees" : "chords");

    return {
      editMode: resolvedMode,
      chordsLyrics: resolvedChords,
      degreesLyrics: resolvedDegrees,
      visibleLyrics: resolvedMode === "degrees" ? resolvedDegrees : resolvedChords,
    };
  }, [value.lyrics, value.chordsLyrics, value.degreesLyrics, value.editMode, value.song_key]);
  return (
    <div className="space-y-3">
      <div>
        <Label>Título *</Label>
        <Input value={value.title} onChange={e => set({ title: e.target.value })} placeholder="Cuán Grande es Dios (C)" />
      </div>
      <div>
        <Label>Artista (opcional)</Label>
        <Input value={value.artist} onChange={e => set({ artist: e.target.value })} placeholder="Marcos Witt" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tono original</Label>
          <Select value={value.song_key} onValueChange={k => set({ song_key: k })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {KEY_OPTIONS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Fuente</Label>
          <Select value={value.font ?? "arial"} onValueChange={(f) => set({ font: f as SongFont })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>BPM (opcional)</Label>
          <Input
            type="number"
            inputMode="numeric"
            min={20}
            max={400}
            value={value.bpm ?? ""}
            onChange={e => {
              const v = e.target.value;
              set({ bpm: v === "" ? null : Math.max(0, Math.min(400, Number(v))) });
            }}
            placeholder="120"
          />
        </div>
        <div>
          <Label>Compás (opcional)</Label>
          <Select
            value={value.time_signature ?? "none"}
            onValueChange={v => set({ time_signature: v === "none" ? null : v })}
          >
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {TIME_SIGNATURE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
          <Label>Letra con acordes</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Editar como:</span>
            <Select
              value={editMode}
              onValueChange={(v) => {
                const next = v as "chords" | "degrees";
                if (next === editMode) return;
                set({
                  editMode: next,
                  chordsLyrics,
                  degreesLyrics,
                  lyrics: next === "degrees" ? degreesLyrics : chordsLyrics,
                });
              }}
            >
              <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="chords">Acordes</SelectItem>
                <SelectItem value="degrees">Grados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          {editMode === "chords"
            ? <>Acordes en una línea sola arriba de la letra. Las etiquetas <b>Coro</b>, <b>Verso</b>, <b>Pre-coro</b>, <b>Puente</b>, etc. se ven en negrita.</>
            : <>Estás editando en <b>grados</b> (ej: <code>I IIm IV V</code>, <code>bVII</code>, <code>V/VII</code>, <code>VII°</code>). Se guardan así y se convierten al tono al mostrar.</>}
        </p>
        <Textarea
          rows={14}
          className="font-song whitespace-pre"
          value={visibleLyrics}
          onChange={e => {
            const nextLyrics = e.target.value;
            set(editMode === "degrees"
              ? {
                  editMode,
                  degreesLyrics: nextLyrics,
                  chordsLyrics,
                  lyrics: nextLyrics,
                }
              : {
                  editMode,
                  chordsLyrics: nextLyrics,
                  degreesLyrics,
                  lyrics: nextLyrics,
                });
          }}
          placeholder={editMode === "chords"
            ? "Estrofa\nC            G            Am          F\nCuán grande es Él, cuán grande es Él"
            : "Estrofa\nI            V            VIm         IV\nCuán grande es Él, cuán grande es Él"}
        />
      </div>
      {showPreview && (
        <div>
          <Label className="text-xs text-muted-foreground">Vista previa en vivo</Label>
          <SongPreview
            title={value.title}
            artist={value.artist}
            song_key={value.song_key}
            lyrics={visibleLyrics}
            chordsLyrics={chordsLyrics}
            degreesLyrics={degreesLyrics}
            font={value.font}
            bpm={value.bpm ?? null}
            time_signature={value.time_signature ?? null}
          />

        </div>
      )}
    </div>
  );
}
