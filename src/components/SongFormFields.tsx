import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NOTES_SHARP } from "@/lib/chords";

// Campos compartidos para crear/editar una canción (catálogo global o item de setlist)
export type SongFields = { title: string; artist: string; song_key: string; lyrics: string };

type Props = { value: SongFields; onChange: (v: SongFields) => void };

export default function SongFormFields({ value, onChange }: Props) {
  const set = (patch: Partial<SongFields>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-3">
      <div>
        <Label>Título *</Label>
        <Input value={value.title} onChange={e => set({ title: e.target.value })} placeholder="Cuán grande es Él" />
      </div>
      <div>
        <Label>Artista (opcional)</Label>
        <Input value={value.artist} onChange={e => set({ artist: e.target.value })} placeholder="Marcos Witt" />
      </div>
      <div>
        <Label>Tono original</Label>
        <Select value={value.song_key} onValueChange={k => set({ song_key: k })}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {NOTES_SHARP.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Letra con acordes</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Acordes en una línea sola arriba de la letra (separados por espacios para alinearlos).
        </p>
        <Textarea
          rows={14}
          className="font-song whitespace-pre"
          value={value.lyrics}
          onChange={e => set({ lyrics: e.target.value })}
          placeholder={"C            G            Am          F\nCuán grande es Él, cuán grande es Él"}
        />
      </div>
    </div>
  );
}
