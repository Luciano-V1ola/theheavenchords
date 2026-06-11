import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalRole } from "@/hooks/useGlobalRole";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, ShieldOff, Crown } from "lucide-react";
import { toast } from "sonner";

// Panel Global: gestión de moderadores de la app. Visible solo para el Dueño.
// Está separado de Iglesia para que la moderación global no se mezcle con la
// administración de cada iglesia.
export default function GlobalAdmin() {
  const { isOwner } = useGlobalRole();
  const [modEmail, setModEmail] = useState("");
  const [mods, setMods] = useState<{ user_id: string; display_name: string | null }[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!isOwner) return;
    setLoading(true);
    const { data } = await supabase
      .from("user_global_roles")
      .select("user_id")
      .eq("role", "moderator");
    const ids = (data ?? []).map((r: any) => r.user_id);
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);
      setMods((profs ?? []).map((p: any) => ({ user_id: p.user_id, display_name: p.display_name })));
    } else {
      setMods([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [isOwner]);

  if (!isOwner) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Solo el Dueño de la app puede acceder al panel global.
      </Card>
    );
  }

  const promote = async () => {
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
    const { error } = await supabase
      .from("user_global_roles")
      .upsert({ user_id: targetId as string, role: "moderator" }, { onConflict: "user_id" });
    if (error) return toast.error(error.message);
    toast.success("Moderador asignado");
    setModEmail("");
    load();
  };

  const demote = async (uid: string) => {
    const { error } = await supabase
      .from("user_global_roles")
      .update({ role: "user" })
      .eq("user_id", uid);
    if (error) return toast.error(error.message);
    toast.success("Moderador removido");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Crown className="w-5 h-5 text-primary" />
        <h2 className="font-bold text-xl">Panel Global</h2>
      </div>

      <Card className="p-6 space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4" /> Moderadores globales
        </h3>
        <p className="text-xs text-muted-foreground">
          Los moderadores pueden editar canciones del catálogo y enviarlas a Revisión, pero no eliminarlas definitivamente.
        </p>
        <div className="flex gap-2">
          <Input
            value={modEmail}
            onChange={(e) => setModEmail(e.target.value)}
            placeholder="email del usuario"
            type="email"
          />
          <Button onClick={promote}>Asignar</Button>
        </div>
        <div className="space-y-1">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : mods.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin moderadores asignados.</p>
          ) : (
            mods.map((m) => (
              <div
                key={m.user_id}
                className="flex items-center gap-2 text-sm border-b pb-1 last:border-0"
              >
                <span className="flex-1">{m.display_name || "Usuario"}</span>
                <Button size="sm" variant="outline" onClick={() => demote(m.user_id)}>
                  <ShieldOff className="w-3 h-3 mr-1" /> Quitar
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
