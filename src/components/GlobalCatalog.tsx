import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Eye, ListPlus, Clock, X, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import SongFormFields, { SongFields, SongFont } from "./SongFormFields";
import type { Membership } from "@/hooks/useChurch";

// Canción del catálogo global
export type GlobalSong = {
  id: string; title: string; artist: string | null; song_key: string; lyrics: string;
  status: "pending" | "approved" | "rejected"; proposed_by: string;
  contributor_name?: string | null;
  font?: SongFont | null;
};

type Props = {
  church: Membership | null;
  // Recibe la canción y la lista de "hermanas" para navegar en el visor
  onView: (s: GlobalSong, siblings: GlobalSong[]) => void;
  onAddToSetlist: (s: GlobalSong) => void;
};

const DRAFT_KEY = "globalCatalog.proposeDraft";
const emptyDraft: SongFields = { title: "", artist: "", song_key: "C", lyrics: "", font: "arial" };

// Helpers para guardar/leer la fuente embebida en la primer línea de lyrics
function packLyrics(lyrics: string, font: SongFont | undefined): string {
  const f = font ?? "arial";
  return `[font:${f}]\n${lyrics.replace(/^\[font:(arial|calibri)\]\s*\n?/i, "")}`;
}
function unpackLyrics(lyrics: string): { font: SongFont; clean: string } {
  const m = lyrics.match(/^\[font:(arial|calibri)\]\s*\n?/i);
  if (!m) return { font: "arial", clean: lyrics };
  return { font: m[1].toLowerCase() as SongFont, clean: lyrics.slice(m[0].length) };
}

export default function GlobalCatalog({ church, onView, onAddToSetlist }: Props) {
  const { user, isOwner } = useAuth();
  const [songs, setSongs] = useState<GlobalSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [proposeOpen, setProposeOpen] = useState(false);
  const [draft, setDraft] = useState<SongFields>(() => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "") || emptyDraft; }
    catch { return emptyDraft; }
  });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<GlobalSong | null>(null);
  const [editDraft, setEditDraft] = useState<SongFields>(emptyDraft);
  const [deleting, setDeleting] = useState<GlobalSong | null>(null);

  // Persistir borrador automáticamente
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("global_songs")
      .select("id, title, artist, song_key, lyrics, status, proposed_by")
      .order("title");
    if (error) { toast.error(error.message); setLoading(false); return; }

    const rows = (data ?? []).map(r => {
      const { font, clean } = unpackLyrics(r.lyrics);
      return { ...r, font, lyrics: clean } as GlobalSong;
    });
    // Traer nombres de colaboradores (sólo se muestran dentro del visor de la canción)
    const ids = Array.from(new Set(rows.map(r => r.proposed_by)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles")
        .select("user_id, display_name").in("user_id", ids);
      const map = new Map((profs ?? []).map(p => [p.user_id, p.display_name]));
      rows.forEach(r => { r.contributor_name = map.get(r.proposed_by) ?? null; });
    }
    setSongs(rows);
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
      lyrics: packLyrics(draft.lyrics, draft.font),
      proposed_by: user.id,
      status: "pending",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Propuesta enviada al Dueño para revisión");
    setDraft(emptyDraft);
    localStorage.removeItem(DRAFT_KEY);
    setProposeOpen(false);
    load();
  };

  const cancelProposal = async (id: string) => {
    const { error } = await supabase.from("global_songs").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Propuesta cancelada"); load(); }
  };

  const startEdit = (s: GlobalSong) => {
    setEditDraft({ title: s.title, artist: s.artist ?? "", song_key: s.song_key, lyrics: s.lyrics, font: s.font ?? "arial" });
    setEditing(s);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase.from("global_songs").update({
      title: editDraft.title.trim(),
      artist: editDraft.artist.trim() || null,
      song_key: editDraft.song_key,
      lyrics: packLyrics(editDraft.lyrics, editDraft.font),
    }).eq("id", editing.id);
    if (error) toast.error(error.message);
    else { toast.success("Cambios guardados"); setEditing(null); load(); }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("global_songs").delete().eq("id", deleting.id);
    if (error) toast.error(error.message);
    else { toast.success("Canción eliminada"); setDeleting(null); load(); }
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
            <p className="text-sm text-muted-foreground">Tu propuesta será revisada por el Dueño antes de publicarse. El borrador se guarda automáticamente.</p>
            <SongFormFields value={draft} onChange={setDraft} />
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => { setDraft(emptyDraft); localStorage.removeItem(DRAFT_KEY); }}>Limpiar</Button>
              <Button variant="outline" onClick={() => setProposeOpen(false)}>Cerrar</Button>
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
          <Card key={s.id} className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <h4 className="font-semibold">{s.title}</h4>
                <p className="text-sm text-muted-foreground">{s.artist || "Sin artista"} · Tono: {s.song_key}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => onView(s, approved)}>
                  <Eye className="w-4 h-4 mr-1" /> Ver
                </Button>
                {isAdminOfChurch && (
                  <Button size="sm" onClick={() => onAddToSetlist(s)}>
                    <ListPlus className="w-4 h-4 mr-1" /> A lista
                  </Button>
                )}
                {isOwner && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => startEdit(s)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeleting(s)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            {/* "Colaborador" se muestra ahora sólo dentro del visor de la canción */}
          </Card>
        ))}
      </div>

      {/* Edición Owner */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar canción del catálogo</DialogTitle></DialogHeader>
          <SongFormFields value={editDraft} onChange={setEditDraft} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Guardar cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <AlertDialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{deleting?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quitará del catálogo global. Las copias ya agregadas a listas de iglesias se conservan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
