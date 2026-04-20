import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useChurch } from "@/hooks/useChurch";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Music, Plus, LogOut, Settings } from "lucide-react";
import SongList from "@/components/SongList";
import SongEditor from "@/components/SongEditor";
import SongViewer from "@/components/SongViewer";
import ChurchSettings from "@/components/ChurchSettings";

type View = "list" | "editor" | "viewer" | "settings";

export default function Index() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { memberships, current, setCurrent, refresh, loading: chLoading } = useChurch();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [view, setView] = useState<View>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [newChurchOpen, setNewChurchOpen] = useState(false);
  const [newChurchName, setNewChurchName] = useState("");

  // Redirige a /auth si no hay sesión
  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  // Si llega un token de invitación en URL ya autenticado, lo acepta
  useEffect(() => {
    const token = params.get("invite");
    if (user && token) {
      supabase.rpc("accept_invitation", { _token: token }).then(({ error }) => {
        if (error) toast.error("Invitación inválida: " + error.message);
        else { toast.success("¡Te uniste a la iglesia!"); refresh(); }
        params.delete("invite");
        setParams(params, { replace: true });
      });
    }
  }, [user, params, setParams, refresh]);

  const createChurch = async () => {
    if (!user || !newChurchName.trim()) return;
    const { error } = await supabase.from("churches").insert({ name: newChurchName.trim(), created_by: user.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Iglesia creada");
    setNewChurchName("");
    setNewChurchOpen(false);
    await refresh();
  };

  if (authLoading || chLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando...</div>;
  }

  // Sin iglesia → onboarding
  if (memberships.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full p-8 space-y-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mx-auto">
            <Music className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Bienvenido</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Crea una iglesia para empezar, o pide a un admin que te invite por email.
            </p>
          </div>
          <div className="space-y-2 text-left">
            <Label>Nombre de la iglesia</Label>
            <Input value={newChurchName} onChange={e => setNewChurchName(e.target.value)} placeholder="Ej: Iglesia Central" />
            <Button onClick={createChurch} className="w-full" disabled={!newChurchName.trim()}>
              Crear iglesia
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
            <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Music className="w-5 h-5 text-primary shrink-0" />
          <h1 className="font-bold shrink-0 hidden sm:block">Acordes</h1>

          {/* Selector de iglesia */}
          <Select value={current?.id} onValueChange={(id) => {
            const m = memberships.find(x => x.id === id);
            if (m) { setCurrent(m); setView("list"); }
          }}>
            <SelectTrigger className="max-w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {memberships.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name} {m.role === "admin" && "👑"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Crear nueva iglesia */}
          <Dialog open={newChurchOpen} onOpenChange={setNewChurchOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" title="Nueva iglesia"><Plus className="w-4 h-4" /></Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nueva iglesia</DialogTitle></DialogHeader>
              <Label>Nombre</Label>
              <Input value={newChurchName} onChange={e => setNewChurchName(e.target.value)} placeholder="Iglesia Central" />
              <Button onClick={createChurch} disabled={!newChurchName.trim()}>Crear</Button>
            </DialogContent>
          </Dialog>

          <div className="flex-1" />

          {current?.role === "admin" && (
            <Button size="icon" variant="ghost" onClick={() => setView("settings")} title="Ajustes de iglesia">
              <Settings className="w-4 h-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={signOut} title="Salir">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {!current ? (
          <p className="text-center text-muted-foreground py-12">Selecciona una iglesia</p>
        ) : view === "list" ? (
          <SongList
            church={current}
            onView={(id) => { setViewingId(id); setView("viewer"); }}
            onEdit={(id) => { setEditingId(id); setView("editor"); }}
            onNew={() => { setEditingId(null); setView("editor"); }}
          />
        ) : view === "editor" ? (
          <SongEditor
            church={current}
            songId={editingId}
            onDone={() => setView("list")}
          />
        ) : view === "viewer" && viewingId ? (
          <SongViewer
            church={current}
            songId={viewingId}
            onBack={() => setView("list")}
            onEdit={() => { setEditingId(viewingId); setView("editor"); }}
          />
        ) : view === "settings" ? (
          <ChurchSettings church={current} onBack={() => setView("list")} />
        ) : null}
      </main>
    </div>
  );
}
