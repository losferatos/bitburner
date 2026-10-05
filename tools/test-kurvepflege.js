/**
 * Referenzkurve wird nach einem schnelleren, abgeschlossenen Lauf nachgezogen
 * (Befund 05.10.2026: BN2.3 rechnete mit BN2.1 = 29,1 h statt BN2.2 = 19,8 h).
 *
 * Gegen den alten Stand ROT: tools/lib/kurvepflege.js fehlt, checkin.js ruft
 * nichts auf.
 *
 * Aufruf: node tools/test-kurvepflege.js [repo-verzeichnis]
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

console.log("\n=== Referenzkurve nachziehen ===\n");

const lib = path.join(ROOT, "tools", "lib", "kurvepflege.js");
let kurveErsetzen = null;
if (fs.existsSync(lib)) ({ kurveErsetzen } = await import(pathToFileURL(lib).href));
pruefe("tools/lib/kurvepflege.js vorhanden", typeof kurveErsetzen === "function");

const kurve = (start, max, dauerH, n = 30) => ({
  rangSpanne: [start, max], dauerH,
  punkte: Array.from({ length: n }, (_, i) => ({ h: (dauerH * i) / (n - 1), rang: start + ((max - start) * i) / (n - 1) })),
});
const BN21 = kurve(68, 488516, 29.087);
const BN22 = kurve(6, 550010, 19.79);

if (kurveErsetzen) {
  pruefe("BN2.2 (19,8 h) ersetzt BN2.1 (29,1 h) - der Befund", kurveErsetzen(BN21, BN22).ersetzen);
  pruefe("BN2.1 ersetzt BN2.2 nicht (langsamer)", !kurveErsetzen(BN22, BN21).ersetzen);
  pruefe("gleich schnell: kein Ersatz", !kurveErsetzen(BN22, kurve(6, 550010, 19.78)).ersetzen);
  pruefe("Bruchstueck ohne Anlauf (Start 5.297) verworfen", !kurveErsetzen(BN21, kurve(5297, 4560000, 3)).ersetzen);
  pruefe("Lauf ohne Ausgang (max 48.635) verworfen", !kurveErsetzen(BN21, kurve(6, 48635, 2)).ersetzen);
  pruefe("Kandidat mit unter 5 Punkten verworfen", !kurveErsetzen(BN21, kurve(6, 550010, 10, 4)).ersetzen);
  pruefe("fehlende alte Kurve: vollstaendiger Kandidat wird genommen", kurveErsetzen(null, BN22).ersetzen);
  pruefe("unvollstaendige alte Kurve: vollstaendiger Kandidat wird genommen", kurveErsetzen(kurve(6, 48635, 2), BN21).ersetzen);
}

// Bonuszeit-Vorrat (05.10.2026): BN2.2, Sicherung 04:49 mit 98.281 Zyklen.
let effektiveSpielzeit = null;
if (fs.existsSync(lib)) ({ effektiveSpielzeit } = await import(pathToFileURL(lib).href));
pruefe("effektiveSpielzeit vorhanden", typeof effektiveSpielzeit === "function");
if (effektiveSpielzeit) {
  pruefe("98.281 Zyklen = 5,46 h werden abgezogen",
    Math.abs((1116.25 * 3.6e6 - effektiveSpielzeit(1116.25 * 3.6e6, 98281)) / 3.6e6 - 5.4601) < 0.001);
  pruefe("ohne Vorrat unveraendert", effektiveSpielzeit(1000, 0) === 1000 && effektiveSpielzeit(1000, undefined) === 1000);
  pruefe("negativer Vorrat zaehlt nicht", effektiveSpielzeit(1000, -5) === 1000);
}
const bauer = fs.readFileSync(path.join(ROOT, "tools", "rangkurve-bauen.js"), "utf8");
pruefe("rangkurve-bauen.js zieht den Vorrat bei Sicherungen ab",
  bauer.includes("effektiveSpielzeit(p.totalPlaytime, sc)"));

const checkin = fs.readFileSync(path.join(ROOT, "tools", "checkin.js"), "utf8");
const iAuf = checkin.indexOf("kurveAuffrischen(ROOT, knoten)");
const iLes = checkin.indexOf("restzeitAusKurve(knoten, rang)");
pruefe("checkin.js frischt die Kurve auf", iAuf >= 0);
pruefe("... und zwar VOR dem ersten Lesen (Cache in lib/rangkurve.js)", iAuf >= 0 && iLes > iAuf);

console.log("\n=== " + gruen + " gruen, " + rot + " rot ===\n");
process.exit(rot ? 1 : 0);
