import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// El estado de "Dueño" se obtiene desde la base de datos (profiles.is_owner),
// nunca del email ni de constantes en el cliente.
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

  // Lee la bandera is_owner desde profiles cuando cambia el usuario.
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) { setIsOwner(false); return; }
    supabase.from("profiles").select("is_owner").eq("user_id", uid).maybeSingle()
      .then(({ data }) => setIsOwner(!!(data as any)?.is_owner));
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
