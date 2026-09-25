/**
 * Baut die V1-Referenzkurve eines abgeschlossenen Hackinglaufs von Hand.
 * tools/checkin.js tut das selbst, sobald der naechste Lauf desselben Knotens
 * laeuft; Begruendung und Grenzen: tools/lib/v1kurve.js.
 *
 * Aufruf: node tools/v1kurve-bauen.js <knoten> <lauf>
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { baueKurve } from "./lib/v1kurve.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const knoten = Number(process.argv[2]), lauf = Number(process.argv[3]);
if (!Number.isFinite(knoten) || !Number.isFinite(lauf)) {
  console.log("Aufruf: node tools/v1kurve-bauen.js <knoten> <lauf>");
  process.exit(1);
}
const r = baueKurve(ROOT, knoten, lauf);
if (!r.kurve) { console.log(r.grund); process.exit(1); }
const k = r.kurve;
console.log("BN" + knoten + "." + lauf + ": " + k.punkte.length + " Punkte, online " + k.gesamtH + " h, Wanduhr "
  + k.wandH + " h, Hoechststand " + k.punkte[k.punkte.length - 1].maxLevel + " -> data/v1kurve-BN" + knoten + ".json");
