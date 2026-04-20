import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Search, Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Membership } from "@/hooks/useChurch";

type Song = { id: string; title: string; artist: string | null; song_key: string; lyrics: string };

type Props = {
  church: Membership;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onNew: () => void;
};

// Lista y buscador de canciones
export default function SongList({ church, onView, onEdit, onNew }: Props) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const isAdmin = church.role === "admin";

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("songs")
      .select("id, title, artist, song_key, lyrics")
      .eq("church_id", church.id)
      .order("title");
    if (error) toast.error(error.message);
    else setSongs(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [church.id]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("songs").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Eliminada"); load(); }
  };

  const filtered = songs.filter(s => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return s.title.toLowerCase().includes(f) ||
           (s.artist ?? "").toLowerCase().includes(f) ||
           s.lyrics.toLowerCase().includes(f);
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar..." value={filter} onChange={e => setFilter(e.target.value)} />
        </div>
        {isAdmin && (
          <Button onClick={onNew}><Plus className="w-4 h-4 mr-1" /> Nueva</Button>
        )}
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-12">Cargando...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          {songs.length === 0
            ? (isAdmin ? "Aún no hay canciones. Crea la primera." : "Aún no hay canciones en esta iglesia.")
            : "Sin resultados."}
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <Card key={s.id} className="p-4 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {s.artist || "Sin artista"} · Tono: {s.song_key}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => onView(s.id)}><Eye className="w-4 h-4 mr-1" /> Ver</Button>
                {isAdmin && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => onEdit(s.id)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive"><Trash2 className="w-4 h-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar "{s.title}"?</AlertDialogTitle>
                          <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(s.id)}>Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
