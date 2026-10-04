/**
 * Benannte Importe gegen die Exporte der Zieldatei pruefen - ohne Spiel, ohne
 * Netz, rein.
 *
 * ===========================================================================
 * WARUM ES DAS GIBT (P2d, Skeptiker B2, 04.10.2026)
 * ===========================================================================
 *
 * `tools/importpruefung.js` prueft seit jeher, ob jede importierte DATEI im
 * Spiel liegt. Es prueft nicht, ob die Datei auch die NAMEN exportiert, die der
 * Importeur haben will. Der teure Fall: src/bn4rep.js importiert vier neue Namen
 * aus lib/einbau.js. Liegt im Spiel noch die alte lib/einbau.js, ist die Datei
 * da (importpruefung: "ok"), aber das Modul-Linking scheitert beim Start mit
 * "does not provide an export named ...". bn4rep.js startet nicht, der Waechter
 * startet es im Kreis neu, Torrunde und Kaufaufschub sind tot - und keine
 * Pruefung hatte es gesehen.
 *
 * Diese Datei liest die statischen `import { a, b as c } from "x.js"` einer
 * Quelle und die `export`-Anweisungen einer anderen und nennt, was fehlt.
 *
 * ===========================================================================
 * WAS ES KANN UND WAS NICHT
 * ===========================================================================
 *
 * Erkannt werden die Formen, die im Projekt vorkommen (geprueft ueber alle
 * Dateien in src/, siehe tools/test-exportpruefung.js): `export function`,
 * `export async function`, `export const|let|var|class`, `export { a, b as c }`
 * (auch mit `from`), `export default`. Eine Anweisung wird nur erkannt, wenn
 * sie am ZEILENANFANG steht (nach Leerraum) - so ueberlebt ein auskommentierter
 * Export in einem Zeilenkommentar nicht, und eine Zeichenkette mit "export"
 * mitten in einer Zeile zaehlt nicht. Blockkommentare, die selbst am Zeilenanfang
 * beginnen (die JSDoc-Koepfe), werden vorher entfernt.
 *
 * `export * from "x"` und `import * as ns` lassen sich ohne Aufloesung nicht
 * pruefen: ein Stern-Export macht die Zieldatei "offen" (alles gilt als
 * vorhanden, die Pruefung sagt dann nichts), ein Namensraum-Import verlangt
 * keinen bestimmten Namen. Ein dynamisches `import()` sieht diese Pruefung nicht
 * (es gibt keines im Projekt).
 *
 * Fehlalarm ist hier das kleinere Uebel, aber ein Fehlalarm, der eine Stufe
 * blockiert, wird irgendwann umgangen. Darum die Gegenprobe an ALLEN Dateien in
 * src/ (test-exportpruefung.js): kein einziger benannter Import darf fehlen.
 */

/** Blockkommentare entfernen, die am Zeilenanfang beginnen (JSDoc-Koepfe). */
export function stripLeadingBlockComments(src) {
  return String(src).replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, (m) => m.replace(/[^\r\n]/g, ""));
}

/** Kommentare INNERHALB einer Namensliste in geschweiften Klammern entfernen. */
function stripListComments(list) {
  return String(list)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\r\n]*/g, " ");
}

/** "a, b as c, d" -> [{name: "a", as: "a"}, {name: "b", as: "c"}, ...] (leere Glieder entfallen). */
function parseList(list) {
  const out = [];
  for (const raw of stripListComments(list).split(",")) {
    const t = raw.trim();
    if (!t) continue;
    const m = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(t);
    if (!m) continue;
    out.push({ name: m[1], as: m[2] || m[1] });
  }
  return out;
}

/** Importpfad wie importpruefung.js: "./x" und "/x" meinen "x" auf home. */
export function normalizePath(p) {
  let q = String(p);
  if (q.startsWith("./")) q = q.slice(2);
  if (q.startsWith("/")) q = q.slice(1);
  return q;
}

/**
 * Die statischen Importe einer Quelle mit benannten Namen oder Standardimport.
 * @returns {{from: string, names: string[], defaultName: string|null}[]}
 *   names = die IMPORTIERTEN Namen (vor einem `as`)
 */
export function parseImports(src) {
  const text = stripLeadingBlockComments(src);
  const out = [];
  const re = /^[ \t]*import\s+(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*["']([^"']+)["']/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    const defaultName = m[1] || null;
    const names = m[2] !== undefined ? parseList(m[2]).map((x) => x.name) : [];
    if (!defaultName && !names.length) continue;       // "import {} from" - nichts zu verlangen
    out.push({ from: normalizePath(m[3]), names, defaultName });
  }
  return out;
}

/**
 * Was eine Quelle exportiert.
 * @returns {{names: Set<string>, hasDefault: boolean, open: boolean}}
 *   open = `export * from` kommt vor: die Menge ist nicht vollstaendig bekannt
 */
export function parseExports(src) {
  const text = stripLeadingBlockComments(src);
  const names = new Set();
  let hasDefault = false;
  let open = false;
  let m;

  const decl = /^[ \t]*export\s+(?:async\s+)?(?:function\s*\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
  while ((m = decl.exec(text)) !== null) names.add(m[1]);

  const list = /^[ \t]*export\s*\{([^}]*)\}/gm;
  while ((m = list.exec(text)) !== null) {
    for (const x of parseList(m[1])) names.add(x.as);
  }

  if (/^[ \t]*export\s+default\b/m.test(text)) hasDefault = true;
  if (/^[ \t]*export\s*\*\s*from\b/m.test(text)) open = true;
  return { names, hasDefault, open };
}

/**
 * Welche benannten Importe der Quelle gibt es in der Zieldatei nicht?
 *
 * @param {string} importerSrc Quelltext des Importeurs
 * @param {Map<string,string>|Object<string,string>} sources Quelltexte der Zieldateien,
 *   Schluessel = normalisierter Importpfad. Eine Zieldatei ohne Eintrag wird NICHT
 *   geprueft (unbekannt ist nicht fehlend - das meldet importpruefung.js als fehlende Datei).
 * @returns {{from: string, name: string, why: string}[]}
 */
export function missingExports(importerSrc, sources) {
  const get = (k) => (sources instanceof Map ? sources.get(k) : (sources ? sources[k] : undefined));
  const out = [];
  for (const imp of parseImports(importerSrc)) {
    const target = get(imp.from);
    if (typeof target !== "string") continue;
    const ex = parseExports(target);
    if (ex.open) continue;
    for (const name of imp.names) {
      if (!ex.names.has(name)) out.push({ from: imp.from, name, why: "exportiert '" + name + "' nicht" });
    }
    if (imp.defaultName && !ex.hasDefault) {
      out.push({ from: imp.from, name: "default (" + imp.defaultName + ")", why: "hat keinen Standardexport" });
    }
  }
  return out;
}
