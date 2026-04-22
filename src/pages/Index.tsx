import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useChurch } from "@/hooks/useChurch";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Music, Plus, Settings, Crown, Sun, Moon, LogOut as Leave, Trash2 } from "lucide-react";
import GlobalCatalog, { GlobalSong } from "@/components/GlobalCatalog";
import SetlistsView, { Setlist } from "@/components/SetlistsView";
import SetlistDetail from "@/components/SetlistDetail";
import SongViewer from "@/components/SongViewer";
import OwnerReview from "@/components/OwnerReview";
import ChurchSettings from "@/components/ChurchSettings";
import AddToSetlistDialog from "@/components/AddToSetlistDialog";
import ProfileDialog from "@/components/ProfileDialog";
import InstallPrompt from "@/components/InstallPrompt";

type Tab = "catalog" | "lists" | "review" | "settings";

export default function Index() {
  const { user, loading: authLoading, isOwner } = useAuth();
  const { memberships, current, setCurrent, refresh, loading: chLoading } = useChurch();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [tab, setTab] = useState<Tab>("catalog");
  const [openSetlist, setOpenSetlist] = useState<Setlist | null>(null);
  // Mantenemos la lista del catálogo para navegar entre canciones desde el visor
  const [viewingGlobal, setViewingGlobal] = useState<GlobalSong | null>(null);
  const [globalSiblings, setGlobalSiblings] = useState<GlobalSong[]>([]);
  const [addToList, setAddToList] = useState<GlobalSong | null>(null);
  const [newChurchOpen, setNewChurchOpen] = useState(false);
  const [newChurchName, setNewChurchName] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  // Acepta token de invitación si llega en la URL
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

  // ¿El usuario ya creó una iglesia? (regla: máximo 1)
  const [createdChurchId, setCreatedChurchId] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase.from("churches").select("id").eq("created_by", user.id).maybeSingle()
      .then(({ data }) => setCreatedChurchId(data?.id ?? null));
  }, [user, memberships]);

  const createChurch = async () => {
    if (!user || !newChurchName.trim()) return;
    if (createdChurchId) {
      toast.error("Sólo podés crear una iglesia. Eliminá la actual para crear otra.");
      return;
    }
    const { error } = await supabase.from("churches").insert({ name: newChurchName.trim(), created_by: user.id });
    if (error) {
      // Captura del índice único por si la condición anterior falla
      if (error.message.includes("churches_one_per_creator")) {
        toast.error("Ya creaste una iglesia. Eliminala antes de crear otra.");
      } else toast.error(error.message);
      return;
    }
    toast.success("Iglesia creada");
    setNewChurchName("");
    setNewChurchOpen(false);
    await refresh();
  };

  // Salir de una iglesia donde soy miembro
  const leaveChurch = async () => {
    if (!user || !current) return;
    const { error } = await supabase.from("church_members")
      .delete().eq("church_id", current.id).eq("user_id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Saliste de la iglesia");
    setOpenSetlist(null);
    await refresh();
  };

  // Eliminar la iglesia que YO creé
  const deleteMyChurch = async () => {
    if (!user || !current || current.id !== createdChurchId) return;
    const { error } = await supabase.from("churches").delete().eq("id", current.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Iglesia eliminada");
    setOpenSetlist(null);
    setCreatedChurchId(null);
    await refresh();
  };

  const canCreateChurch = !createdChurchId;
  const isCreatorOfCurrent = !!current && current.id === createdChurchId;

  if (authLoading || chLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2 flex-wrap">
          <Music className="w-5 h-5 text-primary shrink-0" />
          <h1 className="font-bold shrink-0 hidden sm:block">Acordes</h1>
          {isOwner && <Badge variant="secondary" className="hidden sm:inline-flex"><Crown className="w-3 h-3 mr-1" /> Dueño</Badge>}

          {memberships.length > 0 ? (
            <Select value={current?.id ?? ""} onValueChange={(id) => {
              const m = memberships.find(x => x.id === id);
              if (m) { setCurrent(m); setOpenSetlist(null); }
            }}>
              <SelectTrigger className="max-w-[200px]"><SelectValue placeholder="Iglesia" /></SelectTrigger>
              <SelectContent>
                {memberships.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name} {m.role === "admin" && "👑"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm text-muted-foreground">Sin iglesia</span>
          )}

          {/* Crear iglesia (sólo si todavía no creó una) */}
          <Dialog open={newChurchOpen} onOpenChange={setNewChurchOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" title={canCreateChurch ? "Nueva iglesia" : "Ya creaste una iglesia"} disabled={!canCreateChurch}>
                <Plus className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nueva iglesia</DialogTitle></DialogHeader>
              <p className="text-xs text-muted-foreground">Cada usuario puede crear una sola iglesia. Podés unirte a otras por invitación.</p>
              <Label>Nombre</Label>
              <Input value={newChurchName} onChange={e => setNewChurchName(e.target.value)} placeholder="Iglesia Central" />
              <Button onClick={createChurch} disabled={!newChurchName.trim()}>Crear</Button>
            </DialogContent>
          </Dialog>

          {/* Acciones sobre la iglesia actual */}
          {current && (
            isCreatorOfCurrent ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" title="Eliminar mi iglesia"><Trash2 className="w-4 h-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar "{current.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se borrarán sus listas, miembros e invitaciones. Las canciones del catálogo global no se ven afectadas. Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteMyChurch}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" title="Salir de esta iglesia"><Leave className="w-4 h-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Salir de "{current.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>Perderás acceso a sus listas. Podrás volver si te invitan otra vez.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={leaveChurch}>Salir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )
          )}

          <div className="flex-1" />
          {/* Toggle de tema rápido */}
          <Button size="icon" variant="ghost" onClick={toggle} title={theme === "dark" ? "Modo claro" : "Modo oscuro"}>
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <ProfileDialog />
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {viewingGlobal ? (
          <SongViewer
            song={viewingGlobal}
            siblings={globalSiblings}
            onSelect={(s) => {
              const found = globalSiblings.find(g => g.id === (s as any).id);
              if (found) setViewingGlobal(found);
            }}
            onBack={() => setViewingGlobal(null)}
          />
        ) : openSetlist && current ? (
          <SetlistDetail church={current} setlist={openSetlist} onBack={() => setOpenSetlist(null)} />
        ) : (
          <Tabs value={tab} onValueChange={v => setTab(v as Tab)} className="space-y-4">
            <TabsList className="w-full flex-wrap h-auto">
              <TabsTrigger value="catalog">Catálogo</TabsTrigger>
              <TabsTrigger value="lists" disabled={!current}>Listas</TabsTrigger>
              {isOwner && <TabsTrigger value="review">Revisión</TabsTrigger>}
              {current?.role === "admin" && (
                <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1" /> Iglesia</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="catalog">
              <GlobalCatalog
                church={current}
                onView={(s, siblings) => { setGlobalSiblings(siblings); setViewingGlobal(s); }}
                onAddToSetlist={s => setAddToList(s)}
              />
            </TabsContent>

            <TabsContent value="lists">
              {current ? (
                <SetlistsView church={current} onOpen={s => setOpenSetlist(s)} />
              ) : (
                <Card className="p-8 text-center text-muted-foreground">
                  Necesitás pertenecer a una iglesia. Crea una con el botón ➕ o pedile a un admin que te invite.
                </Card>
              )}
            </TabsContent>

            {isOwner && (
              <TabsContent value="review"><OwnerReview /></TabsContent>
            )}

            {current?.role === "admin" && (
              <TabsContent value="settings">
                <ChurchSettings church={current} onBack={() => setTab("catalog")} />
              </TabsContent>
            )}
          </Tabs>
        )}
      </main>

      {current && (
        <AddToSetlistDialog church={current} song={addToList} onClose={() => setAddToList(null)} />
      )}

      <InstallPrompt />
    </div>
  );
}
