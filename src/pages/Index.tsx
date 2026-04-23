import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useChurch } from "@/hooks/useChurch";
import { useGlobalRole } from "@/hooks/useGlobalRole";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Music, Plus, Settings, Crown, Shield, LogIn } from "lucide-react";
import GlobalCatalog, { GlobalSong } from "@/components/GlobalCatalog";
import SetlistsView, { Setlist } from "@/components/SetlistsView";
import SetlistDetail from "@/components/SetlistDetail";
import SongViewer from "@/components/SongViewer";
import OwnerReview from "@/components/OwnerReview";
import ChurchSettings from "@/components/ChurchSettings";
import AddToSetlistDialog from "@/components/AddToSetlistDialog";
import ProfileDialog from "@/components/ProfileDialog";
import InstallPrompt from "@/components/InstallPrompt";
import ThemeChoiceDialog from "@/components/ThemeChoiceDialog";

type Tab = "catalog" | "lists" | "review" | "settings";

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const { isOwner: isAppOwner, isOwnerOrMod, isModerator } = useGlobalRole();
  const { memberships, current, setCurrent, refresh, loading: chLoading } = useChurch();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [tab, setTab] = useState<Tab>("catalog");
  const [openSetlist, setOpenSetlist] = useState<Setlist | null>(null);
  // Visor de catálogo. Es un estado SEPARADO del setlist abierto: garantiza que
  // ver una canción del catálogo nunca te lleve a la versión de una lista.
  const [viewingGlobal, setViewingGlobal] = useState<GlobalSong | null>(null);
  const [globalSiblings, setGlobalSiblings] = useState<GlobalSong[]>([]);
  const [addToList, setAddToList] = useState<GlobalSong | null>(null);
  const [newChurchOpen, setNewChurchOpen] = useState(false);
  const [newChurchName, setNewChurchName] = useState("");

  // Aceptar invitación de la URL si llega
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

  const [createdChurchId, setCreatedChurchId] = useState<string | null>(null);
  useEffect(() => {
    if (!user) { setCreatedChurchId(null); return; }
    supabase.from("churches").select("id").eq("created_by", user.id).maybeSingle()
      .then(({ data }) => setCreatedChurchId(data?.id ?? null));
  }, [user, memberships]);

  const createChurch = async () => {
    if (!user || !newChurchName.trim()) return;
    if (createdChurchId) {
      toast.error("Solo podés crear una iglesia. Eliminala desde su Configuración para crear otra.");
      return;
    }
    const { error } = await supabase.from("churches").insert({ name: newChurchName.trim(), created_by: user.id });
    if (error) {
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

  const canCreateChurch = !!user && !createdChurchId;

  if (authLoading || chLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando...</div>;
  }

  // Botón de configuración: lleva a la pestaña settings de la iglesia actual.
  // Si el usuario es admin: ChurchSettings; si solo es miembro, igual abrimos
  // ChurchSettings en modo lectura para que pueda salir desde ahí.
  const openChurchSettings = () => {
    if (!current) {
      toast.error("Primero seleccioná o creá una iglesia");
      return;
    }
    setOpenSetlist(null);
    setViewingGlobal(null);
    setTab("settings");
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-10 bg-background border-b">
        {/* Fila 1: título centrado y grande, con acciones en esquinas */}
        <div className="max-w-4xl mx-auto px-4 pt-3 pb-2 grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <div className="flex items-center gap-1">
            {isAppOwner && <Crown className="w-4 h-4 text-primary"><title>Dueño</title></Crown>}
            {isModerator && <Shield className="w-4 h-4 text-primary"><title>Moderador</title></Shield>}
          </div>
          <h1 className="text-center text-2xl sm:text-3xl font-extrabold tracking-tight">
            <span className="inline-flex items-center gap-2 justify-center">
              <Music className="w-5 h-5 text-primary" />
              The Heaven Chords
            </span>
          </h1>
          <div className="flex items-center gap-1 justify-end">
            {/* Engranaje único de configuración de iglesia */}
            {user && current && (
              <Button size="icon" variant="ghost" onClick={openChurchSettings} title="Configuración de iglesia">
                <Settings className="w-4 h-4" />
              </Button>
            )}
            {user ? (
              <ProfileDialog />
            ) : (
              <Button size="sm" variant="outline" onClick={() => navigate("/auth")}>
                <LogIn className="w-4 h-4 mr-1" /> Entrar
              </Button>
            )}
          </div>
        </div>

        {/* Fila 2: selector de iglesia + crear (solo logueados) */}
        {user && (
          <div className="max-w-4xl mx-auto px-4 pb-3 flex items-center gap-2 flex-wrap justify-center">
            {memberships.length > 0 ? (
              <Select value={current?.id ?? ""} onValueChange={(id) => {
                const m = memberships.find(x => x.id === id);
                if (m) { setCurrent(m); setOpenSetlist(null); setViewingGlobal(null); }
              }}>
                <SelectTrigger className="max-w-[220px]"><SelectValue placeholder="Iglesia" /></SelectTrigger>
                <SelectContent>
                  {memberships.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name} {m.role === "admin" && "👑"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-sm text-muted-foreground">Sin iglesia</span>
            )}

            <Dialog open={newChurchOpen} onOpenChange={setNewChurchOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost"
                  title={canCreateChurch ? "Nueva iglesia" : "Ya creaste una iglesia"}
                  disabled={!canCreateChurch}>
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
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {viewingGlobal ? (
          // Visor del CATÁLOGO. Independiente del visor de listas.
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
              {isOwnerOrMod && <TabsTrigger value="review">Revisión</TabsTrigger>}
              {current && (
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

            {isOwnerOrMod && (
              <TabsContent value="review"><OwnerReview /></TabsContent>
            )}

            {current && (
              <TabsContent value="settings">
                <ChurchSettings church={current} onBack={() => setTab("catalog")} />
              </TabsContent>
            )}
          </Tabs>
        )}

        {!user && (
          <Card className="mt-6 p-4 text-sm text-center text-muted-foreground">
            Estás navegando como invitado. <button className="text-primary underline" onClick={() => navigate("/auth")}>Iniciá sesión</button> para proponer canciones, crear listas e iglesias.
          </Card>
        )}
      </main>

      {current && (
        <AddToSetlistDialog church={current} song={addToList} onClose={() => setAddToList(null)} />
      )}

      <ThemeChoiceDialog />
      <InstallPrompt />
    </div>
  );
}
