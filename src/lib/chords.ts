// Lógica musical: detección y transposición de acordes.

export const NOTES_SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const FLAT_TO_SHARP: Record<string, string> = {
  "Db":"C#","Eb":"D#","Gb":"F#","Ab":"G#","Bb":"A#"
};

const normalize = (n: string) => FLAT_TO_SHARP[n] || n;
export const noteIndex = (n: string) => NOTES_SHARP.indexOf(normalize(n));

// Transpone un acorde individual (C, Am, G7, F#m, D/F#, Bbmaj7...)
export function transposeChord(chord: string, semitones: number): string {
  const m = chord.match(/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/);
  if (!m) return chord;
  const [, root, suffix, bass] = m;
  const idx = noteIndex(root);
  if (idx === -1) return chord;
  const newRoot = NOTES_SHARP[(idx + semitones + 1200) % 12];
  let newBass = "";
  if (bass) {
    const bi = noteIndex(bass);
    if (bi !== -1) newBass = "/" + NOTES_SHARP[(bi + semitones + 1200) % 12];
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
export function transposeChordLine(line: string, semitones: number): string {
  let out = "";
  let i = 0;
  while (i < line.length) {
    if (line[i] === " ") { out += " "; i++; continue; }
    let word = "";
    while (i < line.length && line[i] !== " ") { word += line[i]; i++; }
    const t = transposeChord(word, semitones);
    out += t;
    const diff = word.length - t.length;
    if (diff > 0) out += " ".repeat(diff);
  }
  return out;
}

// Devuelve la letra completa con cada línea ya transpuesta + flag chord/text
export function renderLines(lyrics: string, semitones: number) {
  return lyrics.split("\n").map(line => {
    if (isChordLine(line)) {
      return { type: "chord" as const, text: transposeChordLine(line, semitones) };
    }
    return { type: "text" as const, text: line };
  });
}
