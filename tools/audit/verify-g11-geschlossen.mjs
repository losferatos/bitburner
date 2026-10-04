// Gegenpruefung G11 (BLADE-2): Prueft die geschlossene Form fuer die von chanceAusR() (blade.js:2449) nicht
// aufgeloesten Faelle: r<1, s.min==0, s.max<1  =>  s.max == est (Action.ts:144-167), wahre Chance = est * r^0,7
// (Bevoelkerungsfaktor (pop/1e9)^0,7 geht in competence genau einmal ein, Action.ts:88-92).
// Vergleich gegen den geeichten Nachbau successChance() (blade-formeln.mjs) auf allen Staenden/Aktionen.
import fs from "node:fs";
import path from "node:path";
import { ladeSpielstand, flach } from "./blade-lage.mjs";
import { AKTIONEN, successRange, successChance } from "./blade-formeln.mjs";
import { root } from "./verify-g11-lib.mjs";
const idx = fs.readFileSync(path.join(root, "backups", "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((z) => z.split("\t"));
const NAMEN = ["Investigation", "Undercover Operation", "Sting Operation", "Raid", "Stealth Retirement Operation", "Assassination", "Tracking", "Bounty Hunter", "Retirement"];
let n = 0, maxAbw = 0, nUnaufl = 0, nGeklemmt = 0;
for (const z of idx) {
  if (!z[1].includes("BN2L")) continue;
  const { p } = ladeSpielstand(path.join(root, "backups", z[1]));
  const bb = flach(p.bladeburner); if (!bb) continue;
  const P = { skills: p.skills, mults: p.mults }; const city = bb.cities[bb.city];
  const B = { skills: bb.skills, stamina: bb.stamina, maxStamina: bb.maxStamina, staminaBonus: bb.staminaBonus };
  const r = city.pop / city.popEst;
  for (const nm of NAMEN) {
    const a = AKTIONEN[nm]; const lvl = (bb.contracts[nm] || bb.operations[nm]).level;
    const [lo, hi, real] = successRange(a, lvl, P, B, city);
    if (r < 1 && lo === 0) {
      nUnaufl++;
      if (hi < 1) { const gesch = hi * Math.pow(r, 0.7); const w = successChance(a, lvl, P, B, city); n++; maxAbw = Math.max(maxAbw, Math.abs(gesch - w)); }
      else nGeklemmt++;
    }
  }
}
console.log("Faelle r<1 und s.min=0:", nUnaufl, "| davon s.max<1 (geschlossene Form moeglich):", n, "| max |Form - Nachbau|:", maxAbw.toExponential(2), "| s.max auf 1 geklemmt (unloesbar aus dem Paar):", nGeklemmt);
