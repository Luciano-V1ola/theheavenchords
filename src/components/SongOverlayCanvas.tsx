import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Save, X, Pencil } from "lucide-react";
import type { Drawing, Stroke } from "./DrawingCanvas";

// Capa de dibujo transparente que se superpone exactamente sobre el contenedor
// de la partitura. Permite remarcar acordes/notas mientras se sigue viendo la canción.
type Props = {
  containerRef: React.RefObject<HTMLElement>;
  initial?: Drawing | null;
  active: boolean;                  // true = capta puntero (modo dibujo)
  onSave: (d: Drawing) => Promise<void> | void;
  onExit: () => void;               // salir del modo dibujo (no guarda)
};

export default function SongOverlayCanvas({ containerRef, initial, active, onSave, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>(initial?.strokes ?? []);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#ef4444");
  const [width, setWidth] = useState(3);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Sincroniza el tamaño del canvas con el del contenedor (incluye scroll interno)
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const update = () => setSize({ w: el.scrollWidth, h: el.scrollHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => { ro.disconnect(); window.removeEventListener("resize", update); };
  }, [containerRef]);

  // Recarga trazos si cambia la canción / dibujo inicial
  useEffect(() => { setStrokes(initial?.strokes ?? []); }, [initial]);

  // Repinta
  useEffect(() => {
    const c = canvasRef.current; if (!c || !size.w || !size.h) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const s of strokes) {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width;
      ctx.beginPath();
      s.points.forEach((p, i) => {
        const x = p.x * c.width, y = p.y * c.height;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }, [strokes, size]);

  const getPos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const onDown = (e: React.PointerEvent) => {
    if (!active) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = getPos(e);
    setStrokes(prev => [...prev, { color, width, points: [p] }]);
    setDrawing(true);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!active || !drawing) return;
    const p = getPos(e);
    setStrokes(prev => {
      const copy = prev.slice();
      const last = copy[copy.length - 1];
      copy[copy.length - 1] = { ...last, points: [...last.points, p] };
      return copy;
    });
  };
  const onUp = () => setDrawing(false);

  return (
    <>
      {/* Capa del canvas, posicionada absolute sobre el contenedor padre (que debe ser relative) */}
      <canvas
        ref={canvasRef}
        width={size.w}
        height={size.h}
        className="absolute inset-0"
        style={{
          width: size.w,
          height: size.h,
          pointerEvents: active ? "auto" : "none",
          touchAction: active ? "none" : "auto",
          cursor: active ? "crosshair" : "default",
          zIndex: 5,
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />

      {/* Barra flotante de herramientas, solo visible en modo dibujo */}
      {active && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-full shadow-lg px-3 py-2 flex items-center gap-2 flex-wrap max-w-[95vw]">
          <Pencil className="w-4 h-4" />
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 rounded border" />
          <input type="range" min={1} max={10} value={width} onChange={e => setWidth(Number(e.target.value))} className="w-24" />
          <Button size="sm" variant="outline" onClick={() => setStrokes([])}>
            <Eraser className="w-4 h-4 mr-1" /> Borrar
          </Button>
          <Button size="sm" variant="outline" onClick={onExit}>
            <X className="w-4 h-4 mr-1" /> Salir
          </Button>
          <Button size="sm" onClick={() => onSave({ strokes })}>
            <Save className="w-4 h-4 mr-1" /> Guardar
          </Button>
        </div>
      )}
    </>
  );
}
