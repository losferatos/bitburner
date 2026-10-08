/**
 * Mindestbetrag der Investorenrunden nach langer Verschiebung (08.10.2026, BN3.3).
 * Runde 4 hing ab 8,85 h Corp-Zeit an einem festen Boden von 2,5 Bio bei 0,73 Bio
 * Bewertung. Gegen den alten Stand ROT. Aufruf: node tools/test-rundenboden.js [repo]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.argv[2] ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let gruen = 0, rot = 0;
const pruefe = (name, ok, info = "") => {
  if (ok) { gruen++; console.log("  ok    " + name + (info ? "  (" + info + ")" : "")); }
  else { rot++; console.log("  ROT   " + name + (info ? " - " + info : "")); }
};
console.log("\n=== Rundenboden ===\n");
const src = fs.readFileSync(path.join(ROOT, "src", "corp.js"), "utf8").replace(/\r/g, "");
const m = src.match(/export function roundFloor\(baseMin, shiftH, isLastRound\) \{[\s\S]*?\n\}/);
pruefe("roundFloor vorhanden", !!m);
const roundFloor = m ? new Function("return " + m[0].replace("export ", ""))() : () => NaN;
pruefe("ohne Verschiebung voller Boden", roundFloor(5e12, 0) === 5e12);
pruefe("bis 1 h voller Boden", roundFloor(5e12, 1) === 5e12);
pruefe("1-2 h halber Boden", roundFloor(5e12, 1.5) === 2.5e12 && roundFloor(5e12, 2) === 2.5e12);
pruefe("ueber 2 h in der letzten Runde kein fester Boden (BN3.3: Runde 4 seit ~3 h verschoben)", roundFloor(5e12, 2.25, true) === 0 && roundFloor(5e12, 3, true) === 0);
pruefe("ueber 2 h in Runden 1-3 ein Viertel Boden", roundFloor(500e9, 3, false) === 125e9);
pruefe("tryRound nutzt roundFloor", src.includes('let min = roundFloor(this.cfg("roundMin", ROUND_MIN_FUNDS)[k], st.roundShift[k], k === MAX_ROUND - 1);'));
pruefe("Bestangebot-Regel bleibt", src.includes('if (!noFix(st, "bestOffer")) min = Math.max(min, 0.9 * (st.bestOffer || 0));'));
console.log("\n=== " + gruen + " gruen, " + rot + " rot ===");
process.exit(rot ? 1 : 0);
