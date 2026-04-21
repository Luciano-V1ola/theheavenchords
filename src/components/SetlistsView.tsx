import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Eye, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Membership } from "@/hooks/useChurch";

export type Setlist = { id: string; name: string; church_id: string };

type Props = {
  church: Membership;
  onOpen: (s: Setlist) => void;
  refreshSignal?: number;       // para refrescar al volver de detalle
};

export default function SetlistsView({ church, onOpen, refreshSignal }: Props) {
  const { user } = useAuth();
  const [lists, setLists] = useState<Setlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Setlist | null>(null);
  const isAdmin = church.role === "admin";

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("setlists")
      .select("id, name, church_id")
      .eq("church_id", church.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setLists(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [church.id, refreshSignal]);

  const create = async () => {
    if (!name.trim() || !user) return;
    const { error } = await supabase.from("setlists").insert({
      name: name.trim(), church_id: church.id, created_by: user.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Lista creada"); setName(""); setOpen(false); load(); }
  };

  const rename = async () => {
    if (!editing || !name.trim()) return;
    const { error } = await supabase.from("setlists").update({ name: name.trim() }).eq("id", editing.id);
    if (error) toast.error(error.message);
    else { toast.success("Renombrada"); setEditing(null); setName(""); load(); }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("setlists").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Eliminada"); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold flex-1">Listas de {church.name}</h2>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-1" /> Nueva lista</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nueva lista</DialogTitle></DialogHeader>
              <Label>Nombre</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Domingo 21/04" />
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={create} disabled={!name.trim()}>Crear</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Cargando...</p>
      ) : lists.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          {isAdmin ? "Crea tu primera lista para empezar." : "Aún no hay listas en esta iglesia."}
        </Card>
      ) : lists.map(s => (
        <Card key={s.id} className="p-4 flex items-center gap-3 flex-wrap">
          <h3 className="font-semibold flex-1 min-w-[180px]">{s.name}</h3>
          <Button size="sm" variant="outline" onClick={() => onOpen(s)}><Eye className="w-4 h-4 mr-1" /> Abrir</Button>
          {isAdmin && (
            <>
              <Button size="sm" variant="outline" onClick={() => { setEditing(s); setName(s.name); }}>
                <Pencil className="w-4 h-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive"><Trash2 className="w-4 h-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar "{s.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>Se borrará la lista y todas sus canciones (la copia local).</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(s.id)}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </Card>
      ))}

      {/* Renombrar */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renombrar lista</DialogTitle></DialogHeader>
          <Input value={name} onChange={e => setName(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={rename}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
