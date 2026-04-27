import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KEY_OPTIONS } from "@/lib/chords";
import SongPreview from "./SongPreview";

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
  font?: SongFont;
  bpm?: number | null;
  time_signature?: string | null;
};

type Props = { value: SongFields; onChange: (v: SongFields) => void; showPreview?: boolean };

export default function SongFormFields({ value, onChange, showPreview = true }: Props) {
  const set = (patch: Partial<SongFields>) => onChange({ ...value, ...patch });
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
        <Label>Letra con acordes</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Acordes en una línea sola arriba de la letra. Las etiquetas <b>Coro</b>, <b>Coro 2</b>, <b>Verso</b>, <b>Verso 2</b>, <b>Estrofa</b>, <b>Pre-coro</b>, <b>Puente</b>, <b>Puente 2</b>, etc. se ven en negrita automáticamente.
        </p>
        <Textarea
          rows={14}
          className="font-song whitespace-pre"
          value={value.lyrics}
          onChange={e => set({ lyrics: e.target.value })}
          placeholder={"Estrofa\nC            G            Am          F\nCuán grande es Él, cuán grande es Él"}
        />
      </div>
      {showPreview && (
        <div>
          <Label className="text-xs text-muted-foreground">Vista previa en vivo</Label>
          <SongPreview
            title={value.title}
            artist={value.artist}
            song_key={value.song_key}
            lyrics={value.lyrics}
            font={value.font}
          />
        </div>
      )}
    </div>
  );
}
