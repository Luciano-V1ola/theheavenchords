import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Estado mínimo de auth. El rol global ahora se obtiene de user_global_roles
// vía el hook useGlobalRole; mantenemos isOwner aquí para compatibilidad.
type Ctx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isOwner: boolean;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<Ctx>({ user: null, session: null, loading: true, isOwner: false, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Lee rol global desde la nueva tabla user_global_roles
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) { setIsOwner(false); return; }
    supabase.from("user_global_roles").select("role").eq("user_id", uid).maybeSingle()
      .then(({ data }) => setIsOwner((data as any)?.role === "owner"));
  }, [session?.user?.id]);

  const signOut = async () => { await supabase.auth.signOut(); };
  const user = session?.user ?? null;

  return (
    <AuthContext.Provider value={{ user, session, loading, isOwner, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
