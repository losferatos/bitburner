// Audit 03.10.2026 (BLADE): Erwartungswert je Sleeve-Vertrag (sleeve.js waehlt
// nach Vorrat, sleeve.js:788-828) gegen Field Analysis (0,1*BladeburnerRank je 30 s,
// Bladeburner.ts:1122-1151, statunabhaengig). Sleeve-Chance: Spieler-Skills und
// Spieler-Ausdauerstrafe, Werte des Sleeves (Action.ts:169-196 mit person=sleeve).
import path from "node:path";
import { ladeSpielstand, flach } from "./blade-lage.mjs";
import { AKTIONEN, successChance, actionTime, rankGain } from "./blade-formeln.mjs";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const datei = process.argv[2] || "LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz";
const { p } = ladeSpielstand(path.join(root, "backups", path.basename(datei)));
const bb = flach(p.bladeburner);
const city = bb.cities[bb.city];
const B = { skills: bb.skills, stamina: bb.maxStamina, maxStamina: bb.maxStamina };
for (const [i, s0] of (p.sleeves || []).entries()) {
  const s = flach(s0);
  const S = { skills: s.skills, mults: { bladeburner_success_chance: 1 } };
  const z = [];
  for (const n of ["Tracking", "Bounty Hunter", "Retirement"]) {
    const a = AKTIONEN[n], L = bb.contracts[n].level;
    const pr = successChance(a, L, S, B, city);
    const T = actionTime(a, L, S, B);
    z.push(n + " L" + L + " p " + pr.toFixed(3) + " T " + T + "s Rang/min " + (60 * pr * rankGain(a, L) / T).toFixed(3));
  }
  console.log("Sleeve " + i + " (str " + s.skills.strength + " dex " + s.skills.dexterity + " cha " + s.skills.charisma + " Schock " + s.shock.toFixed(1) + "): " + z.join(" | ") + " | Field Analysis 0.200");
}
