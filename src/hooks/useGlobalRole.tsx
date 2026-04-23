import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

// Rol global del usuario en la APP (independiente del rol dentro de iglesias)
export type GlobalRole = "owner" | "moderator" | "user" | null;

export function useGlobalRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<GlobalRole>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) { setRole(null); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("user_global_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    setRole((data?.role as GlobalRole) ?? "user");
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user?.id]);

  return {
    role,
    loading,
    isOwner: role === "owner",
    isModerator: role === "moderator",
    isOwnerOrMod: role === "owner" || role === "moderator",
    refresh,
  };
}
