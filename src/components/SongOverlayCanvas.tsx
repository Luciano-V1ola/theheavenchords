import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Save, X, Pencil, Undo2, Redo2 } from "lucide-react";
import type { Drawing, Stroke } from "./DrawingCanvas";

// Capa de dibujo transparente que se superpone exactamente sobre el contenedor
// de la partitura. Permite remarcar acordes/notas mientras se sigue viendo la canción.
type Tool = "pen" | "eraser";

type Props = {
  containerRef: React.RefObject<HTMLElement>;
  initial?: Drawing | null;
  active: boolean;                  // true = capta puntero (modo dibujo)
  onSave: (d: Drawing) => Promise<void> | void;
  onExit: () => void;               // salir del modo dibujo (no guarda)
};

// Distancia de un punto P al segmento AB (en unidades 0-1)
function distPointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export default function SongOverlayCanvas({ containerRef, initial, active, onSave, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>(initial?.strokes ?? []);
  // Pila de "rehacer" — se vacía al hacer un nuevo trazo/borrado
  const [redoStack, setRedoStack] = useState<Stroke[][]>([]);
  const [drawing, setDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#ef4444");
  const [width, setWidth] = useState(3);
  const [eraserSize, setEraserSize] = useState(20); // px
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
  useEffect(() => { setStrokes(initial?.strokes ?? []); setRedoStack([]); }, [initial]);

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

  // Borra los trazos cuyos segmentos pasen cerca de la posición del puntero.
  // En lugar de eliminar el trazo entero, lo parte en sub-trazos para borrar
  // solo la parte tocada.
  const eraseAt = useCallback((p: { x: number; y: number }) => {
    const c = canvasRef.current; if (!c) return;
    // Radio del borrador en unidades normalizadas (usa la dimensión menor para sentirse parejo)
    const rPx = eraserSize / 2;
    const rx = rPx / c.width;
    const ry = rPx / c.height;
    const r = Math.max(rx, ry);

    setStrokes(prev => {
      const out: Stroke[] = [];
      let changed = false;
      for (const s of prev) {
        if (s.points.length < 2) {
          // Punto único: borrar si está dentro del radio
          const only = s.points[0];
          if (only && Math.hypot(only.x - p.x, only.y - p.y) <= r) { changed = true; continue; }
          out.push(s);
          continue;
        }
        let current: typeof s.points = [];
        const subs: typeof s.points[] = [];
        for (let i = 0; i < s.points.length; i++) {
          const a = s.points[i];
          const inside = Math.hypot(a.x - p.x, a.y - p.y) <= r;
          // Considerar también la cercanía al segmento previo
          let segHit = inside;
          if (!segHit && i > 0) {
            const prevP = s.points[i - 1];
            segHit = distPointToSegment(p.x, p.y, prevP.x, prevP.y, a.x, a.y) <= r;
          }
          if (segHit) {
            if (current.length) { subs.push(current); current = []; }
            changed = true;
          } else {
            current.push(a);
          }
        }
        if (current.length) subs.push(current);
        for (const seg of subs) {
          if (seg.length >= 2) out.push({ color: s.color, width: s.width, points: seg });
        }
        if (subs.length === 0) changed = true;
      }
      return changed ? out : prev;
    });
  }, [eraserSize]);

  const onDown = (e: React.PointerEvent) => {
    if (!active) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = getPos(e);
    setRedoStack([]); // cualquier acción nueva limpia rehacer
    if (tool === "eraser") {
      eraseAt(p);
    } else {
      setStrokes(prev => [...prev, { color, width, points: [p] }]);
    }
    setDrawing(true);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!active || !drawing) return;
    const p = getPos(e);
    if (tool === "eraser") {
      eraseAt(p);
      return;
    }
    setStrokes(prev => {
      const copy = prev.slice();
      const last = copy[copy.length - 1];
      copy[copy.length - 1] = { ...last, points: [...last.points, p] };
      return copy;
    });
  };
  const onUp = () => setDrawing(false);

  // Deshacer / rehacer a nivel de "snapshots" de strokes
  const historyRef = useRef<Stroke[][]>([]);
  // Guardamos snapshot antes de cada gesto (al soltar), para tener pasos limpios
  useEffect(() => {
    if (drawing) return;
    const last = historyRef.current[historyRef.current.length - 1];
    const same = last && last.length === strokes.length && last.every((s, i) => s === strokes[i]);
    if (!same) {
      historyRef.current.push(strokes);
      if (historyRef.current.length > 50) historyRef.current.shift();
    }
  }, [drawing, strokes]);

  const undo = () => {
    const hist = historyRef.current;
    if (hist.length < 2) return; // nada que deshacer (estado actual + algo)
    const current = hist.pop()!;
    const prev = hist[hist.length - 1];
    setRedoStack(r => [...r, current]);
    setStrokes(prev);
  };
  const redo = () => {
    setRedoStack(r => {
      if (r.length === 0) return r;
      const next = r[r.length - 1];
      historyRef.current.push(next);
      setStrokes(next);
      return r.slice(0, -1);
    });
  };

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
          cursor: active ? (tool === "eraser" ? "cell" : "crosshair") : "default",
          zIndex: 5,
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />

      {/* Barra flotante de herramientas, solo visible en modo dibujo */}
      {active && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-2xl shadow-lg px-3 py-2 flex items-center gap-2 flex-wrap max-w-[95vw]">
          <Button
            size="sm"
            variant={tool === "pen" ? "default" : "outline"}
            onClick={() => setTool("pen")}
            title="Lápiz"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant={tool === "eraser" ? "default" : "outline"}
            onClick={() => setTool("eraser")}
            title="Goma de borrar"
          >
            <Eraser className="w-4 h-4" />
          </Button>

          {tool === "pen" ? (
            <>
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-8 h-8 rounded border"
                title="Color"
              />
              <input
                type="range"
                min={1}
                max={10}
                value={width}
                onChange={e => setWidth(Number(e.target.value))}
                className="w-20 sm:w-24"
                title="Grosor"
              />
            </>
          ) : (
            <input
              type="range"
              min={8}
              max={60}
              value={eraserSize}
              onChange={e => setEraserSize(Number(e.target.value))}
              className="w-20 sm:w-24"
              title="Tamaño de goma"
            />
          )}

          <div className="w-px h-6 bg-border mx-1" />

          <Button size="sm" variant="outline" onClick={undo} title="Deshacer" disabled={historyRef.current.length < 2}>
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={redo} title="Rehacer" disabled={redoStack.length === 0}>
            <Redo2 className="w-4 h-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          <Button size="sm" variant="outline" onClick={onExit} title="Salir">
            <X className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Salir</span>
          </Button>
          <Button size="sm" onClick={() => onSave({ strokes })} title="Guardar dibujo">
            <Save className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Guardar</span>
          </Button>
        </div>
      )}
    </>
  );
}
