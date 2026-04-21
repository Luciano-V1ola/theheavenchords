import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";
import SongFormFields, { SongFields } from "./SongFormFields";
import SongViewer from "./SongViewer";

type Pending = {
  id: string; title: string; artist: string | null; song_key: string; lyrics: string;
  status: "pending" | "approved" | "rejected"; proposed_by: string; created_at: string;
};

// Bandeja exclusiva del Dueño global
export default function OwnerReview() {
  const { user } = useAuth();
  const [items, setItems] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Pending | null>(null);
  const [editing, setEditing] = useState<Pending | null>(null);
  const [draft, setDraft] = useState<SongFields>({ title: "", artist: "", song_key: "C", lyrics: "" });
  const [rejectFor, setRejectFor] = useState<Pending | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("global_songs")
      .select("id, title, artist, song_key, lyrics, status, proposed_by, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    else setItems((data ?? []) as Pending[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async (s: Pending) => {
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

  const startEdit = (s: Pending) => {
    setDraft({ title: s.title, artist: s.artist ?? "", song_key: s.song_key, lyrics: s.lyrics });
    setEditing(s);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase.from("global_songs").update({
      title: draft.title.trim(),
      artist: draft.artist.trim() || null,
      song_key: draft.song_key,
      lyrics: draft.lyrics,
    }).eq("id", editing.id);
    if (error) toast.error(error.message);
    else { toast.success("Guardado"); setEditing(null); load(); }
  };

  if (viewing) {
    return <SongViewer song={viewing} onBack={() => setViewing(null)} onEdit={() => { startEdit(viewing); setViewing(null); }} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Revisión del Dueño</h2>
        <p className="text-sm text-muted-foreground">Canciones esperando tu aprobación para entrar al catálogo global.</p>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Cargando...</p>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No hay propuestas pendientes 🎉</Card>
      ) : items.map(s => (
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

      {/* Edición inline */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar antes de aprobar</DialogTitle></DialogHeader>
          <SongFormFields value={draft} onChange={setDraft} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Guardar cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Motivo de rechazo */}
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
