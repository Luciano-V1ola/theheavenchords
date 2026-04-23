import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

const ASKED_KEY = "ui.themeAsked";

// Pregunta al usuario su preferencia la primera vez que entra a la app.
export default function ThemeChoiceDialog() {
  const { setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const asked = localStorage.getItem(ASKED_KEY);
    if (!asked) setOpen(true);
  }, []);

  const choose = (t: "light" | "dark") => {
    setTheme(t);
    localStorage.setItem(ASKED_KEY, "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) localStorage.setItem(ASKED_KEY, "1"); setOpen(o); }}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader><DialogTitle>¿Cómo querés ver The Heaven Chords?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Podés cambiarlo después desde tu perfil.</p>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <Button variant="outline" className="h-20 flex-col gap-1" onClick={() => choose("light")}>
            <Sun className="w-5 h-5" /> Claro
          </Button>
          <Button variant="outline" className="h-20 flex-col gap-1" onClick={() => choose("dark")}>
            <Moon className="w-5 h-5" /> Oscuro
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
