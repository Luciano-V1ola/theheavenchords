import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ArrowLeft, Pencil, Copy, Play, Pause, Minus, Plus, ChevronLeft, ChevronRight, List, Brush } from "lucide-react";
import { toast } from "sonner";
import { KEY_OPTIONS, noteIndex, renderLines, transposeChordLine, isChordLine } from "@/lib/chords";
import { SongFont } from "./SongFormFields";
import SongOverlayCanvas from "./SongOverlayCanvas";
import type { Drawing } from "./DrawingCanvas";

// Visor reutilizable: recibe una canción ya cargada (catálogo global o item de setlist).
// Soporta navegación entre canciones (anterior/siguiente y sidebar).
export type ViewerSong = {
  id?: string;
  source?: "catalog" | "setlist" | "review";
  title: string;
  artist?: string | null;
  song_key: string;
  lyrics: string;
  font?: SongFont | null;
  contributor_name?: string | null;
  bpm?: number | null;
  time_signature?: string | null;
};

type Props = {
  song: ViewerSong;
  onBack: () => void;
  onEdit?: () => void;
  // Lista opcional de canciones para navegación (anterior/siguiente y sidebar)
  siblings?: ViewerSong[];
  onSelect?: (s: ViewerSong) => void;
  // Dibujo opcional sobre la partitura (solo dentro de listas de iglesia)
  drawing?: Drawing | null;
  canDraw?: boolean;
  onSaveDrawing?: (d: Drawing) => Promise<void> | void;
  // Si se provee, persiste el cambio de tono (solo para listas)
  onChangeKey?: (newKey: string) => Promise<void> | void;
};

// Extrae una línea de metadata "[font:arial]" si existe
function extractFont(lyrics: string): { font: SongFont | null; clean: string } {
  const m = lyrics.match(/^\[font:(arial|calibri)\]\s*\n?/i);
  if (!m) return { font: null, clean: lyrics };
  return { font: m[1].toLowerCase() as SongFont, clean: lyrics.slice(m[0].length) };
}

export default function SongViewer({ song, onBack, onEdit, siblings, onSelect, drawing, canDraw, onSaveDrawing, onChangeKey }: Props) {
  const [currentKey, setCurrentKey] = useState(song.song_key);
  const [displayMode, setDisplayMode] = useState<"chords" | "degrees" | "both">("chords");
  const [scrolling, setScrolling] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const scrollRef = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // Datos derivados de la canción (limpia metadata de fuente)
  const { font: embeddedFont, clean } = useMemo(() => extractFont(song.lyrics), [song.lyrics]);
  const font: SongFont = song.font ?? embeddedFont ?? "arial";
  const fontClass = font === "calibri" ? "font-calibri" : "font-arial";

  // Si cambia la canción, resetea el tono al original
  useEffect(() => { setCurrentKey(song.song_key); window.scrollTo({ top: 0 }); }, [song.song_key, song.id, song.title]);

  // Auto-scroll
  useEffect(() => {
    if (!scrolling) {
      if (scrollRef.current) { window.clearInterval(scrollRef.current); scrollRef.current = null; }
      return;
    }
    scrollRef.current = window.setInterval(() => {
      window.scrollBy({ top: 1 });
      if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 2) setScrolling(false);
    }, 80);
    return () => { if (scrollRef.current) window.clearInterval(scrollRef.current); };
  }, [scrolling]);

  const semitones = noteIndex(currentKey) - noteIndex(song.song_key);
  const lines = renderLines(clean, semitones, currentKey);
  const transpose = (n: number) => {
    const idx = noteIndex(currentKey);
    setCurrentKey(KEY_OPTIONS.find(k => noteIndex(k) === ((idx + n + 12) % 12)) ?? KEY_OPTIONS[(idx + n + 12) % 12]);
  };

  const copy = async () => {
    const text = clean.split("\n").map(l => isChordLine(l) ? transposeChordLine(l, semitones, currentKey) : l).join("\n");
    const full = `${song.title}${song.artist ? " - " + song.artist : ""}\nTono: ${currentKey}\n\n${text}`;
    await navigator.clipboard.writeText(full);
    toast.success("Copiado");
  };

  // Navegación entre canciones del listado
  const idx = siblings?.findIndex((s) => {
    if (s.id && song.id) {
      return s.id === song.id && (s.source ?? null) === (song.source ?? null);
    }
    return s.title === song.title;
  }) ?? -1;
  const prev = idx > 0 ? siblings![idx - 1] : null;
  const next = siblings && idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Volver</Button>

        {siblings && siblings.length > 1 && onSelect && (
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" title="Lista de canciones">
                <List className="w-4 h-4 mr-1" /> Lista
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto">
              <SheetHeader><SheetTitle>Canciones</SheetTitle></SheetHeader>
              <div className="mt-4 space-y-1">
                {siblings.map((s) => {
                  const active = s.id ? s.id === song.id : s.title === song.title;
                  return (
                    <button
                      key={s.id ?? s.title}
                      onClick={() => { onSelect(s); setSidebarOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                      }`}
                    >
                      <div className="font-medium truncate">{s.title}</div>
                      {s.artist && <div className={`text-xs truncate ${active ? "opacity-80" : "text-muted-foreground"}`}>{s.artist}</div>}
                    </button>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        )}

        <div className="flex-1 min-w-0">
          {/* Título grande */}
          <h2 className={`font-bold text-xl sm:text-2xl truncate ${fontClass}`}>{song.title}</h2>
          {song.artist && <p className="text-sm text-muted-foreground truncate">{song.artist}</p>}
          {(song.bpm || song.time_signature) && (
            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
              {song.bpm ? <span><b className="text-foreground">BPM:</b> {song.bpm}</span> : null}
              {song.time_signature ? <span><b className="text-foreground">Compás:</b> {song.time_signature}</span> : null}
            </div>
          )}
        </div>

        {onEdit && <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="w-4 h-4" /></Button>}
      </div>

      {/* Navegación rápida */}
      {siblings && siblings.length > 1 && onSelect && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={!prev} onClick={() => prev && onSelect(prev)} className="flex-1">
            <ChevronLeft className="w-4 h-4 mr-1" />
            <span className="truncate">{prev ? prev.title : "Anterior"}</span>
          </Button>
          <Button variant="outline" size="sm" disabled={!next} onClick={() => next && onSelect(next)} className="flex-1">
            <span className="truncate">{next ? next.title : "Siguiente"}</span>
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      <Card className="p-3 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => transpose(-1)}><Minus className="w-4 h-4" /></Button>
          <div className="flex items-center gap-2">
            <span className="text-sm">Tono:</span>
            <Select value={currentKey} onValueChange={setCurrentKey}>
              <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {KEY_OPTIONS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="icon" variant="outline" onClick={() => transpose(1)}><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setScrolling(s => !s)}>
            {scrolling ? <><Pause className="w-4 h-4 mr-1" /> Detener</> : <><Play className="w-4 h-4 mr-1" /> Auto-scroll</>}
          </Button>
          <Button size="sm" variant="outline" onClick={copy}><Copy className="w-4 h-4 mr-1" /> Copiar</Button>
          {canDraw && (
            <Button size="sm" variant={drawMode ? "default" : "outline"} onClick={() => setDrawMode(d => !d)} title="Dibujar sobre la partitura">
              <Brush className="w-4 h-4 mr-1" /> {drawMode ? "Dibujando" : "Dibujar"}
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-4 sm:p-6 overflow-x-auto relative" ref={sheetRef}>
        <pre className={`${fontClass} text-base sm:text-lg leading-relaxed whitespace-pre`}>
          {lines.map((l, i) => {
            if (l.type === "title") return <div key={i} className="title-line">{l.text}</div>;
            if (l.type === "chord") return <div key={i} className="chord-line">{l.text || "\u00A0"}</div>;
            if (l.type === "section") return <div key={i} className="section-line">{l.text}</div>;
            return <div key={i}>{l.text || "\u00A0"}</div>;
          })}
        </pre>
        {canDraw && (
          <SongOverlayCanvas
            containerRef={sheetRef}
            initial={drawing ?? null}
            active={drawMode}
            onSave={async (d) => { await onSaveDrawing?.(d); setDrawMode(false); }}
            onExit={() => setDrawMode(false)}
          />
        )}
      </Card>

      {song.contributor_name !== undefined && (
        <p className="text-xs text-muted-foreground italic text-center">
          Colaborador: {song.contributor_name || "—"}
        </p>
      )}
    </div>
  );
}
