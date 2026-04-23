import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Music } from "lucide-react";

// Página de login y registro
export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inviteToken = params.get("invite");
  const [mode, setMode] = useState<"login" | "signup">(inviteToken ? "signup" : "login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!displayName.trim()) { toast.error("El nombre de usuario es obligatorio"); setLoading(false); return; }
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/${inviteToken ? `?invite=${inviteToken}` : ""}`,
            data: { display_name: displayName.trim() },
          }
        });
        if (error) throw error;
        toast.success("Cuenta creada. Revisa tu email si se requiere confirmación.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      if (inviteToken) {
        const { error } = await supabase.rpc("accept_invitation", { _token: inviteToken });
        if (error) toast.error("No se pudo aceptar la invitación: " + error.message);
        else toast.success("¡Te uniste a la iglesia!");
      }
      navigate("/");
    } catch (err: any) {
      toast.error(err.message ?? "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
            <Music className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">The Heaven Chords</h1>
          <p className="text-sm text-muted-foreground">
            {inviteToken ? "Crea tu cuenta para unirte a la iglesia" : "Repertorio compartido para tu iglesia"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <Label htmlFor="displayName">Nombre de usuario *</Label>
              <Input
                id="displayName"
                required
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Lucho"
                maxLength={50}
              />
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "..." : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </Button>
        </form>

        <div className="text-center text-sm space-y-2">
          {mode === "login" ? (
            <button onClick={() => setMode("signup")} className="text-primary hover:underline">
              ¿No tienes cuenta? Regístrate
            </button>
          ) : (
            <button onClick={() => setMode("login")} className="text-primary hover:underline">
              ¿Ya tienes cuenta? Inicia sesión
            </button>
          )}
          <div>
            <button onClick={() => navigate("/")} className="text-xs text-muted-foreground hover:underline">
              Entrar como invitado (solo lectura)
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
