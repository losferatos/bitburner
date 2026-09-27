/**
 * D2 (Audit 4#2, 26.09.2026): die wahre Chance statt der Spannenuntergrenze.
 *
 * getSuccessRange (Action.ts:144-167) ist deterministisch: aus [est-d, est+d]
 * wird GENAU eine Grenze mit r = pop/popEst verzerrt. Black Ops haben
 * Bevoelkerungsfaktor immer 1 (BlackOperation.ts:55-61), ihre Chance rechnet
 * der Bot schon exakt (blackOpChance) - aus dem Paar der naechsten Black Op
 * und dieser Zahl folgt r rueckwaerts, und mit r die wahre Chance jeder
 * anderen Aktion derselben Stadt.
 *
 * Dieser Test extrahiert die REALEN Funktionen `rAusBlackOp` und
 * `chanceAusR` aus src/blade.js (Klammerzaehlung, kein Abtippen - eine
 * zweite, von Hand gepflegte Kopie liefe irgendwann auseinander) und eicht
 * sie per Monte Carlo gegen einen lokalen Nachbau von Action.ts, wie im
 * Audit-Beleg scratchpad/audit/spanne2.js (171.482 Faelle, 0 Fehler > 1e-9).
 *
 * Gegen die ALTE Fassung von blade.js (vor D2) ist dieser Test ROT: die
 * beiden Funktionen existieren dort nicht, die Extraktion liefert nichts.
 *
 * Aufruf: node tools/test-d2-wahre-chance.js
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

let gruen = 0;
let rot = 0;
const fehlerListe = [];

function pruefe(text, bedingung, zusatz = "") {
  if (bedingung) {
    gruen++;
    console.log("  ok    " + text + (zusatz ? "  (" + zusatz + ")" : ""));
  } else {
    rot++;
    fehlerListe.push(text + (zusatz ? " - " + zusatz : ""));
    console.log("  ROT   " + text + (zusatz ? " - " + zusatz : ""));
  }
}

console.log("");
console.log("=== D2: wahre Chance statt s.min (Audit 4#2) ===");
console.log("");

const quelle = fs.readFileSync(path.join(ROOT, "src", "blade.js"), "utf8");

/**
 * Extrahiert "const NAME = (...) => { ... };" per Klammerzaehlung - robust
 * gegen Objekt-Literale im Rumpf (anders als eine feste Zeilensuche wie in
 * bo_compare.js, die nur fuer reine Objekt-Literale passt). Ueberspringt
 * Zeilenkommentare und einfache/doppelte Strings, damit eine Klammer darin
 * die Zaehlung nicht verwirrt.
 */
function extrahiere(text, name) {
  const anker = "const " + name + " = ";
  const start = text.indexOf(anker);
  if (start < 0) return null;
  const klammerStart = text.indexOf("{", start);
  if (klammerStart < 0) return null;
  let tiefe = 0;
  let i = klammerStart;
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "/") {
      const nl = text.indexOf("\n", i);
      i = nl < 0 ? text.length : nl;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === "\\") i++;
        i++;
      }
      continue;
    }
    if (c === "{") tiefe++;
    else if (c === "}") {
      tiefe--;
      if (tiefe === 0) break;
    }
  }
  if (tiefe !== 0) return null;
  const ende = text[i + 1] === ";" ? i + 2 : i + 1;
  return text.slice(start, ende);
}

const quellRAusBlackOp = extrahiere(quelle, "rAusBlackOp");
const quellChanceAusR = extrahiere(quelle, "chanceAusR");

pruefe("rAusBlackOp steht im Quelltext (D2 gebaut)", !!quellRAusBlackOp,
  quellRAusBlackOp ? "" : "Anker fehlt - alte Fassung ohne D2?");
pruefe("chanceAusR steht im Quelltext (D2 gebaut)", !!quellChanceAusR,
  quellChanceAusR ? "" : "Anker fehlt - alte Fassung ohne D2?");

let rAusBlackOp = null;
let chanceAusR = null;
let ladeFehler = null;
if (quellRAusBlackOp && quellChanceAusR) {
  try {
    // eslint-disable-next-line no-new-func
    const gebaut = new Function(
      quellRAusBlackOp + "\n" + quellChanceAusR + "\nreturn { rAusBlackOp, chanceAusR };"
    )();
    rAusBlackOp = gebaut.rAusBlackOp;
    chanceAusR = gebaut.chanceAusR;
  } catch (e) { ladeFehler = e; }
}
pruefe("beide Funktionen laden ohne Fehler",
  typeof rAusBlackOp === "function" && typeof chanceAusR === "function",
  ladeFehler ? String(ladeFehler) : "");

if (typeof rAusBlackOp !== "function" || typeof chanceAusR !== "function") {
  console.log("");
  console.log("  UEBERSPRUNGEN: Monte Carlo braucht beide Funktionen.");
  console.log("");
  console.log("=== " + gruen + " gruen, " + rot + " rot ===");
  process.exit(1);
}

// --- Nachbau von Action.ts:144-167 und getSuccessChance (169-196), wie in
//     scratchpad/audit/spanne2.js - unabhaengig von blade.js, denn er stellt
//     die GRUNDLAGE dar, an der die extrahierten Funktionen gemessen werden.
const clamp01 = (x) => Math.max(0, Math.min(1, x));
function chance(compBase, diff, pop, isBO) {
  const popF = isBO ? 1 : Math.pow(pop / 1e9, 0.7);
  return Math.min(1, (compBase * popF) / diff);
}
function range(compBase, diff, city, isBO) {
  const est = chance(compBase, diff, city.popEst, isBO);
  const real = chance(compBase, diff, city.pop, isBO);
  const d = Math.abs(real - est);
  let low = real - d;
  let high = real + d;
  let r = city.pop / city.popEst;
  if (Number.isNaN(r)) r = 0;
  if (r < 1) low *= r; else high *= r;
  return { min: clamp01(low), max: clamp01(high), real };
}

console.log("");
console.log("-- Monte Carlo gegen den Action.ts-Nachbau (100.000 Faelle) --");
{
  const ANZAHL = 100000;
  let n = 0;
  let fehler = 0;
  let unbestimmtBO = 0;
  let unbestimmtZiel = 0;
  let rKleinFaelle = 0;
  let rKleinUnbestimmt = 0;
  for (let i = 0; i < ANZAHL; i++) {
    const pop = 0.1e9 + Math.random() * 1.4e9;
    const popEst = pop * (0.3 + Math.random() * 1.5);
    const city = { pop, popEst };
    const rWahr = pop / popEst;
    if (rWahr < 1) rKleinFaelle++;

    const boReal = 0.02 + Math.random() * 0.9;
    const bo = range(boReal * 80000, 80000, city, true);
    const rr = rAusBlackOp(bo, boReal);
    if (!rr.sicher) {
      unbestimmtBO++;
      if (rWahr < 1) rKleinUnbestimmt++;
      continue;
    }

    const diff = 3000;
    const zielReal = Math.random() * 0.98 + 0.01;
    const compBase = (zielReal * diff) / Math.pow(pop / 1e9, 0.7);
    const op = range(compBase, diff, city, false);

    const x = chanceAusR(rr.r, rr.sicher, op);
    if (x === null) {
      unbestimmtZiel++;
      if (rWahr < 1) rKleinUnbestimmt++;
      continue;
    }
    n++;
    if (rr.r >= 1 && op.max >= 1) {
      // Nur eine Untergrenze (Obergrenze geklemmt): x darf real nicht uebersteigen.
      if (op.real + 1e-9 < x) fehler++;
      continue;
    }
    if (Math.abs(x - op.real) > 1e-9) fehler++;
  }

  pruefe("0 Fehler unter " + n + " bestimmbaren Faellen (Toleranz 1e-9)", fehler === 0,
    fehler + " falsch");
  const unbestimmtGesamt = unbestimmtBO + unbestimmtZiel;
  console.log("       bestimmbar " + n + ", unbestimmt " + unbestimmtGesamt
    + " (BO geklemmt " + unbestimmtBO + ", Ziel " + unbestimmtZiel + ") von " + ANZAHL);
  pruefe("die meisten Faelle sind bestimmbar (Audit: rund 14 % unbestimmt)",
    unbestimmtGesamt / ANZAHL < 0.3,
    (100 * unbestimmtGesamt / ANZAHL).toFixed(1) + "% unbestimmt");
  pruefe("der schaedliche Fall r<1 (s.min faellt gegen 0) ist praktisch immer aufloesbar",
    rKleinUnbestimmt / Math.max(1, rKleinFaelle) < 0.02,
    rKleinUnbestimmt + " von " + rKleinFaelle + " r<1-Faellen unbestimmt");
}

console.log("");
console.log("-- Eichpunkt: keine Verzerrung (r=1) liefert die Mitte der Spanne --");
{
  // Ohne jede Verzerrung (pop === popEst) muss chanceAusR exakt die reale
  // Chance zurueckgeben - ein von Hand nachvollziehbarer Grenzfall.
  const s = { min: 0.2, max: 0.6 };
  const x = chanceAusR(1, true, s);
  pruefe("r=1: (min+max)/2 = 0.4", Math.abs(x - 0.4) < 1e-12, "erhalten " + x);
}

console.log("");
console.log("-- Eichpunkt: r<1 mit min=0 ist unbestimmt statt geraten --");
{
  const x = chanceAusR(0.5, true, { min: 0, max: 0.7 });
  pruefe("min=0 liefert null (kein Rateergebnis)", x === null, "erhalten " + x);
}

console.log("");
console.log("-- rAusBlackOp: die drei Faelle aus der Herleitung --");
{
  // Fall 1: r<1 hat die Untergrenze der Black Op verzerrt (bo.min < boReal).
  const r1 = rAusBlackOp({ min: 0.2955, max: 0.2955 }, 0.3064);
  pruefe("Fall r<1 wird exakt zurueckgerechnet",
    r1.sicher && Math.abs(r1.r - 0.2955 / 0.3064) < 1e-12, JSON.stringify(r1));

  // Fall 2: r>=1, Obergrenze verzerrt, nicht geklemmt.
  const r2 = rAusBlackOp({ min: 0.5, max: 0.6 }, 0.5);
  pruefe("Fall r>=1 (ungeklemmt) wird exakt zurueckgerechnet",
    r2.sicher && Math.abs(r2.r - 1.2) < 1e-12, JSON.stringify(r2));

  // Fall 3: r>=1, Obergrenze auf 1 geklemmt - nur eine Untergrenze fuer r.
  const r3 = rAusBlackOp({ min: 0.5, max: 1 }, 0.5);
  pruefe("Fall r>=1 (geklemmt) ist als unsicher markiert",
    r3.sicher === false, JSON.stringify(r3));
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehlerListe) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
