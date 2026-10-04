// Gegenpruefung G11 (BLADE-2): Rangertrag der Umverteilung, getrennt nach Vorratsgrenze.
// Raid ist vorratsbegrenzt (Wachstum 2,1 je 480 s = 15,75/h Naturzuwachs, plus Infiltrate); dann zaehlt der
// Erwartungswert JE VERSUCH (p*Gewinn - (1-p)*Verlust), nicht die Rate je Zeit. Zeit-/Ausdauergrenze nur bei freiem Vorrat.
// Verteilungen: Ist (Spielstand), fixDM / fixBoth aus verify-g11-sim.mjs (Regelnachbildung) - hier als Parameter.
// Aufruf: node tools/audit/verify-g11-rang.mjs
import path from "node:path";
import { ladeSpielstand, flach } from "./blade-lage.mjs";
import { AKTIONEN, successChance, actionTime, rankGain, rankLoss, staminaCost, maxStamina, staminaGainPerSecond } from "./blade-formeln.mjs";
import { root } from "./verify-g11-lib.mjs";

const datei = "LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz";
const { p } = ladeSpielstand(path.join(root, "backups", datei));
const bb = flach(p.bladeburner);
const P = { skills: p.skills, mults: p.mults };
const city = bb.cities[bb.city];
const L = (n) => (bb.contracts[n] || bb.operations[n]).level;
// Verteilungen aus verify-g11-sim.mjs bei 09:59 (Ist = Spielstand; sim = Nachbildung der Regel)
const ist = bb.skills;
const fixDM = { ...ist, Datamancer: 0, "Short-Circuit": 9, "Digital Observer": 11, "Blade's Intuition": 8, Reaper: 5, "Evasive System": 5, Cloak: 4, Tracer: 10, "Cyber's Edge": 5 };
const fixBoth = { ...ist, Datamancer: 0, Tracer: 5, "Short-Circuit": 10, "Digital Observer": 12, "Blade's Intuition": 9, Reaper: 5, "Evasive System": 5, Cloak: 5, "Cyber's Edge": 5 };
const V = { Ist: ist, fixDM, fixBoth };
const NAT = 2.1 / 480 * 3600;   // Raid-Vorrat Naturzuwachs je Stunde
console.log("Raid L" + L("Raid") + " in Sector-12 (pop/popEst r=" + (city.pop / city.popEst).toFixed(3) + "), Vorratsbegrenzt: " + NAT.toFixed(2) + " Versuche/h Naturzuwachs");
for (const [name, lv] of Object.entries(V)) {
  const B0 = { skills: lv, stamina: 1, maxStamina: 1, staminaBonus: bb.staminaBonus };
  const mx = maxStamina(P, B0); const B = { ...B0, stamina: mx, maxStamina: mx };
  const out = {};
  for (const n of ["Raid", "Retirement", "Bounty Hunter", "Tracking"]) {
    const A = AKTIONEN[n]; const pr = successChance(A, L(n), P, B, city);
    const ev = pr * rankGain(A, L(n)) - (1 - pr) * rankLoss(A, L(n));
    const T = actionTime(A, L(n), P, B);
    out[n] = { p: pr, ev, T, evMin: 60 * ev / T };
  }
  const tx = successChance(AKTIONEN["Operation Typhoon"], 1, P, B, city);
  console.log(name.padEnd(8), "Typhoon", tx.toFixed(4), "| Raid p", out.Raid.p.toFixed(4), "EV/Versuch", out.Raid.ev.toFixed(2), "(vorratsbegrenzt " + (NAT * out.Raid.ev).toFixed(0) + " Rang/h), Zeit", out.Raid.T + "s",
    "| Retirement p", out.Retirement.p.toFixed(3), "EV", out.Retirement.ev.toFixed(2), "/Versuch", out.Retirement.T + "s", "| Tracking p", out.Tracking.p.toFixed(3), "| Bounty Hunter p", out["Bounty Hunter"].p.toFixed(3));
}
