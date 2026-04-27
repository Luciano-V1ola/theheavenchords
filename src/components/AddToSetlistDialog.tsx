import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { GlobalSong } from "./GlobalCatalog";
import type { Membership } from "@/hooks/useChurch";

type Props = {
  church: Membership;
  song: GlobalSong | null;
  onClose: () => void;
};

// Permite a un admin de iglesia copiar una canción global a una de sus listas
export default function AddToSetlistDialog({ church, song, onClose }: Props) {
  const { user } = useAuth();
  const [lists, setLists] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!song) return;
    supabase.from("setlists").select("id, name").eq("church_id", church.id).order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else { setLists(data ?? []); setSelected(data?.[0]?.id ?? ""); }
      });
  }, [song, church.id]);

  const add = async () => {
    if (!song || !selected || !user) return;
    setSaving(true);
    // Re-empaca la fuente como metadata al inicio para que la copia conserve la tipografía
    const font = song.font ?? "arial";
    const lyricsToStore = `[font:${font}]\n${song.lyrics.replace(/^\[font:(arial|calibri)\]\s*\n?/i, "")}`;
    const { error } = await supabase.from("setlist_songs").insert({
      setlist_id: selected,
      global_song_id: song.id,
      title: song.title,
      artist: song.artist,
      song_key: song.song_key,
      lyrics: lyricsToStore,
      added_by: user.id,
      bpm: song.bpm ?? null,
      time_signature: song.time_signature ?? null,
    } as any);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Agregada a la lista"); onClose(); }
  };

  return (
    <Dialog open={!!song} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Agregar "{song?.title}" a una lista</DialogTitle></DialogHeader>
        {lists.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tenés listas todavía. Crea una en la pestaña "Listas".</p>
        ) : (
          <>
            <Label>Lista de destino</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {lists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={add} disabled={!selected || saving}>{saving ? "..." : "Agregar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
