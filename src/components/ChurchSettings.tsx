import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Copy, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Membership } from "@/hooks/useChurch";

type Member = { id: string; user_id: string; role: "admin" | "member" };
type Invitation = { id: string; email: string; role: "admin" | "member"; token: string; accepted_at: string | null };

// Ajustes de iglesia: ver miembros e invitar por email (solo admins)
export default function ChurchSettings({ church, onBack }: { church: Membership; onBack: () => void }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invs, setInvs] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [sending, setSending] = useState(false);

  const load = async () => {
    const [{ data: ms }, { data: ins }] = await Promise.all([
      supabase.from("church_members").select("id, user_id, role").eq("church_id", church.id),
      supabase.from("invitations").select("id, email, role, token, accepted_at").eq("church_id", church.id).order("created_at", { ascending: false }),
    ]);
    setMembers((ms ?? []) as Member[]);
    setInvs((ins ?? []) as Invitation[]);
  };

  useEffect(() => { load(); }, [church.id]);

  const invite = async () => {
    if (!email.trim() || !user) return;
    setSending(true);
    const { data, error } = await supabase
      .from("invitations")
      .insert({ church_id: church.id, email: email.trim().toLowerCase(), role, invited_by: user.id })
      .select("token")
      .single();
    setSending(false);
    if (error) { toast.error(error.message); return; }
    // Construye link de invitación; el admin lo comparte con el invitado por su medio preferido
    const link = `${window.location.origin}/auth?invite=${data.token}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    toast.success("Invitación creada y enlace copiado al portapapeles");
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Volver</Button>
        <h2 className="font-bold text-xl">{church.name} · Ajustes</h2>
      </div>

      <Card className="p-6 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><UserPlus className="w-4 h-4" /> Invitar miembro</h3>
        <p className="text-sm text-muted-foreground">
          Crea una invitación para un email específico. Compártele el enlace que se copia al portapapeles. Cuando se registre con ese email, entrará automáticamente a esta iglesia.
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
    </div>
  );
}
