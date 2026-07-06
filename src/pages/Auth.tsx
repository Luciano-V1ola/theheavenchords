import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Music, Check, Circle } from "lucide-react";
import { SITE_URL } from "@/lib/site";

// Validación visual de contraseña (solo aplica en registro)
function getPasswordChecks(pw: string) {
  return [
    { label: "Mínimo 8 caracteres", ok: pw.length >= 8 },
    { label: "Una letra mayúscula", ok: /[A-Z]/.test(pw) },
    { label: "Una letra minúscula", ok: /[a-z]/.test(pw) },
    { label: "Un número", ok: /\d/.test(pw) },
    { label: "Un símbolo especial (@ # $ % ! ? * etc.)", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
}

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
  const [confirmSent, setConfirmSent] = useState<string | null>(null);

  const pwChecks = useMemo(() => getPasswordChecks(password), [password]);
  const pwValid = pwChecks.every(c => c.ok);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!displayName.trim()) { toast.error("El nombre de usuario es obligatorio"); setLoading(false); return; }
        if (!pwValid) { toast.error("La contraseña no cumple los requisitos"); setLoading(false); return; }
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${SITE_URL}/${inviteToken ? `?invite=${inviteToken}` : ""}`,
            data: { display_name: displayName.trim() },
          }
        });
        if (error) throw error;
        // Si no hay sesión activa, Supabase exige confirmar el email.
        if (!data.session) {
          setConfirmSent(email);
          toast.success("Te enviamos un email para confirmar tu cuenta");
          setLoading(false);
          return;
        }
        toast.success("Cuenta creada");
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

        {confirmSent && (
          <div className="rounded-md border border-primary/30 bg-primary/10 p-4 text-sm space-y-2">
            <p className="font-semibold">📧 Confirma tu email</p>
            <p className="text-muted-foreground">
              Te enviamos un enlace de confirmación a <b>{confirmSent}</b>. Abrílo desde tu correo
              para activar la cuenta y poder iniciar sesión.
            </p>
            <p className="text-xs text-muted-foreground">
              Revisá la carpeta de spam si no lo encontrás.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={async () => {
              try {
                const result = await lovable.auth.signInWithOAuth("google", {
                  redirect_uri: window.location.origin,
                });
                if (result.error) { toast.error("No se pudo iniciar con Google"); return; }
                if (result.redirected) return;
                if (inviteToken) {
                  const { error } = await supabase.rpc("accept_invitation", { _token: inviteToken });
                  if (error) toast.error("No se pudo aceptar la invitación: " + error.message);
                  else toast.success("¡Te uniste a la iglesia!");
                }
                navigate("/");
              } catch (e: any) {
                toast.error(e?.message ?? "Error");
              }
            }}
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"/>
            </svg>
            {mode === "signup" ? "Crear cuenta con Google" : "Continuar con Google"}
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-px bg-border flex-1" /> o con email <div className="h-px bg-border flex-1" />
          </div>
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
            <Input id="password" type="password" required minLength={mode === "signup" ? 8 : 6} value={password} onChange={e => setPassword(e.target.value)} />
            {mode === "signup" && (
              <div className="mt-2 rounded-md border bg-muted/40 p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  La contraseña debe cumplir los siguientes requisitos:
                </p>
                <ul className="space-y-1">
                  {pwChecks.map((c, i) => (
                    <li key={i} className={`flex items-center gap-2 text-xs ${c.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                      {c.ok ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                      <span>{c.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={loading || (mode === "signup" && !pwValid)}>
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
