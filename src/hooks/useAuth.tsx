import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Email del Dueño global (hardcoded). Coincide con la función SQL is_global_owner.
export const OWNER_EMAIL = "dva.lucho@gmail.com";

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

  const signOut = async () => { await supabase.auth.signOut(); };
  const user = session?.user ?? null;
  const isOwner = !!user?.email && user.email.toLowerCase() === OWNER_EMAIL;

  return (
    <AuthContext.Provider value={{ user, session, loading, isOwner, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
