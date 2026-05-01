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
// Grados diatónicos en mayor por semitono desde la tónica
const MAJOR_DEGREES = ["I","bII","II","bIII","III","IV","#IV","V","bVI","VI","bVII","VII"];

// Convierte un acorde individual a su grado relativo al tono actual.
// Mantiene la calidad del acorde: F=IV, Fm=IVm, G7=V7, Gsus4=Vsus4, Cmaj7=Imaj7,
// Am7=vim7, Bdim=vii°, Eaug=III+, G/B=V/VII, Bb=bVII, etc.
export function chordToDegree(chord: string, currentKey: string): string {
  const m = chord.match(/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/);
  if (!m) return chord;
  const [, root, suffix = "", bass] = m;
  const rootIdx = noteIndex(root);
  // Fallback defensivo: si el tono no es válido, usamos C para no devolver el acorde sin transformar
  const safeKey = currentKey && noteIndex(currentKey) !== -1 ? currentKey : "C";
  const keyIdx = noteIndex(safeKey);
  if (rootIdx === -1 || keyIdx === -1) return chord;

  const interval = (rootIdx - keyIdx + 12) % 12;
  let degree = MAJOR_DEGREES[interval];
  if (!degree) return chord;

  // Detectar calidades especiales (orden importa: maj antes que m)
  const isMaj7Like = /^(maj|Maj|M(?=[0-9]))/.test(suffix); // maj7, M7
  const isMinor = !isMaj7Like && /^(m(?!aj)|min)/.test(suffix);
  const isDim = /^(dim|°|o(?![a-z]))/i.test(suffix);
  const isAug = /^(aug|\+)/i.test(suffix);

  let extra = suffix;
  if (isDim) {
    // vii° en minúscula con símbolo
    degree = degree.toLowerCase() + "°";
    extra = extra.replace(/^(dim|°|o)/i, "");
  } else if (isAug) {
    degree = degree + "+";
    extra = extra.replace(/^(aug|\+)/i, "");
  } else if (isMinor) {
    // Quitamos sólo la "m"/"min" inicial; conservamos lo demás (7, 9, sus, etc.)
    degree = degree.toLowerCase();
    extra = extra.replace(/^(min|m)/, "");
  }
  // Para mayor con sufijos (7, maj7, sus4, add9...) conservamos extra tal cual

  let bassPart = "";
  if (bass) {
    const bi = noteIndex(bass);
    if (bi !== -1) {
      const bInt = (bi - keyIdx + 12) % 12;
      const bDeg = MAJOR_DEGREES[bInt];
      if (bDeg) bassPart = "/" + bDeg;
    }
  }
  return degree + extra + bassPart;
}

// ===== Soporte de entrada en GRADOS (números romanos) =====
// Permite que el usuario escriba acordes como "I vi IV V" o "bVII", "V/VII", "vii°", "Imaj7", etc.
// Convertimos un grado a acorde absoluto según la tonalidad indicada.
const ROMAN_RE = /^(b|#)?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)([^/]*)(?:\/(b|#)?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i))?$/;

function romanToInterval(roman: string): number | null {
  const map: Record<string, number> = {
    I: 0, II: 2, III: 4, IV: 5, V: 7, VI: 9, VII: 11,
  };
  const v = map[roman.toUpperCase()];
  return v === undefined ? null : v;
}

export function isDegreeToken(word: string): boolean {
  return ROMAN_RE.test(word);
}

// Convierte un grado a acorde absoluto en la tonalidad indicada.
// Ej: ("V", "C") => "G"; ("vi", "C") => "Am"; ("bVII", "C") => "Bb"; ("V/VII", "C") => "G/B"
export function degreeToChord(token: string, currentKey: string): string {
  const m = token.match(ROMAN_RE);
  if (!m) return token;
  const [, accRoot, romanRoot, suffix = "", accBass, romanBass] = m;
  const safeKey = currentKey && noteIndex(currentKey) !== -1 ? currentKey : "C";
  const keyIdx = noteIndex(safeKey);
  const useFlats = preferFlats(safeKey);

  const baseInt = romanToInterval(romanRoot);
  if (baseInt === null) return token;
  let acc = 0;
  if (accRoot === "b") acc = -1;
  else if (accRoot === "#") acc = 1;
  const rootIdx = (keyIdx + baseInt + acc + 1200) % 12;
  let rootName = display(NOTES_SHARP[rootIdx], useFlats);

  // ¿mayúscula o minúscula? minúscula => menor por defecto
  const isLower = romanRoot === romanRoot.toLowerCase();

  // Detectar calidades en el sufijo del grado
  let outSuffix = suffix;
  const isDim = /°|dim/i.test(suffix);
  const isAug = /\+|aug/i.test(suffix);

  if (isDim) {
    outSuffix = suffix.replace(/°|dim/i, "dim");
  } else if (isAug) {
    outSuffix = suffix.replace(/\+|aug/i, "aug");
  } else if (isLower) {
    // Insertar "m" al inicio del sufijo si no está
    if (!/^m(?!aj)/.test(outSuffix)) outSuffix = "m" + outSuffix;
  }

  let bassPart = "";
  if (romanBass) {
    const bInt = romanToInterval(romanBass);
    if (bInt !== null) {
      let ba = 0;
      if (accBass === "b") ba = -1;
      else if (accBass === "#") ba = 1;
      const bIdx = (keyIdx + bInt + ba + 1200) % 12;
      bassPart = "/" + display(NOTES_SHARP[bIdx], useFlats);
    }
  }
  return rootName + outSuffix + bassPart;
}

// Convierte una línea escrita en grados a acordes absolutos preservando alineación
export function degreeLineToChords(line: string, currentKey: string): string {
  let out = "";
  let i = 0;
  while (i < line.length) {
    if (line[i] === " ") { out += " "; i++; continue; }
    let word = "";
    while (i < line.length && line[i] !== " ") { word += line[i]; i++; }
    const t = isDegreeToken(word) ? degreeToChord(word, currentKey) : word;
    out += t;
    const diff = word.length - t.length;
    if (diff > 0) out += " ".repeat(diff);
  }
  return out;
}

// Convierte una línea de acordes a grados, preservando alineación
export function chordLineToDegrees(line: string, currentKey: string, mode: "degrees" | "both" = "degrees", semitones = 0): string {
  const safeKey = currentKey && noteIndex(currentKey) !== -1 ? currentKey : "C";
  let out = "";
  let i = 0;
  while (i < line.length) {
    if (line[i] === " ") { out += " "; i++; continue; }
    let word = "";
    while (i < line.length && line[i] !== " ") { word += line[i]; i++; }
    const transposed = transposeChord(word, semitones, safeKey);
    const deg = chordToDegree(transposed, safeKey);
    const replacement = mode === "both" ? `${transposed}(${deg})` : deg;
    out += replacement;
    const diff = word.length - replacement.length;
    if (diff > 0) out += " ".repeat(diff);
  }
  return out;
}

// Línea de solo acordes (todas sus palabras parecen acordes O grados romanos)
export function isChordLine(line: string): boolean {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const re = /^[A-G][#b]?[a-zA-Z0-9]*(?:\/[A-G][#b]?)?$/;
  return words.every(w => re.test(w) || ROMAN_RE.test(w));
}

// ¿La línea está escrita en grados? (al menos un token romano y ninguno claramente de letra de acorde extraña)
export function isDegreeLine(line: string): boolean {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const hasRoman = words.some(w => ROMAN_RE.test(w));
  if (!hasRoman) return false;
  return words.every(w => ROMAN_RE.test(w));
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
// displayMode: "chords" (default), "degrees", "both"
export function renderLines(lyrics: string, semitones: number, currentKey = "C", displayMode: "chords" | "degrees" | "both" = "chords") {
  const raw = lyrics.split("\n");
  return raw.map((line, idx) => {
    if (isTitleLine(line, idx)) {
      return { type: "title" as const, text: line };
    }
    if (isChordLine(line)) {
      const text = displayMode === "chords"
        ? transposeChordLine(line, semitones, currentKey)
        : chordLineToDegrees(line, currentKey, displayMode, semitones);
      return { type: "chord" as const, text };
    }
    if (isSectionLabel(line)) {
      return { type: "section" as const, text: line };
    }
    return { type: "text" as const, text: line };
  });
}
