import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Eye, ListPlus, Clock, X } from "lucide-react";
import { toast } from "sonner";
import SongFormFields, { SongFields } from "./SongFormFields";
import type { Membership } from "@/hooks/useChurch";

// Canción del catálogo global
export type GlobalSong = {
  id: string; title: string; artist: string | null; song_key: string; lyrics: string;
  status: "pending" | "approved" | "rejected"; proposed_by: string;
};

type Props = {
  church: Membership | null;
  onView: (s: GlobalSong) => void;
  onAddToSetlist: (s: GlobalSong) => void;   // abre selector de lista
};

export default function GlobalCatalog({ church, onView, onAddToSetlist }: Props) {
  const { user } = useAuth();
  const [songs, setSongs] = useState<GlobalSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [proposeOpen, setProposeOpen] = useState(false);
  const [draft, setDraft] = useState<SongFields>({ title: "", artist: "", song_key: "C", lyrics: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    // Trae aprobadas + las propias (pendientes/rechazadas) gracias al RLS
    const { data, error } = await supabase
      .from("global_songs")
      .select("id, title, artist, song_key, lyrics, status, proposed_by")
      .order("title");
    if (error) toast.error(error.message);
    else setSongs((data ?? []) as GlobalSong[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const propose = async () => {
    if (!user) return;
    if (!draft.title.trim() || !draft.lyrics.trim()) { toast.error("Faltan campos"); return; }
    setSaving(true);
    const { error } = await supabase.from("global_songs").insert({
      title: draft.title.trim(),
      artist: draft.artist.trim() || null,
      song_key: draft.song_key,
      lyrics: draft.lyrics,
      proposed_by: user.id,
      status: "pending",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Propuesta enviada al Dueño para revisión");
    setDraft({ title: "", artist: "", song_key: "C", lyrics: "" });
    setProposeOpen(false);
    load();
  };

  const cancelProposal = async (id: string) => {
    const { error } = await supabase.from("global_songs").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Propuesta cancelada"); load(); }
  };

  const f = filter.toLowerCase();
  const filtered = songs.filter(s =>
    !f || s.title.toLowerCase().includes(f) || (s.artist ?? "").toLowerCase().includes(f)
  );
  const approved = filtered.filter(s => s.status === "approved");
  const mine = filtered.filter(s => s.status !== "approved" && s.proposed_by === user?.id);
  const isAdminOfChurch = church?.role === "admin";

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar canción..." value={filter} onChange={e => setFilter(e.target.value)} />
        </div>
        <Dialog open={proposeOpen} onOpenChange={setProposeOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" /> Proponer</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Proponer canción al catálogo global</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Tu propuesta será revisada por el Dueño antes de publicarse.</p>
            <SongFormFields value={draft} onChange={setDraft} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setProposeOpen(false)}>Cancelar</Button>
              <Button onClick={propose} disabled={saving}>{saving ? "..." : "Enviar a revisión"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {mine.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Tus propuestas</h3>
          {mine.map(s => (
            <Card key={s.id} className="p-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{s.title}</h4>
                  {s.status === "pending" && <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pendiente</Badge>}
                  {s.status === "rejected" && <Badge variant="destructive">Rechazada</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{s.artist || "Sin artista"} · {s.song_key}</p>
              </div>
              {s.status === "pending" && (
                <Button size="sm" variant="ghost" onClick={() => cancelProposal(s.id)}>
                  <X className="w-4 h-4 mr-1" /> Cancelar
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Catálogo aprobado</h3>
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Cargando...</p>
        ) : approved.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Aún no hay canciones aprobadas. ¡Proponé la primera!
          </Card>
        ) : approved.map(s => (
          <Card key={s.id} className="p-4 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <h4 className="font-semibold">{s.title}</h4>
              <p className="text-sm text-muted-foreground">{s.artist || "Sin artista"} · Tono: {s.song_key}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onView(s)}>
                <Eye className="w-4 h-4 mr-1" /> Ver
              </Button>
              {isAdminOfChurch && (
                <Button size="sm" onClick={() => onAddToSetlist(s)}>
                  <ListPlus className="w-4 h-4 mr-1" /> A lista
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
