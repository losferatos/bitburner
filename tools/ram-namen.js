/**
 * Was kostet eine Datei an RAM - und WARUM?
 *
 * ===========================================================================
 * DIE FEHLERKLASSE, DIE DIESES WERKZEUG FINDET
 * ===========================================================================
 *
 * Der RAM-Rechner des Spiels laeuft ueber den ABSTRAKTEN SYNTAXBAUM und nimmt
 * bei jedem Property-Zugriff den NAMEN (`Script/RamCalculations.ts`, der
 * MemberExpression-Zweig). Er unterscheidet dabei nicht, worauf zugegriffen
 * wird. `osc.connect(gain)` - ein Web-Audio-Aufruf, der mit dem Spiel nichts
 * zu tun hat - kostet deshalb exakt so viel wie `ns.connect`: 2 GB mal
 * Singularity-Faktor 16 ausserhalb von BitNode 4.
 *
 * Am 04.09.2026 kostete `wakelock.js` dadurch 34,25 GB statt 2,25 und war auf
 * einem frischen home mit 32 GB nicht startbar. Gefunden wurde das durch eine
 * Einzelmessung, nicht durch ein Werkzeug. Dieses hier sucht die ganze Klasse.
 *
 * ===========================================================================
 * WAS ES NICHT KANN
 * ===========================================================================
 *
 * Es ist eine Naeherung, kein Ersatz fuer `calculateRam` im Spiel. Es kennt
 * keine Importketten und keine Bedingungen. Es beantwortet genau eine Frage:
 * "welche teuren NAMEN stehen in dieser Datei, und weiss ich von jedem, dass
 * er dort stehen soll?"
 *
 * Aufruf: node tools/ram-namen.js [datei ...]        einzelne Dateien
 *         node tools/ram-namen.js --lib              alle src/lib-Module
 *         node tools/ram-namen.js --alle             alles unter src/
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const REF = path.join(ROOT, "reference", "v301", "src", "Netscript", "RamCostGenerator.ts");

if (!fs.existsSync(REF)) {
  console.log("RamCostGenerator.ts nicht gefunden: " + REF);
  process.exit(1);
}

// --- Kostentabelle aus der Referenz lesen -----------------------------------
//
// Erzeugt, nicht abgeschrieben. Eine von Hand uebertragene Tabelle weicht ab,
// sobald das Spiel eine Version weiterzieht - und niemand merkt es, weil die
// Zahlen weiterhin plausibel aussehen.

const refText = fs.readFileSync(REF, "utf8");

const KONSTANTEN = {};
for (const m of refText.matchAll(/^\s*(\w+)\s*:\s*([\d.]+)\s*,/gm)) {
  KONSTANTEN[m[1]] = Number(m[2]);
}

/** Namen mit direkter Zahl, z. B. `getRamLimit: 0.05`. */
const KOSTEN = {};
for (const m of refText.matchAll(/^\s*(\w+)\s*:\s*([\d.]+)\s*,/gm)) {
  KOSTEN[m[1]] = Number(m[2]);
}
/** Namen ueber eine Konstante, z. B. `hasRootAccess: RamCostConstants.HasRootAccess`. */
for (const m of refText.matchAll(/^\s*(\w+)\s*:\s*RamCostConstants\.(\w+)\s*,/gm)) {
  const wert = KONSTANTEN[m[2]];
  if (Number.isFinite(wert)) KOSTEN[m[1]] = wert;
}
/** Singularity-Familie: SF4Cost(...) - der Grundpreis haengt an der Stufe. */
const SINGULARITY = new Set();
for (const m of refText.matchAll(/^\s*(\w+)\s*:\s*SF4Cost\(\s*(?:RamCostConstants\.)?(\w+)\s*\)/gm)) {
  SINGULARITY.add(m[1]);
  const wert = KONSTANTEN[m[2]];
  if (Number.isFinite(wert)) KOSTEN[m[1]] = wert;
}

// Namen, die zu allgemein sind, um als Befund zu taugen: sie kommen in jedem
// JavaScript vor. Sie werden gezaehlt, aber nur mit --alle gemeldet.
const ALLTAeGLICH = new Set([
  "length", "name", "type", "value", "data", "text", "message", "size",
  "map", "filter", "find", "push", "slice", "join", "split", "sort",
]);

/**
 * Dateien, deren Treffer bekannt sind und nichts mehr kosten, weil die Datei
 * tot ist (Auftrag 1.5 fuehrt sie namentlich; `tools/archivliste.js` bestaetigt
 * es aus den Aufruferbeziehungen).
 *
 * Sie werden weiter GEMELDET, zaehlen aber nicht als Befund - sonst steht der
 * Test dauerhaft auf rot und wird nach zwei Laeufen ignoriert. Ein roter Test,
 * den alle uebergehen, ist schlimmer als keiner: er verdeckt den naechsten
 * echten Fund.
 *
 * `keepalive.js` traegt denselben 32-GB-`connect`-Fehler wie `wakelock.js` vor
 * dem Fix vom 04.09.2026 - dasselbe Lehrstueck, andere Datei.
 */
const TOTE_DATEIEN = new Set([
  "keepalive.js",   // Auftrag 1.5: tot. connect = 32 GB
  "travel.js",      // Auftrag 1.5: tot
  "kerne.js",       // kein lebender Aufrufer
  "calccheck.js",   // Diagnosewerkzeug, laeuft nie im Bot
]);

const dateien = [];
const argv = process.argv.slice(2);
if (argv.includes("--lib")) {
  for (const wurzel of [path.join(ROOT, "src", "lib"),
                        path.resolve(ROOT, "..", "bitburner-bau", "src", "lib")]) {
    if (!fs.existsSync(wurzel)) continue;
    for (const f of fs.readdirSync(wurzel)) {
      if (f.endsWith(".js")) dateien.push(path.join(wurzel, f));
    }
  }
} else if (argv.includes("--alle")) {
  const sammle = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) sammle(p);
      else if (e.name.endsWith(".js")) dateien.push(p);
    }
  };
  sammle(path.join(ROOT, "src"));
} else {
  for (const a of argv) {
    if (a.startsWith("--")) continue;
    const kandidaten = [a, path.join(ROOT, a), path.join(ROOT, "src", a),
      path.resolve(ROOT, "..", "bitburner-bau", "src", a)];
    const t = kandidaten.find((p) => fs.existsSync(p));
    if (t) dateien.push(t);
    else console.log("  nicht gefunden: " + a);
  }
}

if (!dateien.length) {
  console.log("");
  console.log("  Keine Datei angegeben. Aufruf:");
  console.log("    node tools/ram-namen.js src/wakelock.js");
  console.log("    node tools/ram-namen.js --lib");
  console.log("");
  process.exit(1);
}

console.log("");
console.log("=== Teure Namen je Datei ===");
console.log("  Kostentabelle: " + Object.keys(KOSTEN).length + " Namen aus RamCostGenerator.ts");
console.log("  davon Singularity (Faktor 16 ausserhalb BN4): " + SINGULARITY.size);
console.log("");

let gesamtBefunde = 0;

for (const datei of dateien) {
  const inhalt = fs.readFileSync(datei, "utf8");
  // Kommentare entfernen: sie zaehlen im Spiel NICHT mit, und ein Name in
  // einem Kommentar als Befund waere ein Fehlalarm bei jeder Erklaerung.
  const code = inhalt
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1 ");

  const treffer = new Map();
  for (const m of code.matchAll(/\.\s*(\w+)/g)) {
    const n = m[1];
    if (!(n in KOSTEN)) continue;
    // Namen mit Kosten 0 sind kein Befund. Die Formulas-Familie (hackChance,
    // growThreads, hackTime ...) steht in der Tabelle, kostet aber nichts -
    // sie zu melden erzeugt Fehlalarme, und ein Werkzeug mit Fehlalarmen wird
    // nach zwei Laeufen ignoriert.
    if (!(KOSTEN[n] > 0)) continue;
    if (ALLTAeGLICH.has(n) && !argv.includes("--alle")) continue;
    treffer.set(n, (treffer.get(n) || 0) + 1);
  }

  // `ns.` davor heisst: gewollt. Alles andere ist erklaerungsbeduerftig.
  const mitNs = new Set();
  for (const m of code.matchAll(/\bns\s*\.\s*(\w+)/g)) mitNs.add(m[1]);
  for (const m of code.matchAll(/\bns\s*\.\s*(\w+)\s*\.\s*(\w+)/g)) mitNs.add(m[2]);

  // ALIASE AUFLOESEN. `const b = ns.bladeburner; ... b.getRank()` ist derselbe
  // Aufruf wie `ns.bladeburner.getRank()` - gewollt und korrekt bepreist. Ohne
  // diese Aufloesung meldet das Werkzeug jeden Alias als Befund; ueber src/
  // waren das 60 von 65 Treffern, und der eine echte Fund geht darin unter.
  // Ein Werkzeug, das man durchblaettern muss, wird nach zwei Laeufen ignoriert.
  const aliase = new Set();
  for (const m of code.matchAll(/\b(?:const|let|var)\s+(\w+)\s*=\s*ns\b/g)) {
    aliase.add(m[1]);
  }
  for (const m of code.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*ns\b/g)) {
    for (const teil of m[1].split(",")) {
      const roh = teil.includes(":") ? teil.split(":")[1] : teil;
      const sauber = roh.trim().replace(/\s.*$/, "");
      if (sauber) aliase.add(sauber);
    }
  }
  if (aliase.size) {
    const muster = new RegExp("\\b(?:" + [...aliase].join("|") + ")\\s*\\.\\s*(\\w+)", "g");
    for (const m of code.matchAll(muster)) mitNs.add(m[1]);
  }

  const rel = path.relative(ROOT, datei).replace(/\\/g, "/");
  const verdaechtig = [...treffer.keys()].filter((n) => !mitNs.has(n));

  let summe = 0;
  for (const n of treffer.keys()) {
    summe += SINGULARITY.has(n) ? KOSTEN[n] * 16 : KOSTEN[n];
  }

  const istTot = TOTE_DATEIEN.has(path.basename(datei));
  const marke = verdaechtig.length ? (istTot ? "  --" : "  !!") : "  ok";
  console.log(marke + "  " + rel);
  console.log("        Namen aus der Kostentabelle: " + treffer.size +
    ", Summe (SF4.1) etwa " + summe.toFixed(2) + " GB");

  if (verdaechtig.length) {
    if (!istTot) gesamtBefunde += verdaechtig.length;
    for (const n of verdaechtig) {
      const preis = SINGULARITY.has(n) ? KOSTEN[n] * 16 : KOSTEN[n];
      console.log("        VERDAECHTIG: ." + n + " ohne ns davor kostet " +
        preis.toFixed(2) + " GB" + (SINGULARITY.has(n) ? "  (Singularity x16!)" : ""));
      // Die Fundstelle nennen, sonst sucht man in 3000 Zeilen.
      const zeilen = inhalt.split("\n");
      for (let i = 0; i < zeilen.length; i++) {
        if (new RegExp("\\.\\s*" + n + "\\b").test(zeilen[i]) &&
            !/^\s*(\*|\/\/)/.test(zeilen[i])) {
          console.log("           " + rel + ":" + (i + 1) + "  " + zeilen[i].trim().slice(0, 90));
          break;
        }
      }
    }
  }
}

console.log("");
if (gesamtBefunde) {
  console.log("=== " + gesamtBefunde + " verdaechtige(r) Name(n) ===");
  console.log("  Jeder ist entweder ein echter Fund (dann umbenennen oder den");
  console.log("  Namen aufspalten wie in wakelock.js: osc[\"con\"+\"nect\"]) oder");
  console.log("  ein Fehlalarm (dann gehoert er in ALLTAeGLICH).");
} else {
  console.log("=== kein verdaechtiger Name ===");
}
console.log("");
process.exit(gesamtBefunde ? 1 : 0);
