import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

// Hook simple para gestionar la lista de canciones favoritas del usuario actual.
// Mantiene un Set con los IDs y expone toggle/isFavorite.
export function useFavorites() {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) { setIds(new Set()); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("user_favorites")
      .select("global_song_id")
      .eq("user_id", user.id);
    if (!error) setIds(new Set((data ?? []).map((r: any) => r.global_song_id)));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = useCallback(async (songId: string) => {
    if (!user) { toast.error("Iniciá sesión para usar favoritos"); return; }
    const isFav = ids.has(songId);
    // Optimista
    setIds(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(songId); else next.add(songId);
      return next;
    });
    if (isFav) {
      const { error } = await supabase.from("user_favorites").delete()
        .eq("user_id", user.id).eq("global_song_id", songId);
      if (error) { toast.error(friendlyError(error)); refresh(); }
      else toast.success("Quitada de favoritos");
    } else {
      const { error } = await supabase.from("user_favorites")
        .insert({ user_id: user.id, global_song_id: songId } as any);
      if (error) { toast.error(friendlyError(error)); refresh(); }
      else toast.success("⭐ Agregada a favoritos");
    }
  }, [ids, user?.id, refresh]);

  return { ids, isFavorite: (id: string) => ids.has(id), toggle, loading, refresh };
}
