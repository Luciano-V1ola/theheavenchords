import { useEffect } from "react";

/**
 * Empuja una entrada en el historial cuando `active` se activa, y la quita
 * cuando se desactiva. Si el usuario presiona "Atrás" del navegador/Android
 * estando activa, ejecuta `onBack` (típicamente cerrar el modo/pantalla)
 * sin salir de la app.
 *
 * Esto hace que la flecha Atrás de Android funcione como en una app nativa:
 * cierra el overlay/pantalla actual en vez de cerrar la PWA.
 */
export function useHistoryBack(active: boolean, onBack: () => void) {
  useEffect(() => {
    if (!active) return;

    // Marca esta capa con un sentinel único en el history.state.
    const id = `__back_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const prevState = window.history.state;
    window.history.pushState({ ...(prevState || {}), __back: id }, "");

    const onPop = () => {
      // El usuario presionó Atrás: ya consumió nuestra entrada del history.
      onBack();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      // Si la capa se cerró por UI (no por Atrás), nuestra entrada sentinel
      // sigue en el tope del history: la removemos para no dejar basura.
      if (window.history.state && (window.history.state as any).__back === id) {
        window.history.back();
      }
    };
  }, [active, onBack]);
}
