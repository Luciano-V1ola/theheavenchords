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

// Palabras clave de sección que se renderizan en negrita
const SECTION_RE = /^(coro|estrofa|verso|pre[\s-]?coro|puente|intro|outro|final|interludio|tag)\b/i;
export function isSectionLabel(line: string): boolean {
  return SECTION_RE.test(line.trim());
}

// Devuelve la letra completa con cada línea ya transpuesta + flag chord/text/section
export function renderLines(lyrics: string, semitones: number, currentKey = "C") {
  return lyrics.split("\n").map(line => {
    if (isChordLine(line)) {
      return { type: "chord" as const, text: transposeChordLine(line, semitones, currentKey) };
    }
    if (isSectionLabel(line)) {
      return { type: "section" as const, text: line };
    }
    return { type: "text" as const, text: line };
  });
}
