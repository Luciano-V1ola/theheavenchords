import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Pencil, Save, X } from "lucide-react";

// Canvas simple para dibujar/anotar sobre la partitura de una canción dentro de una lista.
// Guarda los trazos como JSON (array de paths con puntos x,y normalizados 0-1).
export type Stroke = { color: string; width: number; points: { x: number; y: number }[] };
export type Drawing = { strokes: Stroke[] };

type Props = {
  initial?: Drawing | null;
  onSave: (d: Drawing) => Promise<void> | void;
  onClose: () => void;
};

export default function DrawingCanvas({ initial, onSave, onClose }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>(initial?.strokes ?? []);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#ef4444");
  const [width, setWidth] = useState(3);
  const [size, setSize] = useState({ w: 600, h: 400 });

  // Ajusta canvas al ancho disponible (alto fijo)
  useEffect(() => {
    const update = () => {
      const w = wrapRef.current?.clientWidth ?? 600;
      setSize({ w, h: 420 });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Repinta cada vez que cambian los trazos o el tamaño
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
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
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = getPos(e);
    setStrokes(prev => [...prev, { color, width, points: [p] }]);
    setDrawing(true);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing) return;
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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Pencil className="w-4 h-4" />
        <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 rounded border" />
        <input type="range" min={1} max={10} value={width} onChange={e => setWidth(Number(e.target.value))} />
        <Button size="sm" variant="outline" onClick={() => setStrokes([])}>
          <Eraser className="w-4 h-4 mr-1" /> Borrar todo
        </Button>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={onClose}><X className="w-4 h-4 mr-1" /> Cerrar</Button>
        <Button size="sm" onClick={() => onSave({ strokes })}>
          <Save className="w-4 h-4 mr-1" /> Guardar dibujo
        </Button>
      </div>
      <div ref={wrapRef} className="border rounded-md bg-background touch-none">
        <canvas
          ref={canvasRef}
          width={size.w}
          height={size.h}
          style={{ width: "100%", height: size.h, display: "block" }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      </div>
      <p className="text-xs text-muted-foreground">El dibujo se guarda en la canción de la lista y lo ven todos los miembros de la iglesia.</p>
    </div>
  );
}
