import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User } from "lucide-react";
import { toast } from "sonner";

// Permite a cada usuario editar su nombre de colaborador
export default function ProfileDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !open) return;
    supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setName(data?.display_name ?? ""));
  }, [user, open]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles")
      .upsert({ user_id: user.id, display_name: name.trim() || null }, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Nombre guardado"); setOpen(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" title="Mi perfil"><User className="w-4 h-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Mi nombre de colaborador</DialogTitle></DialogHeader>
        <Label>Nombre visible</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Lucho" />
        <p className="text-xs text-muted-foreground">Aparecerá como "Colaborador: {name || "tu nombre"}" en las canciones que subas.</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "..." : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
