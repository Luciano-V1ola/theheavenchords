import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalRole } from "@/hooks/useGlobalRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, Eye, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import SongFormFields, { SongFields, SongFont } from "./SongFormFields";
import SongViewer from "./SongViewer";

type Item = {
  id: string; title: string; artist: string | null; song_key: string; lyrics: string;
  status: "pending" | "approved" | "rejected"; proposed_by: string; created_at: string;
  hidden: boolean; pending_changes: string | null;
  font?: SongFont;
  bpm?: number | null;
  time_signature?: string | null;
};

function packLyrics(lyrics: string, font: SongFont | undefined): string {
  const f = font ?? "arial";
  return `[font:${f}]\n${lyrics.replace(/^\[font:(arial|calibri)\]\s*\n?/i, "")}`;
}
function unpackLyrics(lyrics: string): { font: SongFont; clean: string } {
  const m = lyrics.match(/^\[font:(arial|calibri)\]\s*\n?/i);
  if (!m) return { font: "arial", clean: lyrics };
  return { font: m[1].toLowerCase() as SongFont, clean: lyrics.slice(m[0].length) };
}

// Bandeja de Revisión: 2 secciones
//  - Pendientes: propuestas nuevas que esperan aprobación.
//  - Ocultas: canciones que un moderador editó/eliminó (esperan que el Dueño restaure o borre).
export default function OwnerReview() {
  const { user } = useAuth();
  const { isOwner } = useGlobalRole();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Item | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [draft, setDraft] = useState<SongFields>({ title: "", artist: "", song_key: "C", lyrics: "", font: "arial", bpm: null, time_signature: null });
  const [rejectFor, setRejectFor] = useState<Item | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("global_songs")
      .select("id, title, artist, song_key, lyrics, status, proposed_by, created_at, hidden, pending_changes, bpm, time_signature")
      .or("status.eq.pending,hidden.eq.true")
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    else setItems(((data ?? []) as Item[]).map(p => {
      const { font, clean } = unpackLyrics(p.lyrics);
      return { ...p, font, lyrics: clean };
    }));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async (s: Item) => {
    const { error } = await supabase
      .from("global_songs")
      .update({ status: "approved", reviewed_by: user!.id, reviewed_at: new Date().toISOString(), reject_reason: null })
      .eq("id", s.id);
    if (error) toast.error(error.message);
    else { toast.success("Aprobada"); load(); }
  };

  const reject = async () => {
    if (!rejectFor) return;
    const { error } = await supabase
      .from("global_songs")
      .update({
        status: "rejected", reviewed_by: user!.id, reviewed_at: new Date().toISOString(),
        reject_reason: rejectReason.trim() || null,
      })
      .eq("id", rejectFor.id);
    if (error) toast.error(error.message);
    else { toast.success("Rechazada"); setRejectFor(null); setRejectReason(""); load(); }
  };

  const restore = async (s: Item) => {
    const { error } = await supabase.from("global_songs")
      .update({ hidden: false, pending_changes: null })
      .eq("id", s.id);
    if (error) toast.error(error.message);
    else { toast.success("Restaurada al catálogo"); load(); }
  };

  const deleteForever = async (s: Item) => {
    const { error } = await supabase.from("global_songs").delete().eq("id", s.id);
    if (error) toast.error(error.message);
    else { toast.success("Eliminada definitivamente"); load(); }
  };

  const startEdit = (s: Item) => {
    setDraft({ title: s.title, artist: s.artist ?? "", song_key: s.song_key, lyrics: s.lyrics, font: s.font ?? "arial", bpm: s.bpm ?? null, time_signature: s.time_signature ?? null });
    setEditing(s);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase.from("global_songs").update({
      title: draft.title.trim(),
      artist: draft.artist.trim() || null,
      song_key: draft.song_key,
      lyrics: packLyrics(draft.lyrics, draft.font),
      bpm: draft.bpm ?? null,
      time_signature: draft.time_signature ?? null,
    } as any).eq("id", editing.id);
    if (error) toast.error(error.message);
    else { toast.success("Guardado"); setEditing(null); load(); }
  };

  if (viewing) {
    return <SongViewer song={viewing} onBack={() => setViewing(null)} onEdit={() => { startEdit(viewing); setViewing(null); }} />;
  }

  const pending = items.filter(i => i.status === "pending" && !i.hidden);
  const hidden = items.filter(i => i.hidden);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Revisión</h2>
        <p className="text-sm text-muted-foreground">Propuestas nuevas y canciones enviadas a revisión por moderadores.</p>
      </div>

      <Tabs defaultValue="pending" className="space-y-3">
        <TabsList>
          <TabsTrigger value="pending">Pendientes ({pending.length})</TabsTrigger>
          <TabsTrigger value="hidden">Ocultas ({hidden.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3">
          {loading ? <p className="text-center text-muted-foreground py-8">Cargando...</p>
          : pending.length === 0 ? <Card className="p-8 text-center text-muted-foreground">No hay propuestas pendientes 🎉</Card>
          : pending.map(s => (
            <Card key={s.id} className="p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold flex-1 min-w-[160px]">{s.title}</h3>
                <Badge variant="secondary">Pendiente</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{s.artist || "Sin artista"} · Tono: {s.song_key}</p>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setViewing(s)}><Eye className="w-4 h-4 mr-1" /> Ver</Button>
                <Button size="sm" variant="outline" onClick={() => startEdit(s)}><Pencil className="w-4 h-4 mr-1" /> Editar</Button>
                <Button size="sm" onClick={() => approve(s)}><Check className="w-4 h-4 mr-1" /> Aprobar</Button>
                <Button size="sm" variant="destructive" onClick={() => setRejectFor(s)}><X className="w-4 h-4 mr-1" /> Rechazar</Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="hidden" className="space-y-3">
          {loading ? <p className="text-center text-muted-foreground py-8">Cargando...</p>
          : hidden.length === 0 ? <Card className="p-8 text-center text-muted-foreground">Sin canciones en revisión por moderadores.</Card>
          : hidden.map(s => (
            <Card key={s.id} className="p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold flex-1 min-w-[160px]">{s.title}</h3>
                <Badge variant="destructive">Oculta</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{s.artist || "Sin artista"} · Tono: {s.song_key}</p>
              {s.pending_changes && (
                <p className="text-xs italic text-muted-foreground">Motivo: {s.pending_changes}</p>
              )}
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setViewing(s)}><Eye className="w-4 h-4 mr-1" /> Ver</Button>
                <Button size="sm" variant="outline" onClick={() => startEdit(s)}><Pencil className="w-4 h-4 mr-1" /> Editar</Button>
                <Button size="sm" onClick={() => restore(s)}><RotateCcw className="w-4 h-4 mr-1" /> Restaurar al catálogo</Button>
                {isOwner && (
                  <Button size="sm" variant="destructive" onClick={() => deleteForever(s)}>
                    <Trash2 className="w-4 h-4 mr-1" /> Eliminar definitivamente
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar canción</DialogTitle></DialogHeader>
          <SongFormFields value={draft} onChange={setDraft} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Guardar cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectFor} onOpenChange={o => !o && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rechazar "{rejectFor?.title}"</DialogTitle></DialogHeader>
          <Label>Motivo (opcional)</Label>
          <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Letra incompleta..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={reject}>Rechazar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
