import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import SongViewer from "./SongViewer";
import SongFormFields, { SongFields } from "./SongFormFields";
import type { Setlist } from "./SetlistsView";
import type { Membership } from "@/hooks/useChurch";

type Item = {
  id: string; setlist_id: string; position: number;
  title: string; artist: string | null; song_key: string; lyrics: string;
};

type Props = { church: Membership; setlist: Setlist; onBack: () => void };

export default function SetlistDetail({ church, setlist, onBack }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Item | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [draft, setDraft] = useState<SongFields>({ title: "", artist: "", song_key: "C", lyrics: "" });
  const isAdmin = church.role === "admin";

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("setlist_songs")
      .select("id, setlist_id, position, title, artist, song_key, lyrics")
      .eq("setlist_id", setlist.id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    else setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [setlist.id]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("setlist_songs").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Quitada de la lista"); load(); }
  };

  const startEdit = (it: Item) => {
    setDraft({ title: it.title, artist: it.artist ?? "", song_key: it.song_key, lyrics: it.lyrics });
    setEditing(it);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase.from("setlist_songs").update({
      title: draft.title.trim(),
      artist: draft.artist.trim() || null,
      song_key: draft.song_key,
      lyrics: draft.lyrics,
    }).eq("id", editing.id);
    if (error) toast.error(error.message);
    else { toast.success("Guardado"); setEditing(null); load(); }
  };

  if (viewing) {
    return (
      <SongViewer
        song={viewing}
        onBack={() => setViewing(null)}
        onEdit={isAdmin ? () => { startEdit(viewing); setViewing(null); } : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Volver</Button>
        <h2 className="font-bold text-xl flex-1 min-w-0 truncate">{setlist.name}</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Agregá canciones desde la pestaña <b>Catálogo</b>. Las que están acá son una copia editable solo para esta iglesia.
      </p>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Cargando...</p>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Lista vacía. Sumá canciones desde el catálogo.</Card>
      ) : items.map(it => (
        <Card key={it.id} className="p-4 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <h4 className="font-semibold">{it.title}</h4>
            <p className="text-sm text-muted-foreground">{it.artist || "Sin artista"} · Tono: {it.song_key}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setViewing(it)}><Eye className="w-4 h-4 mr-1" /> Ver</Button>
            {isAdmin && (
              <>
                <Button size="sm" variant="outline" onClick={() => startEdit(it)}><Pencil className="w-4 h-4" /></Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive"><Trash2 className="w-4 h-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Quitar "{it.title}" de la lista?</AlertDialogTitle>
                      <AlertDialogDescription>No afecta al catálogo global.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove(it.id)}>Quitar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </Card>
      ))}

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar canción en esta lista</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Estos cambios solo afectan a esta lista de tu iglesia.</p>
          <SongFormFields value={draft} onChange={setDraft} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
