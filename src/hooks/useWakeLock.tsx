import { useEffect } from "react";

/**
 * Mantiene la pantalla encendida mientras `active` sea true.
 * Usa la Wake Lock API cuando está disponible (Android Chrome, etc.).
 * Re-adquiere el lock automáticamente si el usuario vuelve a la pestaña.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let sentinel: any = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        sentinel = await (navigator as any).wakeLock.request("screen");
      } catch {
        // Silencioso: puede fallar si la pestaña no está visible o el navegador lo deniega.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !cancelled && active) acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      try { sentinel?.release?.(); } catch { /* noop */ }
      sentinel = null;
    };
  }, [active]);
}
