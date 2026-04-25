import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useChurch } from "@/hooks/useChurch";
import { useGlobalRole } from "@/hooks/useGlobalRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Copy, Trash2, UserPlus, LogOut, Shield, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Membership } from "@/hooks/useChurch";

type Member = { id: string; user_id: string; role: "admin" | "member" };
type Invitation = { id: string; email: string; role: "admin" | "member"; token: string; accepted_at: string | null };

// Ajustes de iglesia: invitar miembros, salir/eliminar la iglesia, y (solo dueño global) gestionar moderadores globales.
export default function ChurchSettings({ church, onBack }: { church: Membership; onBack: () => void }) {
  const { user } = useAuth();
  const { refresh: refreshChurches } = useChurch();
  const { isOwner: isAppOwner } = useGlobalRole();
  const [members, setMembers] = useState<Member[]>([]);
  const [invs, setInvs] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [sending, setSending] = useState(false);

  const [createdChurchId, setCreatedChurchId] = useState<string | null>(null);
  const [modEmail, setModEmail] = useState("");
  const [mods, setMods] = useState<{ user_id: string; display_name: string | null; email?: string }[]>([]);

  const load = async () => {
    if (!user) return;
    const [{ data: ms }, { data: ins }, { data: ch }] = await Promise.all([
      supabase.from("church_members").select("id, user_id, role").eq("church_id", church.id),
      supabase.from("invitations").select("id, email, role, token, accepted_at").eq("church_id", church.id).order("created_at", { ascending: false }),
      supabase.from("churches").select("id").eq("created_by", user.id).maybeSingle(),
    ]);
    setMembers((ms ?? []) as Member[]);
    setInvs((ins ?? []) as Invitation[]);
    setCreatedChurchId(ch?.id ?? null);

    if (isAppOwner) {
      const { data } = await supabase.from("user_global_roles")
        .select("user_id").eq("role", "moderator");
      const ids = (data ?? []).map(r => r.user_id);
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles")
          .select("user_id, display_name").in("user_id", ids);
        setMods((profs ?? []).map(p => ({ user_id: p.user_id, display_name: p.display_name })));
      } else setMods([]);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [church.id, isAppOwner]);

  const invite = async () => {
    if (!email.trim() || !user) return;
    setSending(true);
    const { data, error } = await supabase
      .from("invitations")
      .insert({ church_id: church.id, email: email.trim().toLowerCase(), role, invited_by: user.id })
      .select("token").single();
    setSending(false);
    if (error) { toast.error(error.message); return; }
    const link = `${window.location.origin}/auth?invite=${data.token}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    toast.success("Invitación creada y enlace copiado");
    setEmail("");
    load();
  };

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/auth?invite=${token}`);
    toast.success("Enlace copiado");
  };
  const cancelInv = async (id: string) => {
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Cancelada"); load(); }
  };
  const removeMember = async (id: string) => {
    const { error } = await supabase.from("church_members").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Eliminado"); load(); }
  };
  const changeRole = async (id: string, newRole: "admin" | "member") => {
    const { error } = await supabase.from("church_members").update({ role: newRole }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Rol actualizado"); load(); }
  };

  const isCreatorOfCurrent = createdChurchId === church.id;

  const leaveChurch = async () => {
    if (!user) return;
    const { error } = await supabase.from("church_members")
      .delete().eq("church_id", church.id).eq("user_id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Saliste de la iglesia");
    await refreshChurches();
    onBack();
  };

  const deleteMyChurch = async () => {
    const { error } = await supabase.from("churches").delete().eq("id", church.id);
    if (error) return toast.error(error.message);
    toast.success("Iglesia eliminada");
    await refreshChurches();
    onBack();
  };

  // Gestión de moderadores globales (solo Dueño de la app)
  const promoteModerator = async () => {
    const email = modEmail.trim().toLowerCase();
    if (!email) return;
    const { data: targetId, error: rpcErr } = await supabase.rpc(
      "resolve_user_id_by_email" as any,
      { _email: email }
    );
    if (rpcErr) return toast.error(rpcErr.message);
    if (!targetId) {
      toast.error("No encontramos un usuario registrado con ese email.");
      return;
    }
    const { error } = await supabase.from("user_global_roles")
      .upsert({ user_id: targetId as string, role: "moderator" }, { onConflict: "user_id" });
    if (error) return toast.error(error.message);
    toast.success("Moderador asignado");
    setModEmail(""); load();
  };

  const demoteModerator = async (uid: string) => {
    const { error } = await supabase.from("user_global_roles")
      .update({ role: "user" }).eq("user_id", uid);
    if (error) return toast.error(error.message);
    toast.success("Moderador removido"); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Volver</Button>
        <h2 className="font-bold text-xl">{church.name} · Configuración</h2>
      </div>

      {/* Invitar */}
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><UserPlus className="w-4 h-4" /> Invitar miembro</h3>
        <p className="text-sm text-muted-foreground">
          Compartile el enlace que se copia al portapapeles. Cuando se registre con ese email entrará a esta iglesia.
        </p>
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2">
          <div>
            <Label className="text-xs">Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="persona@iglesia.com" />
          </div>
          <div>
            <Label className="text-xs">Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Miembro</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={invite} disabled={sending || !email.trim()}>Invitar</Button>
          </div>
        </div>
      </Card>

      {/* Invitaciones pendientes */}
      <Card className="p-6 space-y-3">
        <h3 className="font-semibold">Invitaciones pendientes</h3>
        {invs.filter(i => !i.accepted_at).length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay invitaciones pendientes.</p>
        ) : invs.filter(i => !i.accepted_at).map(i => (
          <div key={i.id} className="flex items-center gap-2 flex-wrap text-sm border-b pb-2 last:border-0">
            <span className="flex-1">{i.email} <span className="text-muted-foreground">({i.role})</span></span>
            <Button size="sm" variant="outline" onClick={() => copyLink(i.token)}><Copy className="w-3 h-3 mr-1" /> Enlace</Button>
            <Button size="sm" variant="destructive" onClick={() => cancelInv(i.id)}><Trash2 className="w-3 h-3" /></Button>
          </div>
        ))}
      </Card>

      {/* Miembros */}
      <Card className="p-6 space-y-3">
        <h3 className="font-semibold">Miembros ({members.length})</h3>
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-2 flex-wrap text-sm border-b pb-2 last:border-0">
            <span className="flex-1 font-mono text-xs">{m.user_id === user?.id ? "Tú" : m.user_id.slice(0, 8) + "..."}</span>
            <Select value={m.role} onValueChange={(v) => changeRole(m.id, v as any)} disabled={m.user_id === user?.id}>
              <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Miembro</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            {m.user_id !== user?.id && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive"><Trash2 className="w-3 h-3" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar miembro?</AlertDialogTitle>
                    <AlertDialogDescription>Perderá acceso a las canciones de esta iglesia.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => removeMember(m.id)}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        ))}
      </Card>

      {/* Moderadores globales (solo Dueño de la app) */}
      {isAppOwner && (
        <Card className="p-6 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><Shield className="w-4 h-4" /> Moderadores globales (app)</h3>
          <p className="text-xs text-muted-foreground">
            Los moderadores pueden editar y enviar canciones del catálogo a Revisión, pero no eliminarlas definitivamente.
          </p>
          <div className="flex gap-2">
            <Input value={modEmail} onChange={e => setModEmail(e.target.value)} placeholder="Nombre de usuario o email" />
            <Button onClick={promoteModerator}>Asignar</Button>
          </div>
          <div className="space-y-1">
            {mods.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin moderadores asignados.</p>
            ) : mods.map(m => (
              <div key={m.user_id} className="flex items-center gap-2 text-sm border-b pb-1 last:border-0">
                <span className="flex-1">{m.display_name || m.user_id.slice(0, 8) + "..."}</span>
                <Button size="sm" variant="outline" onClick={() => demoteModerator(m.user_id)}>
                  <ShieldOff className="w-3 h-3 mr-1" /> Quitar
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Acciones destructivas: salir o eliminar iglesia */}
      <Card className="p-6 space-y-3 border-destructive/30">
        <h3 className="font-semibold text-destructive">Zona peligrosa</h3>
        {isCreatorOfCurrent ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full sm:w-auto">
                <Trash2 className="w-4 h-4 mr-1" /> Eliminar esta iglesia
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar "{church.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se borran sus listas, miembros e invitaciones. El catálogo global no se ve afectado. No se puede deshacer.
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
              <Button variant="destructive" className="w-full sm:w-auto">
                <LogOut className="w-4 h-4 mr-1" /> Salir de esta iglesia
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Salir de "{church.name}"?</AlertDialogTitle>
                <AlertDialogDescription>Perderás acceso a sus listas. Podrás volver si te invitan otra vez.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={leaveChurch}>Salir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </Card>
    </div>
  );
}
