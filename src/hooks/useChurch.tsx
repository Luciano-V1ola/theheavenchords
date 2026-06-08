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
  const userId = user?.id ?? null;
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [current, setCurrentState] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  // Marcamos si ya cargamos al menos una vez para este usuario. Así un
  // refresh manual no vuelve a poner toda la app en estado "Cargando...".
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setMemberships([]); setCurrentState(null);
      setLoading(false); setLoadedFor(null);
      return;
    }
    if (loadedFor !== userId) setLoading(true);
    const { data, error } = await supabase
      .from("church_members")
      .select("role, church:churches(id, name)")
      .eq("user_id", userId);
    if (error) { console.error(error); setLoading(false); return; }
    const list: Membership[] = (data ?? [])
      .filter((r: any) => r.church)
      .map((r: any) => ({ id: r.church.id, name: r.church.name, role: r.role }));
    setMemberships(list);
    setCurrentState((prev) => {
      if (prev && list.find(m => m.id === prev.id)) {
        // Mantener la iglesia seleccionada si sigue siendo válida
        const updated = list.find(m => m.id === prev.id)!;
        return updated;
      }
      const savedId = localStorage.getItem(STORAGE);
      return list.find(m => m.id === savedId) ?? list[0] ?? null;
    });
    setLoading(false);
    setLoadedFor(userId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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
