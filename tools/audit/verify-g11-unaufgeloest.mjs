// Gegenpruefung G11 (BLADE-2): Welche Aktionen sind fuer spanneGenau() unaufloesbar (r<1, s.min==0), und was waere
// ihre wahre Chance / ihr Erwartungswert je Versuch? Zeigt, ob die Unschaerfe fuer Entscheidungen relevant ist.
import fs from "node:fs";
import path from "node:path";
import { ladeSpielstand, flach } from "./blade-lage.mjs";
import { AKTIONEN, successRange, rankGain, rankLoss } from "./blade-formeln.mjs";
import { root } from "./verify-g11-lib.mjs";
const idx = fs.readFileSync(path.join(root, "backups", "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((z) => z.split("\t"));
const NAMEN = ["Investigation", "Undercover Operation", "Sting Operation", "Raid", "Stealth Retirement Operation", "Assassination", "Tracking", "Bounty Hunter", "Retirement"];
for (const z of idx) {
  if (!z[1].includes("BN2L1")) continue;
  const { p } = ladeSpielstand(path.join(root, "backups", z[1]));
  const bb = flach(p.bladeburner); if (!bb) continue;
  const P = { skills: p.skills, mults: p.mults }; const city = bb.cities[bb.city];
  const B = { skills: bb.skills, stamina: bb.stamina, maxStamina: bb.maxStamina, staminaBonus: bb.staminaBonus };
  const r = city.pop / city.popEst; const out = [];
  for (const nm of NAMEN) {
    const a = AKTIONEN[nm]; const o = (bb.contracts[nm] || bb.operations[nm]); const lvl = o.level;
    const [lo, hi, real] = successRange(a, lvl, P, B, city);
    if (r < 1 && lo === 0 && o.count >= 1) out.push(nm.slice(0, 6) + " L" + lvl + " [" + lo.toFixed(2) + "-" + hi.toFixed(2) + "] wahr " + real.toFixed(2) + " EV/Versuch " + (real * rankGain(a, lvl) - (1 - real) * rankLoss(a, lvl)).toFixed(1) + " Vorrat " + o.count.toFixed(0));
  }
  if (out.length) console.log(z[1].slice(22, 46), "r", r.toFixed(2), "|", out.join(" ; "));
}
