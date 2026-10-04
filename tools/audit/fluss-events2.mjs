// FLUSS-EVENTS2 (Audit 04.10.2026): Welche Ereignisarten tragen die Eintraege im Strom, und wer schreibt `install`/`gate`/`penalty`?
//
// Frage: lib/events.js beschneiden() haelt Eintraege der Klasse `bleibt` (jump, install, penalty, gate) bis zu 60.
// Gemessen (fluss-events.mjs): im Strom stehen trotz 15 Knotenwechseln hoechstens 1 jump und nie ein install/gate/penalty.
// Dieses Skript zeigt (a) die Eintraege der bleibenden Arten im neuesten Stand, (b) die Haeufigkeit der Arten, (c) im
// Quelltext jeden Schreiber, der `art: "install"|"jump"|"gate"|"penalty"` setzt oder anhaengen() mit dieser Art ruft, und
// (d) jeden Schreiber, der den Strom selbst kuerzt (shift/slice/splice auf eintraege) statt lib/events.js zu benutzen.
//
// Eichung: die Zahl der Knotenwechsel kommt aus backups/INDEX.tsv (fluss-events.mjs); hier wird nur im Quelltext gesucht.
//
// Aufruf: node tools/audit/fluss-events2.mjs [<datei.json.gz>]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neuesterStand, homeTextdateien } from "./fluss-save.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const arg = process.argv[2] && process.argv[2].endsWith(".gz") ? process.argv[2] : neuesterStand();
const tf = homeTextdateien(arg);
console.log("Spielstand:", path.basename(arg));
const strom = JSON.parse(tf.get("data/events.json"));
const haeufig = {};
for (const e of strom.eintraege) haeufig[e.art] = (haeufig[e.art] || 0) + 1;
console.log("Arten im Strom:", JSON.stringify(haeufig), " gesamt", strom.eintraege.length);
for (const e of strom.eintraege) {
  if (["jump", "install", "gate", "penalty"].includes(e.art)) console.log("  ", e.art, new Date(e.wall).toISOString(), e.text);
}
const aeltest = strom.eintraege[0];
console.log("aeltester:", new Date(aeltest.wall).toISOString(), aeltest.art);
const notes = strom.eintraege.filter((e) => e.art === "note");
const spanne = (notes[notes.length - 1].wall - notes[0].wall) / 3600000;
console.log("note-Eintraege:", notes.length, "ueber", spanne.toFixed(1), "h =", (notes.length / spanne).toFixed(1), "pro Stunde");

function dateien(dir, rel = "") {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? rel + "/" + e.name : e.name;
    if (e.isDirectory()) out.push(...dateien(dir, r)); else if (r.endsWith(".js")) out.push(r);
  }
  return out;
}
const src = path.join(ROOT, "src");
console.log("\nSchreiber der bleibenden Arten (Quelltext):");
for (const f of dateien(src)) {
  const zeilen = fs.readFileSync(path.join(src, f), "utf8").split(/\r?\n/);
  zeilen.forEach((z, i) => {
    if (/anhaengen\([^)]*["'](jump|install|gate|penalty)["']/.test(z) || /art:\s*["'](jump|install|gate|penalty)["']/.test(z) || /evAnhaengen\([^)]*["'](jump|install|gate|penalty)["']/.test(z)) {
      console.log("  ", f + ":" + (i + 1), z.trim().slice(0, 140));
    }
  });
}
console.log("\nSchreiber, die den Strom selbst kuerzen (eintraege.shift/slice/splice oder length =):");
for (const f of dateien(src)) {
  if (f === "lib/events.js") continue;
  const zeilen = fs.readFileSync(path.join(src, f), "utf8").split(/\r?\n/);
  zeilen.forEach((z, i) => {
    if (/eintraege\s*=\s*[^;]*\.slice\(|eintraege\.(shift|splice)\(|eintraege\.length\s*>\s*\d+|while\s*\([^)]*eintraege\.length/.test(z)) {
      console.log("  ", f + ":" + (i + 1), z.trim().slice(0, 140));
    }
  });
}
