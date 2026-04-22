import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { User, LogOut, Sun, Moon } from "lucide-react";
import { toast } from "sonner";

// Permite a cada usuario editar nombre, email, contraseña y cerrar sesión
export default function ProfileDialog() {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [email, setEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    if (!user || !open) return;
    setEmail(user.email ?? "");
    supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setName(data?.display_name ?? ""));
  }, [user, open]);

  const saveName = async () => {
    if (!user) return;
    setSavingName(true);
    const { error } = await supabase.from("profiles")
      .upsert({ user_id: user.id, display_name: name.trim() || null }, { onConflict: "user_id" });
    setSavingName(false);
    if (error) toast.error(error.message);
    else toast.success("Nombre guardado");
  };

  const saveEmail = async () => {
    if (!email.trim()) return;
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setSavingEmail(false);
    if (error) toast.error(error.message);
    else toast.success("Te enviamos un email para confirmar el cambio");
  };

  const savePassword = async () => {
    if (password.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
    if (password !== password2) { toast.error("Las contraseñas no coinciden"); return; }
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPwd(false);
    if (error) toast.error(error.message);
    else { toast.success("Contraseña actualizada"); setPassword(""); setPassword2(""); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" title="Mi perfil"><User className="w-4 h-4" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Mi cuenta</DialogTitle></DialogHeader>

        <Tabs defaultValue="name" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="name">Nombre</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="password">Clave</TabsTrigger>
          </TabsList>

          <TabsContent value="name" className="space-y-2">
            <Label>Nombre visible</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Lucho" />
            <p className="text-xs text-muted-foreground">Se muestra como "Colaborador: {name || "tu nombre"}" dentro de cada canción.</p>
            <Button onClick={saveName} disabled={savingName} className="w-full">{savingName ? "..." : "Guardar nombre"}</Button>
          </TabsContent>

          <TabsContent value="email" className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
            <p className="text-xs text-muted-foreground">Te llegará un correo de confirmación para validar el cambio.</p>
            <Button onClick={saveEmail} disabled={savingEmail || !email.trim()} className="w-full">
              {savingEmail ? "..." : "Cambiar email"}
            </Button>
          </TabsContent>

          <TabsContent value="password" className="space-y-2">
            <Label>Nueva contraseña</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} />
            <Label>Repetir</Label>
            <Input type="password" value={password2} onChange={e => setPassword2(e.target.value)} />
            <Button onClick={savePassword} disabled={savingPwd} className="w-full">
              {savingPwd ? "..." : "Cambiar contraseña"}
            </Button>
          </TabsContent>
        </Tabs>

        <Separator />

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={toggle} className="flex-1">
            {theme === "dark" ? <><Sun className="w-4 h-4 mr-1" /> Modo claro</> : <><Moon className="w-4 h-4 mr-1" /> Modo oscuro</>}
          </Button>
          <Button variant="destructive" onClick={() => { setOpen(false); signOut(); }} className="flex-1">
            <LogOut className="w-4 h-4 mr-1" /> Salir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
