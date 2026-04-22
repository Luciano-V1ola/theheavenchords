import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

// Captura el evento beforeinstallprompt y ofrece instalar la PWA
type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa.installDismissed";

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Si ya está instalada (standalone), no mostrar nada
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS
      (window.navigator as any).standalone === true;
    if (standalone) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setVisible(false));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible || !deferred) return null;

  const install = async () => {
    await deferred.prompt();
    await deferred.userChoice;
    setVisible(false);
    setDeferred(null);
  };
  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-lg border bg-background shadow-lg p-3 flex items-center gap-2">
      <Download className="w-4 h-4 text-primary shrink-0" />
      <div className="text-sm flex-1">Instalar la app en tu dispositivo</div>
      <Button size="sm" onClick={install}>Instalar</Button>
      <Button size="icon" variant="ghost" onClick={dismiss} aria-label="Cerrar">
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
