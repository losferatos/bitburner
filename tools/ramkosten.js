/**
 * Der Kostenbaum des Spiels, aus `RamCostGenerator.ts` ERZEUGT.
 *
 * ===========================================================================
 * WARUM NICHT ABGESCHRIEBEN
 * ===========================================================================
 *
 * Die Tabelle hat rund 700 Eintraege und aendert sich mit jeder Spielversion.
 * Eine abgeschriebene Fassung ist am Tag ihrer Entstehung richtig und danach
 * nie wieder - und die Abweichung faellt nicht auf, weil ein zu kleiner Wert
 * genau dort wirkt, wo niemand hinsieht: im Kaltstart, wenn home 32 GB hat.
 *
 * Am 04.09.2026 waren drei von drei geschaetzten RAM-Angaben in
 * `registry.json` falsch (7,60 statt 7,00; 6,10 statt 3,85; 10,75 statt
 * 10,80). Jede einzeln plausibel, jede von Hand entstanden.
 *
 * ===========================================================================
 * WIE DIE UMSETZUNG FUNKTIONIERT
 * ===========================================================================
 *
 * `RamCostGenerator.ts` ist fast reines JavaScript. Es braucht vier Eingriffe:
 *
 *   1. die beiden `import`-Zeilen weg (sie zeigen auf Spielinterna),
 *   2. `export type` und `type` weg (reine Typdeklarationen),
 *   3. `as const` und die Typannotationen weg,
 *   4. `SF4Cost(x)` durch einen Marker ersetzen.
 *
 * Punkt 4 ist der einzige inhaltliche: `SF4Cost` liefert im Spiel eine
 * Funktion, die den Spielerzustand liest (BitNode 4 -> voller Preis, SF4-Level
 * 1 -> x16, Level 2 -> x4, Level 3 -> x1). Diese Auskunft haben wir hier nicht
 * und wollen sie auch nicht raten - der Marker haelt die BASIS fest, und der
 * Aufrufer sagt, welchen Faktor er meint.
 *
 * Aufruf (als Bibliothek):
 *   import { baueBaum, kosten } from "./ramkosten.js";
 *   const baum = baueBaum();
 *   kosten(baum, ["singularity", "getOwnedAugmentations"], { sf4: 1 });
 *
 * Aufruf (zum Nachsehen):
 *   node tools/ramkosten.js hack scan singularity.installAugmentations
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
export const QUELLE = path.join(ROOT, "reference", "v301", "src", "Netscript",
  "RamCostGenerator.ts");

/**
 * Ein Eintrag, dessen Preis vom SF4-Stand abhaengt. `basis` ist der Preis in
 * BitNode 4 bzw. ab SF4.3; alles andere ist ein Vielfaches davon.
 */
export class Sing {
  constructor(basis) { this.basis = basis; }
  /** @param {{bitNode?: number, sf4?: number}} lage */
  wert(lage = {}) {
    if (lage.bitNode === 4) return this.basis;
    const sf4 = lage.sf4 ?? 3;
    if (sf4 <= 1) return this.basis * 16;
    if (sf4 === 2) return this.basis * 4;
    return this.basis;
  }
}

/** Liest die TS-Datei und liefert `{RamCosts, RamCostConstants}`. */
export function baueBaum(quelle = QUELLE) {
  if (!fs.existsSync(quelle)) {
    throw new Error("RamCostGenerator.ts nicht gefunden: " + quelle);
  }
  let ts = fs.readFileSync(quelle, "utf8");

  // 1. Importe raus - sie zeigen auf Spielinterna, die es hier nicht gibt.
  ts = ts.replace(/^import .*$/gm, "");

  // 2. Typdeklarationen raus. Beide sind einzeilig bzw. zweizeilig und
  //    beginnen am Zeilenanfang; ein Regex ueber `{...}` waere hier gefaehrlich
  //    (die Datei ist voller geschweifter Klammern), deshalb zeilenweise bis
  //    zum ersten `};`.
  ts = ts.replace(/^export type RamCostTree<API> = \{[\s\S]*?^\};$/m, "");
  ts = ts.replace(/^type RamTreeGeneric = .*$/gm, "");

  // 3. `as const` und die Typannotationen der drei Exporte.
  ts = ts.replace(/\bas const\b/g, "");
  ts = ts.replace(/export const RamCosts: RamCostTree<NSFull> =/, "export const RamCosts =");
  ts = ts.replace(/function SF4Cost\(cost: number\): \(\) => number \{[\s\S]*?\n\}/,
    "function SF4Cost(cost) { return new Sing(cost); }");
  ts = ts.replace(/export function getRamCost\(tree: string\[\], throwOnUndefined = false\): number \{[\s\S]*$/,
    "");
  ts = ts.replace(/let obj: RamTreeGeneric = RamCosts;/, "let obj = RamCosts;");

  // 4. Auswerten. Die Datei enthaelt danach nur noch Objektliterale, Zahlen
  //    und einen Funktionsaufruf - kein Zugriff nach draussen.
  const fabrik = new Function("Sing", ts
    .replace(/^export /gm, "")
    + "\nreturn { RamCosts, RamCostConstants };");
  return fabrik(Sing);
}

/**
 * Der Preis eines Pfades, z. B. ["singularity", "getOwnedAugmentations"].
 *
 * Ein unbekannter Pfad kostet 0 - genau wie im Spiel (`getRamCost`:
 * "If no ram cost is defined (e.g. for removed functions), the cost is 0").
 * Das ist wichtig: `ns.print` und `ns.tprint` stehen nicht im Baum und sind
 * gratis, und ein Tippfehler im Skript kostet nichts, statt zu werfen.
 */
export function kosten(baum, pfad, lage = {}) {
  let obj = baum.RamCosts;
  for (const teil of pfad) {
    if (obj === undefined || obj === null) return 0;
    const next = obj[teil];
    if (next === undefined) return 0;
    if (next instanceof Sing) return next.wert(lage);
    if (typeof next === "object") { obj = next; continue; }
    if (typeof next === "function") return next();
    return next;
  }
  // Der Pfad endete auf einem Teilbaum, nicht auf einer Funktion.
  return 0;
}

/** Alle Blattnamen des Baums, flach: "hack", "singularity.travelToCity", ... */
export function alleNamen(baum) {
  const raus = [];
  const geh = (obj, praefix) => {
    for (const [k, v] of Object.entries(obj)) {
      const name = praefix ? praefix + "." + k : k;
      if (v && typeof v === "object" && !(v instanceof Sing)) geh(v, name);
      else raus.push(name);
    }
  };
  geh(baum.RamCosts, "");
  return raus;
}

// --- Aufruf von der Kommandozeile ------------------------------------------
// PORTABEL STATT "file:///" + argv[1] (26.09.2026, Nacharbeit Auftrag C,
// Begruendung in tools/ram.js an derselben Stelle): unter POSIX haette der
// alte Vergleich wegen des doppelten Slashes nie gestimmt und den ganzen
// Block stumm uebersprungen. `pathToFileURL` liefert auf jeder Plattform die
// URL, die `import.meta.url` fuer dieselbe Datei auch liefert.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const baum = baueBaum();
  const args = process.argv.slice(2);
  if (!args.length) {
    const namen = alleNamen(baum);
    console.log("");
    console.log("=== Kostenbaum aus RamCostGenerator.ts ===");
    console.log("  " + namen.length + " Eintraege, Basis "
      + baum.RamCostConstants.Base + " GB, Deckel " + baum.RamCostConstants.Max + " GB");
    console.log("  Singularity-Eintraege: "
      + namen.filter((n) => {
        const p = n.split(".");
        let o = baum.RamCosts;
        for (const t of p.slice(0, -1)) o = o[t];
        return o[p[p.length - 1]] instanceof Sing;
      }).length);
    console.log("");
    console.log("  Aufruf: node tools/ramkosten.js hack singularity.installAugmentations");
    console.log("");
  } else {
    console.log("");
    for (const a of args) {
      const pfad = a.split(".");
      console.log("  " + a.padEnd(42)
        + " SF4.1 " + String(kosten(baum, pfad, { sf4: 1 })).padStart(7)
        + "   SF4.3 " + String(kosten(baum, pfad, { sf4: 3 })).padStart(7)
        + "   BN4 " + String(kosten(baum, pfad, { bitNode: 4 })).padStart(7));
    }
    console.log("");
  }
}
