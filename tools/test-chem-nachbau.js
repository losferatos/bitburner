/**
 * Chemical-Division nach allen Investorenrunden (08.10.2026, BN3.3): ohne Chem
 * klemmte die Pflanzenqualitaet bei 10,8 und damit das Produkt-Rating; die
 * Kassenschwelle 363 Mrd wurde nie erreicht. Gegen den alten Stand ROT.
 * Aufruf: node tools/test-chem-nachbau.js [repo]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.argv[2] ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let gruen = 0, rot = 0;
const pruefe = (name, ok) => { if (ok) { gruen++; console.log("  ok    " + name); } else { rot++; console.log("  ROT   " + name); } };
console.log("\n=== Chem nach allen Runden ===\n");
const src = fs.readFileSync(path.join(ROOT, "src", "corp.js"), "utf8").replace(/\r/g, "");
const m = src.match(/name: "Chemical",[\s\S]*?cond: ([\s\S]*?),\n\s*cost:/);
pruefe("Chemical-Schritt gefunden", !!m);
const expr = m ? m[1] : "false";
const cond = (z) => new Function("st", "chem", "chemIncomplete", "MAX_ROUND",
  "const self = this; return !!(" + expr.replace(/this\./g, "self.") + ");").call(z.self, z.st, z.chem, z.inc, 4);
const self = (funds, cfg = {}) => ({ funds, etappe: () => 3, cfg: (k, d) => (k in cfg ? cfg[k] : d) });
pruefe("BN3.3-Lage: Stufe tob, Kasse 67 Mrd, Runden 4/4, kein Chem -> bauen",
  cond({ self: self(67e9), st: { stage: "tob", roundsDone: 4 }, chem: null, inc: false }) === true);
pruefe("gesunder Lauf vor Runde 4: Stufe tob, Kasse 67 Mrd, Runden 3 -> weiter opportunistisch (nein)",
  cond({ self: self(67e9), st: { stage: "tob", roundsDone: 3 }, chem: null, inc: false }) === false);
pruefe("Kasse ueber 363 Mrd -> bauen (alte Regel bleibt)",
  cond({ self: self(400e9), st: { stage: "tob", roundsDone: 2 }, chem: null, inc: false }) === true);
pruefe("Schalter chem:false schaltet ab",
  cond({ self: self(67e9, { chem: false }), st: { stage: "tob", roundsDone: 4 }, chem: null, inc: false }) === false);
pruefe("chemFunds per Konfig", cond({ self: self(67e9, { chemFunds: 50e9 }), st: { stage: "tob", roundsDone: 1 }, chem: null, inc: false }) === true);
pruefe("Chem fertig -> kein Schritt", cond({ self: self(67e9), st: { stage: "tob", roundsDone: 4 }, chem: {}, inc: false }) === false);
console.log("\n=== " + gruen + " gruen, " + rot + " rot ===");
process.exit(rot ? 1 : 0);
