import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Undo2, Redo2, Trash2, CornerDownLeft, Plus, X, AudioLines } from "lucide-react";
import { KEY_OPTIONS, degreeToChord, chordToDegree } from "@/lib/chords";
import SongViewer, { ViewerSong } from "./SongViewer";

// ===== Improvisación =====
// Entrada especial de una lista (NO es una canción del catálogo ni se guarda en la
// base de datos). Solo vive en la sesión del usuario (localStorage por lista).
// Reutiliza SongViewer (y por lo tanto SongRenderer, fuentes, tamaño de letra,
// transposición, grados y Modo Músico) para la visualización.

export const IMPROV_ID = "__improv__";
export const IMPROV_TITLE = "🎸 Improvisación";

type Section = { name: string; lines: string[][] };
type State = { key: string; sections: Section[] };

const DIATONIC = ["I", "IIm", "IIIm", "IV", "V", "VIm", "VII°"];

const SECTION_OPTIONS = [
  "INTRO", "VERSO", "VERSO 1", "VERSO 2", "PRE-CORO", "CORO", "CORO 1", "CORO 2",
  "PUENTE", "INSTRUMENTAL", "SOLO", "FINAL",
];

const emptyState = (key = "C"): State => ({ key, sections: [{ name: "INTRO", lines: [[]] }] });

function storageKey(scope: string) { return `improv:${scope}`; }

function buildLyrics(state: State): string {
  const out: string[] = [];
  for (const s of state.sections) {
    out.push(`${s.name}:`);
    for (const line of s.lines) {
      out.push(line.length ? line.join("   ") : "");
    }
    out.push("");
  }
  return out.join("\n").trimEnd();
}

type Props = {
  scope: string;                 // id de la lista (para persistir la sesión)
  siblings?: ViewerSong[];
  onSelect?: (s: ViewerSong) => void;
  onBack: () => void;
};

export default function ImprovSession({ scope, siblings, onSelect, onBack }: Props) {
  const [state, setState] = useState<State>(() => {
    try {
      const raw = localStorage.getItem(storageKey(scope));
      if (raw) {
        const parsed = JSON.parse(raw) as State;
        if (parsed?.key && Array.isArray(parsed.sections)) return parsed;
      }
    } catch {}
    return emptyState();
  });
  const [keyChosen, setKeyChosen] = useState<boolean>(() => {
    try { return !!localStorage.getItem(storageKey(scope)); } catch { return false; }
  });
  const [paletteMode, setPaletteMode] = useState<"chords" | "degrees">("chords");
  const [activeSection, setActiveSection] = useState(0);
  const [newSectionName, setNewSectionName] = useState("");

  const undoStack = useRef<State[]>([]);
  const redoStack = useRef<State[]>([]);
  const [, forceRender] = useState(0);

  useEffect(() => {
    try { localStorage.setItem(storageKey(scope), JSON.stringify(state)); } catch {}
  }, [state, scope]);

  const commit = (next: State) => {
    undoStack.current.push(state);
    redoStack.current = [];
    setState(next);
    forceRender(n => n + 1);
  };
  const undo = () => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(state);
    setState(prev);
    forceRender(n => n + 1);
  };
  const redo = () => {
    const nxt = redoStack.current.pop();
    if (!nxt) return;
    undoStack.current.push(state);
    setState(nxt);
    forceRender(n => n + 1);
  };

  const palette = useMemo(
    () => DIATONIC.map(d => ({ degree: d, chord: degreeToChord(d, state.key) })),
    [state.key],
  );

  const addChord = (chord: string) => {
    const sections = state.sections.map((s, i) => {
      if (i !== activeSection) return s;
      const lines = s.lines.length ? [...s.lines] : [[]];
      lines[lines.length - 1] = [...lines[lines.length - 1], chord];
      return { ...s, lines };
    });
    commit({ ...state, sections });
  };

  const newLine = () => {
    const sections = state.sections.map((s, i) =>
      i === activeSection ? { ...s, lines: [...s.lines, []] } : s,
    );
    commit({ ...state, sections });
  };

  const removeChord = (si: number, li: number, ci: number) => {
    const sections = state.sections.map((s, i) => {
      if (i !== si) return s;
      const lines = s.lines.map((l, j) => (j === li ? l.filter((_, k) => k !== ci) : l));
      return { ...s, lines };
    });
    commit({ ...state, sections });
  };

  const removeLine = (si: number, li: number) => {
    const sections = state.sections.map((s, i) => {
      if (i !== si) return s;
      const lines = s.lines.filter((_, j) => j !== li);
      return { ...s, lines: lines.length ? lines : [[]] };
    });
    commit({ ...state, sections });
  };

  const removeSection = (si: number) => {
    const sections = state.sections.filter((_, i) => i !== si);
    commit({ ...state, sections: sections.length ? sections : emptyState(state.key).sections });
    setActiveSection(0);
  };

  const addSection = (name: string) => {
    const clean = name.trim().toUpperCase();
    if (!clean) return;
    commit({ ...state, sections: [...state.sections, { name: clean, lines: [[]] }] });
    setActiveSection(state.sections.length);
    setNewSectionName("");
  };

  const clearAll = () => commit(emptyState(state.key));

  const lyrics = useMemo(() => buildLyrics(state), [state]);

  const song: ViewerSong = {
    id: IMPROV_ID,
    source: "setlist",
    title: IMPROV_TITLE,
    artist: "Sesión en vivo (no se guarda en el catálogo)",
    song_key: state.key,
    lyrics,
  };

  const label = (p: { degree: string; chord: string }) =>
    paletteMode === "degrees" ? p.degree : p.chord;

  // Paso 1: elegir tonalidad
  if (!keyChosen) {
    return (
      <div className="space-y-4">
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl border border-primary/40 bg-primary/10 grid place-items-center">
              <AudioLines className="w-5 h-5 text-primary" />
            </span>
            <div>
              <h2 className="text-xl font-bold">Improvisación</h2>
              <p className="text-sm text-muted-foreground">Creá tu canción en el momento</p>
            </div>
          </div>
          <p className="font-semibold">¿En qué tonalidad vas a tocar?</p>
          <div className="flex flex-wrap gap-2">
            {KEY_OPTIONS.map(k => (
              <Button
                key={k}
                variant={state.key === k ? "default" : "outline"}
                className="w-14"
                onClick={() => setState(s => ({ ...s, key: k }))}
              >
                {k}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setKeyChosen(true)}>Empezar en {state.key}</Button>
            <Button variant="outline" onClick={onBack}>Volver</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Constructor de la improvisación */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="w-9 h-9 rounded-xl border border-primary/40 bg-primary/10 grid place-items-center">
            <AudioLines className="w-4 h-4 text-primary" />
          </span>
          <div className="flex-1 min-w-[160px]">
            <h2 className="font-bold">Improvisación</h2>
            <p className="text-xs text-muted-foreground">Se borra al terminar la sesión — no entra al catálogo</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Tonalidad:</span>
            <Select value={state.key} onValueChange={(k) => commit({ ...state, key: k })}>
              <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>{KEY_OPTIONS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Botones:</span>
            <Select value={paletteMode} onValueChange={v => setPaletteMode(v as any)}>
              <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="chords">Acordes</SelectItem>
                <SelectItem value="degrees">Grados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Acordes de la escala */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">Acordes en {state.key}</p>
          <div className="flex flex-wrap gap-2">
            {palette.map(p => (
              <Button
                key={p.degree}
                variant="outline"
                className="min-w-[64px] h-11 border-chord/50 text-chord hover:bg-chord/10 hover:text-chord text-base font-bold"
                onClick={() => addChord(p.chord)}
              >
                {label(p)}
              </Button>
            ))}
          </div>
        </div>

        {/* Secciones */}
        <div className="space-y-3">
          {state.sections.map((s, si) => (
            <div
              key={si}
              onClick={() => setActiveSection(si)}
              className={`rounded-lg border p-3 space-y-2 cursor-pointer transition-colors ${
                si === activeSection ? "border-primary/60 bg-primary/5" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-primary text-sm tracking-wide">{s.name}:</span>
                {si === activeSection && <span className="text-xs text-muted-foreground">(sección activa)</span>}
                <span className="flex-1" />
                <Button size="icon" variant="ghost" title="Eliminar sección"
                  onClick={(e) => { e.stopPropagation(); removeSection(si); }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {s.lines.map((line, li) => (
                <div key={li} className="flex items-center gap-2 flex-wrap">
                  {line.length === 0 ? (
                    <span className="text-sm text-muted-foreground italic">Añadí acordes…</span>
                  ) : line.map((c, ci) => (
                    <span key={ci} className="group inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-base font-bold text-chord">
                      {paletteMode === "degrees" ? chordToDegree(c, state.key) : c}
                      <button
                        className="text-muted-foreground hover:text-destructive"
                        title="Quitar acorde"
                        onClick={(e) => { e.stopPropagation(); removeChord(si, li, ci); }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                  {s.lines.length > 1 && (
                    <Button size="icon" variant="ghost" title="Quitar línea"
                      onClick={(e) => { e.stopPropagation(); removeLine(si, li); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={newLine}>
            <CornerDownLeft className="w-4 h-4 mr-1" /> Nueva línea
          </Button>
          <Button variant="outline" size="sm" onClick={undo} disabled={!undoStack.current.length}>
            <Undo2 className="w-4 h-4 mr-1" /> Deshacer
          </Button>
          <Button variant="outline" size="sm" onClick={redo} disabled={!redoStack.current.length}>
            <Redo2 className="w-4 h-4 mr-1" /> Rehacer
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll}>
            <Trash2 className="w-4 h-4 mr-1" /> Limpiar todo
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap border-t border-border pt-3">
          <Select value="" onValueChange={addSection}>
            <SelectTrigger className="w-44 h-9"><SelectValue placeholder="+ Nueva sección" /></SelectTrigger>
            <SelectContent>
              {SECTION_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            value={newSectionName}
            onChange={e => setNewSectionName(e.target.value)}
            placeholder="Sección personalizada"
            className="w-48 h-9"
            onKeyDown={e => { if (e.key === "Enter") addSection(newSectionName); }}
          />
          <Button size="sm" variant="outline" onClick={() => addSection(newSectionName)} disabled={!newSectionName.trim()}>
            <Plus className="w-4 h-4 mr-1" /> Agregar
          </Button>
        </div>
      </Card>

      {/* Visualización con el renderizador único (incluye Modo Músico) */}
      <SongViewer
        key={`improv-${scope}`}
        song={song}
        siblings={siblings}
        onSelect={onSelect}
        onBack={onBack}
        onChangeKey={(k) => setState(s => ({ ...s, key: k }))}
      />
    </div>
  );
}
