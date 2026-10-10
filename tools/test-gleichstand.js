/**
 * Gleichstand-Vergleich gegen den vorigen Lauf (Befund 10.10.2026).
 *
 * checkin.js las die Knotenzeit aus `netz.spielzeitImKnoten` und
 * `bericht.spielzeitImKnotenH` - beide schrieb niemand, der Vergleich lief nie
 * und konnte kein ZAEH melden. Dazu zaehlt die Referenzkurve ab ihrem ersten
 * Rangpunkt, nicht ab Knotenstart (BN11.1: 10,7 h spaeter) - ein Vergleich
 * mit der rohen Kurvenstunde haette jeden Lauf als zaeh gemeldet.
 *
 * Gegen den alten Stand ROT: vergleichMitReferenz ignoriert den Abstand,
 * checkin.js hat keine Knotenzeit-Quelle.
 *
 * Aufruf: node tools/test-gleichstand.js [repo-verzeichnis]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let gruen = 0, rot = 0;
const pruefe = (name, ok, info = "") => {
  if (ok) { gruen++; console.log("  ok    " + name); }
  else { rot++; console.log("  ROT   " + name + (info ? " - " + info : "")); }
};

console.log("\n=== Gleichstand gegen den vorigen Lauf ===\n");

// Zwei Wegwerf-Kurven unter Knotennummern, die es nicht gibt.
const doku = path.join(ROOT, "doku");
const mitAbstand = path.join(doku, "rangkurve-bn98.json");
const ohneAbstand = path.join(doku, "rangkurve-bn97.json");
const punkte = [{ h: 0, rang: 200 }, { h: 2, rang: 1000 }, { h: 10, rang: 500000 }];
fs.writeFileSync(mitAbstand, JSON.stringify({ nullpunkt: { hSeitKnotenstart: 10 }, punkte }));
fs.writeFileSync(ohneAbstand, JSON.stringify({ nullpunkt: {}, punkte }));
try {
  const { vergleichMitReferenz } = await import(pathToFileURL(path.join(ROOT, "tools", "lib", "rangkurve.js")).href);
  // Referenz: Rang 1000 bei Kurvenstunde 2 = 12 h nach Knotenstart.
  const v = vergleichMitReferenz(98, 1000, 6);
  pruefe("Abstand zum Knotenstart zaehlt mit (12 h Referenz)", v && Math.abs(v.hReferenz - 12) < 1e-9, JSON.stringify(v));
  pruefe("6 h gegen 12 h ist schneller (Faktor 0,5)", v && Math.abs(v.faktor - 0.5) < 1e-9);
  const z = vergleichMitReferenz(98, 1000, 20);
  pruefe("20 h gegen 12 h ist langsamer (Faktor > 1,5 -> ZAEH)", z && z.faktor > 1.5);
  pruefe("ohne bekannten Abstand kein Vergleich (kein falsches ZAEH)", vergleichMitReferenz(97, 1000, 6) === null);
} finally {
  fs.rmSync(mitAbstand, { force: true });
  fs.rmSync(ohneAbstand, { force: true });
}

const bauer = fs.readFileSync(path.join(ROOT, "tools", "rangkurve-bauen.js"), "utf8");
pruefe("rangkurve-bauen.js schreibt den Abstand zum Knotenstart", bauer.includes("hSeitKnotenstart,")
  && bauer.includes("playtimeSinceLastBitnode"));

const checkin = fs.readFileSync(path.join(ROOT, "tools", "checkin.js"), "utf8");
pruefe("checkin.js holt die Knotenzeit aus der Sicherung",
  checkin.includes("knotenStundenAusSicherung(knoten, laufJetzt, spielzeit)"));
pruefe("... und nicht mehr aus dem nie geschriebenen Feld", !checkin.includes("netz.spielzeitImKnoten"));

console.log("\n=== " + gruen + " gruen, " + rot + " rot ===\n");
process.exit(rot ? 1 : 0);
