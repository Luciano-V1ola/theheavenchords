// Lógica musical: detección y transposición de acordes.

export const NOTES_SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
// Lista de tonos disponibles para mostrar al usuario (sostenidos y bemoles)
export const KEY_OPTIONS = [
  "C","C#","Db","D","D#","Eb","E","F","F#","Gb","G","G#","Ab","A","A#","Bb","B"
];

const FLAT_TO_SHARP: Record<string, string> = {
  "Db":"C#","Eb":"D#","Gb":"F#","Ab":"G#","Bb":"A#"
};
// Cuando el tono original/destino es bemol preferimos mostrar bemoles
const SHARP_TO_FLAT: Record<string, string> = {
  "C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb"
};

const normalize = (n: string) => FLAT_TO_SHARP[n] || n;
export const noteIndex = (n: string) => NOTES_SHARP.indexOf(normalize(n));

// Decide si una nota debe mostrarse en bemol (según el tono actual)
function preferFlats(currentKey: string): boolean {
  return /b$/.test(currentKey) || ["F"].includes(currentKey);
}
function display(noteSharp: string, useFlats: boolean): string {
  if (!useFlats) return noteSharp;
  return SHARP_TO_FLAT[noteSharp] || noteSharp;
}

// Transpone un acorde individual (C, Am, G7, F#m, D/F#, Bbmaj7...)
export function transposeChord(chord: string, semitones: number, currentKey = "C"): string {
  const m = chord.match(/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/);
  if (!m) return chord;
  const [, root, suffix, bass] = m;
  const idx = noteIndex(root);
  if (idx === -1) return chord;
  const useFlats = preferFlats(currentKey);
  const newRoot = display(NOTES_SHARP[(idx + semitones + 1200) % 12], useFlats);
  let newBass = "";
  if (bass) {
    const bi = noteIndex(bass);
    if (bi !== -1) newBass = "/" + display(NOTES_SHARP[(bi + semitones + 1200) % 12], useFlats);
  }
  return newRoot + suffix + newBass;
}

// ===== Sistema de grados (números romanos) =====
// Mayor: I ii iii IV V vi vii°  — Menor (relativa): i ii° III iv v VI VII
const MAJOR_DEGREES = ["I","bII","II","bIII","III","IV","#IV","V","bVI","VI","bVII","VII"];

// Convierte un acorde individual a su grado relativo al tono actual
export function chordToDegree(chord: string, currentKey: string): string {
  const m = chord.match(/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/);
  if (!m) return chord;
  const [, root, suffix, bass] = m;
  const rootIdx = noteIndex(root);
  const keyIdx = noteIndex(currentKey);
  if (rootIdx === -1 || keyIdx === -1) return chord;
  const interval = (rootIdx - keyIdx + 12) % 12;
  let degree = MAJOR_DEGREES[interval] ?? "?";

  // Detectar calidad: minor (m, min) sin confundir con maj
  const isMinor = /^m(?!aj)/.test(suffix) || /^min/i.test(suffix);
  const isDim = /^(dim|°|o)/i.test(suffix);
  const isAug = /^(aug|\+)/i.test(suffix);

  if (isMinor) degree = degree.toLowerCase();
  // Sufijo extra: 7, maj7, sus, add9, etc. (sin la "m" inicial)
  let extra = suffix;
  if (isMinor) extra = extra.replace(/^m(in)?/i, "");
  if (isDim) { degree = degree.toLowerCase() + "°"; extra = extra.replace(/^(dim|°|o)/i, ""); }
  if (isAug) { degree = degree + "+"; extra = extra.replace(/^(aug|\+)/i, ""); }

  let bassPart = "";
  if (bass) {
    const bi = noteIndex(bass);
    if (bi !== -1) {
      const bInt = (bi - keyIdx + 12) % 12;
      bassPart = "/" + MAJOR_DEGREES[bInt];
    }
  }
  return degree + extra + bassPart;
}

// Convierte una línea de acordes a grados, preservando alineación
export function chordLineToDegrees(line: string, currentKey: string, mode: "degrees" | "both" = "degrees", semitones = 0): string {
  let out = "";
  let i = 0;
  while (i < line.length) {
    if (line[i] === " ") { out += " "; i++; continue; }
    let word = "";
    while (i < line.length && line[i] !== " ") { word += line[i]; i++; }
    const transposed = transposeChord(word, semitones, currentKey);
    const deg = chordToDegree(transposed, currentKey);
    const replacement = mode === "both" ? `${transposed}(${deg})` : deg;
    out += replacement;
    const diff = word.length - replacement.length;
    if (diff > 0) out += " ".repeat(diff);
  }
  return out;
}

// Línea de solo acordes (todas sus palabras parecen acordes)
export function isChordLine(line: string): boolean {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const re = /^[A-G][#b]?[a-zA-Z0-9]*(?:\/[A-G][#b]?)?$/;
  return words.every(w => re.test(w));
}

// Transpone una línea de acordes preservando posiciones (espacios)
export function transposeChordLine(line: string, semitones: number, currentKey = "C"): string {
  let out = "";
  let i = 0;
  while (i < line.length) {
    if (line[i] === " ") { out += " "; i++; continue; }
    let word = "";
    while (i < line.length && line[i] !== " ") { word += line[i]; i++; }
    const t = transposeChord(word, semitones, currentKey);
    out += t;
    const diff = word.length - t.length;
    if (diff > 0) out += " ".repeat(diff);
  }
  return out;
}

// Palabras clave de sección que se renderizan en negrita.
// Acepta variantes con número opcional (Coro 2, Verso2, Puente 3, etc.) y dos puntos opcionales.
// Case-insensitive (la /i ya cubre FIN/fin, CORO/coro, etc.).
const SECTION_RE = /^\s*(coro|estrofa|verso|pre[\s-]?coro|puente|intro|outro|final|fin|interludio|tag|bridge|chorus)\s*\d*\s*:?\s*$/i;
export function isSectionLabel(line: string): boolean {
  return SECTION_RE.test(line);
}

// Detecta si la primera línea es un "título de canción": algo como
// "Cuán Grande es Dios (C)" o "Mi Canción - Tono D". Heurística:
// no tiene acordes y la línea siguiente no es un acorde directo,
// es corta (<80 chars) y no empieza con etiqueta de sección.
export function isTitleLine(line: string, idx: number): boolean {
  if (idx !== 0) return false;
  const t = line.trim();
  if (!t) return false;
  if (t.length > 80) return false;
  if (isSectionLabel(t)) return false;
  if (isChordLine(t)) return false;
  return true;
}

// Devuelve la letra completa con cada línea ya transpuesta + flag chord/text/section/title
export function renderLines(lyrics: string, semitones: number, currentKey = "C") {
  const raw = lyrics.split("\n");
  return raw.map((line, idx) => {
    if (isTitleLine(line, idx)) {
      return { type: "title" as const, text: line };
    }
    if (isChordLine(line)) {
      return { type: "chord" as const, text: transposeChordLine(line, semitones, currentKey) };
    }
    if (isSectionLabel(line)) {
      return { type: "section" as const, text: line };
    }
    return { type: "text" as const, text: line };
  });
}
