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
import { ArrowLeft, Trash2, UserPlus, LogOut, Shield, ShieldOff, Crown, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Membership } from "@/hooks/useChurch";
import { SITE_URL } from "@/lib/site";
import ShareMenu from "./ShareMenu";

type Member = { id: string; user_id: string; role: "admin" | "member"; display_name?: string | null };
type Invitation = { id: string; email: string; role: "admin" | "member"; token: string; accepted_at: string | null };

// Ajustes de iglesia: invitar miembros, salir/eliminar la iglesia, y (solo dueño global) gestionar moderadores globales.
export default function ChurchSettings({ church, onBack }: { church: Membership; onBack: () => void }) {
  const { user } = useAuth();
  const { refresh: refreshChurches } = useChurch();
  const { isOwner: isAppOwner } = useGlobalRole();

  // Solo los administradores de ESTA iglesia pueden invitar, expulsar, cambiar roles
  // o ver invitaciones pendientes. El backend (RLS) ya lo refuerza; aquí ocultamos la UI.
  const isChurchAdmin = church.role === "admin";

  const [members, setMembers] = useState<Member[]>([]);
  const [invs, setInvs] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [sending, setSending] = useState(false);

  const [createdChurchId, setCreatedChurchId] = useState<string | null>(null);
  const [modEmail, setModEmail] = useState("");
  const [mods, setMods] = useState<{ user_id: string; display_name: string | null }[]>([]);

  const load = async () => {
    if (!user) return;
    const memQ = supabase.from("church_members").select("id, user_id, role").eq("church_id", church.id);
    const chQ = supabase.from("churches").select("id").eq("created_by", user.id).maybeSingle();
    // Solo los admins pueden listar invitaciones (RLS lo bloquea para members).
    const invQ = isChurchAdmin
      ? supabase.from("invitations").select("id, email, role, token, accepted_at").eq("church_id", church.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Invitation[] } as any);

    const [{ data: ms }, { data: ins }, { data: ch }] = await Promise.all([memQ, invQ, chQ]);

    const rows = (ms ?? []) as Member[];
    // Resolver display_name desde profiles para evitar mostrar IDs internos.
    if (rows.length) {
      const ids = rows.map(r => r.user_id);
      const { data: profs } = await supabase.from("profiles").select("user_id, display_name").in("user_id", ids);
      const map = new Map((profs ?? []).map(p => [p.user_id, p.display_name as string | null]));
      rows.forEach(r => { r.display_name = map.get(r.user_id) ?? null; });
    }
    setMembers(rows);
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

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [church.id, isAppOwner, isChurchAdmin]);

  const invite = async () => {
    if (!isChurchAdmin) { toast.error("Solo los administradores pueden invitar"); return; }
    if (!email.trim() || !user) return;
    setSending(true);
    const { data, error } = await supabase
      .from("invitations")
      .insert({ church_id: church.id, email: email.trim().toLowerCase(), role, invited_by: user.id })
      .select("token").single();
    setSending(false);
    if (error) { toast.error(error.message); return; }
    const link = `${SITE_URL}/auth?invite=${data.token}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    toast.success("Invitación creada y enlace copiado");
    setEmail("");
    load();
  };

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(`${SITE_URL}/auth?invite=${token}`);
    toast.success("Enlace copiado");
  };

  const cancelInv = async (id: string) => {
    if (!isChurchAdmin) return;
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Cancelada"); load(); }
  };
  const removeMember = async (id: string) => {
    if (!isChurchAdmin) { toast.error("Solo los administradores pueden expulsar"); return; }
    const { error } = await supabase.from("church_members").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Eliminado"); load(); }
  };
  const changeRole = async (id: string, newRole: "admin" | "member") => {
    if (!isChurchAdmin) { toast.error("Solo los administradores pueden cambiar roles"); return; }
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
    if (!targetId) { toast.error("No encontramos un usuario registrado con ese email."); return; }
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

  const memberLabel = (m: Member) => {
    if (m.user_id === user?.id) return "Tú";
    return m.display_name?.trim() || "Usuario";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Volver</Button>
        <h2 className="font-bold text-xl">{church.name} · Configuración</h2>
        {isChurchAdmin && <span className="ml-auto text-xs inline-flex items-center gap-1 text-primary"><Crown className="w-3 h-3" /> Admin</span>}
      </div>

      {/* Invitar — solo admins */}
      {isChurchAdmin && (
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><UserPlus className="w-4 h-4" /> Invitar miembro</h3>
          <p className="text-sm text-muted-foreground">
            Se genera un enlace de invitación. Cuando la persona se registre con ese email entrará a esta iglesia.
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
      )}

      {/* Invitaciones pendientes — solo admins */}
      {isChurchAdmin && (
        <Card className="p-6 space-y-3">
          <h3 className="font-semibold">Invitaciones pendientes</h3>
          {invs.filter(i => !i.accepted_at).length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay invitaciones pendientes.</p>
          ) : invs.filter(i => !i.accepted_at).map(i => (
            <div key={i.id} className="flex items-center gap-2 flex-wrap text-sm border-b pb-2 last:border-0">
              <span className="flex-1 break-all">{i.email} <span className="text-muted-foreground">({i.role})</span></span>
              <Button size="sm" variant="outline" onClick={() => copyLink(i.token)}><Copy className="w-3 h-3 mr-1" /> Enlace</Button>
              <Button size="sm" variant="destructive" onClick={() => cancelInv(i.id)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
        </Card>
      )}

      {/* Miembros — visible para todos, pero acciones solo para admins */}
      <Card className="p-6 space-y-3">
        <h3 className="font-semibold">Miembros ({members.length})</h3>
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-2 flex-wrap text-sm border-b pb-2 last:border-0">
            <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs">
              {m.role === "admin" ? <Crown className="w-3.5 h-3.5 text-primary" /> : <UserIcon className="w-3.5 h-3.5" />}
            </span>
            <span className="flex-1 truncate">
              {memberLabel(m)}
              <span className="ml-2 text-xs text-muted-foreground">{m.role === "admin" ? "Admin" : "Miembro"}</span>
            </span>

            {isChurchAdmin ? (
              <>
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
              </>
            ) : null}
          </div>
        ))}
        {!isChurchAdmin && (
          <p className="text-xs text-muted-foreground pt-2">
            Solo los administradores de la iglesia pueden invitar, cambiar roles o expulsar miembros.
          </p>
        )}
      </Card>

      {/* La gestión de moderadores globales se trasladó al Panel Global. */}

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
