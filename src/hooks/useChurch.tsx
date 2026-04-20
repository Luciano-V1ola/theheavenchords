import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

// Modelo de iglesia que el usuario tiene seleccionada
export type Church = { id: string; name: string };
export type Membership = Church & { role: "admin" | "member" };

type Ctx = {
  memberships: Membership[];
  current: Membership | null;
  setCurrent: (m: Membership | null) => void;
  refresh: () => Promise<void>;
  loading: boolean;
};
const ChurchContext = createContext<Ctx>({} as Ctx);
const STORAGE = "current_church_id";

export function ChurchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [current, setCurrentState] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setMemberships([]); setCurrentState(null); setLoading(false); return; }
    setLoading(true);
    // Traemos los memberships del usuario y el nombre de la iglesia
    const { data, error } = await supabase
      .from("church_members")
      .select("role, church:churches(id, name)")
      .eq("user_id", user.id);
    if (error) { console.error(error); setLoading(false); return; }
    const list: Membership[] = (data ?? [])
      .filter((r: any) => r.church)
      .map((r: any) => ({ id: r.church.id, name: r.church.name, role: r.role }));
    setMemberships(list);
    // Restaura la iglesia seleccionada o usa la primera
    const savedId = localStorage.getItem(STORAGE);
    const found = list.find(m => m.id === savedId) ?? list[0] ?? null;
    setCurrentState(found);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const setCurrent = (m: Membership | null) => {
    setCurrentState(m);
    if (m) localStorage.setItem(STORAGE, m.id);
    else localStorage.removeItem(STORAGE);
  };

  return (
    <ChurchContext.Provider value={{ memberships, current, setCurrent, refresh, loading }}>
      {children}
    </ChurchContext.Provider>
  );
}

export const useChurch = () => useContext(ChurchContext);
