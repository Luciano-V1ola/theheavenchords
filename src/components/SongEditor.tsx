import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { NOTES_SHARP } from "@/lib/chords";
import { toast } from "sonner";
import type { Membership } from "@/hooks/useChurch";

type Props = { church: Membership; songId: string | null; onDone: () => void };

// Formulario de creación / edición de canción
export default function SongEditor({ church, songId, onDone }: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [songKey, setSongKey] = useState("C");
  const [lyrics, setLyrics] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!songId) return;
    supabase.from("songs").select("*").eq("id", songId).single().then(({ data, error }) => {
      if (error) { toast.error(error.message); return; }
      setTitle(data.title);
      setArtist(data.artist ?? "");
      setSongKey(data.song_key);
      setLyrics(data.lyrics);
    });
  }, [songId]);

  const save = async () => {
    if (!title.trim() || !lyrics.trim()) { toast.error("Faltan campos"); return; }
    setSaving(true);
    const payload = { title: title.trim(), artist: artist.trim() || null, song_key: songKey, lyrics, church_id: church.id };
    const { error } = songId
      ? await supabase.from("songs").update(payload).eq("id", songId)
      : await supabase.from("songs").insert({ ...payload, created_by: user!.id });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Guardada"); onDone(); }
  };

  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-xl font-bold">{songId ? "Editar canción" : "Nueva canción"}</h2>
      <div>
        <Label>Título *</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Cuán grande es Él" />
      </div>
      <div>
        <Label>Artista (opcional)</Label>
        <Input value={artist} onChange={e => setArtist(e.target.value)} placeholder="Marcos Witt" />
      </div>
      <div>
        <Label>Tono original</Label>
        <Select value={songKey} onValueChange={setSongKey}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {NOTES_SHARP.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Letra con acordes</Label>
        <p className="text-xs text-muted-foreground mb-2">Pon los acordes en una línea sola arriba de la letra (separados por espacios para alinearlos).</p>
        <Textarea
          rows={14}
          className="font-song whitespace-pre"
          value={lyrics}
          onChange={e => setLyrics(e.target.value)}
          placeholder={"C            G            Am          F\nCuán grande es Él, cuán grande es Él"}
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>{saving ? "..." : "Guardar"}</Button>
        <Button variant="outline" onClick={onDone}>Cancelar</Button>
      </div>
    </Card>
  );
}
