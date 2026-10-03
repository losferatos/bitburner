// Audit 03.10.2026 (BLADE): Skillverteilung des Bots gegen eine gierige
// Verteilung derselben Punkte. Ziel J = ln(Typhoon-Chance) + ln(Dauer-Rangrate),
// Dauer-Rangrate = Anteil_Raid * Raid + Anteil_Vertrag * Retirement (je mit
// Ausdauerbegrenzung + Kammer, wie blade-stadt.mjs). Anteile aus dem
// Aktionsprotokoll BN2L1 (Raid 1530 von 1735 Rang = 0,88).
// Hyperdrive bleibt auf Bot-Stufe (Erfahrungswirkung nicht modelliert).
// Aufruf: node tools/audit/blade-skillmix.mjs [backupdatei] [anteilRaid]
import path from "node:path";
import { ladeSpielstand, flach } from "./blade-lage.mjs";
import { AKTIONEN, SKILLS, successChance, actionTime, skillCost, rankGain, rankLoss, staminaCost, maxStamina, staminaGainPerSecond } from "./blade-formeln.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const datei = process.argv[2] || "LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz";
const anteilRaid = Number(process.argv[3]) || 0.88;
const { p } = ladeSpielstand(path.join(root, "backups", path.basename(datei)));
const bb = flach(p.bladeburner);
const P = { skills: p.skills, mults: p.mults };
const city = bb.cities[bb.city];
const lvl = (n) => (bb.contracts[n] || bb.operations[n] || { level: 1 }).level;

function dauerRate(a, skills) {
  const B0 = { skills, stamina: 1, maxStamina: 1, staminaBonus: bb.staminaBonus };
  const mx = maxStamina(P, B0);
  const B = { ...B0, stamina: mx, maxStamina: mx };
  const R = staminaGainPerSecond(P, B, mx), H = mx * 0.01 / 60;
  const L = lvl(a === AKTIONEN.Raid ? "Raid" : "Retirement");
  const pr = successChance(a, L, P, B, city);
  const g = pr * rankGain(a, L) - (1 - pr) * rankLoss(a, L);
  const T = actionTime(a, L, P, B);
  const v = staminaCost(a, L) / T;
  const w = v <= R ? 1 : (R + H) / (v + H);
  return 60 * w * g / T;
}
function J(skills) {
  const B = { skills, stamina: 1, maxStamina: 1 };
  const ty = successChance(AKTIONEN["Operation Typhoon"], 1, P, B, city);
  const rr = anteilRaid * dauerRate(AKTIONEN.Raid, skills) + (1 - anteilRaid) * dauerRate(AKTIONEN.Retirement, skills);
  return { J: Math.log(ty) + Math.log(rr), ty, rr };
}
const gesamt = Object.entries(bb.skills).reduce((n, [s, l]) => { let c = 0; for (let i = 0; i < l; i++) c += skillCost(s, i); return n + c; }, 0) + bb.skillPoints;
const fix = { Hyperdrive: bb.skills.Hyperdrive || 0 };
let rest = gesamt; for (let i = 0; i < fix.Hyperdrive; i++) rest -= skillCost("Hyperdrive", i);
const greedy = { ...fix };
const KAND = ["Blade's Intuition", "Digital Observer", "Short-Circuit", "Reaper", "Evasive System", "Tracer", "Cloak", "Overclock", "Cyber's Edge"];
for (;;) {
  const basis = J(greedy).J;
  let best = null;
  for (const n of KAND) {
    const L = greedy[n] || 0;
    if (SKILLS[n].maxLvl && L >= SKILLS[n].maxLvl) continue;
    const c = skillCost(n, L);
    if (c > rest) continue;
    const w = (J({ ...greedy, [n]: L + 1 }).J - basis) / c;
    if (!best || w > best.w) best = { n, c, w };
  }
  if (!best) break;
  greedy[best.n] = (greedy[best.n] || 0) + 1; rest -= best.c;
}
const bot = J(bb.skills), gr = J(greedy);
console.log("SP gesamt (ausgegeben + offen)", gesamt, "Anteil Raid", anteilRaid);
console.log("Bot    ", JSON.stringify(bb.skills), "offen", bb.skillPoints);
console.log("Gierig ", JSON.stringify(greedy), "Rest", rest);
console.log("Typhoon-Chance  Bot", bot.ty.toFixed(4), "gierig", gr.ty.toFixed(4), "Faktor", (gr.ty / bot.ty).toFixed(3));
console.log("Dauer-Rang/min  Bot", bot.rr.toFixed(3), "gierig", gr.rr.toFixed(3), "Faktor", (gr.rr / bot.rr).toFixed(3));
const kosten = (s, l) => { let c = 0; for (let i = 0; i < l; i++) c += skillCost(s, i); return c; };
console.log("SP im Bot: Datamancer", kosten("Datamancer", bb.skills.Datamancer || 0), "Tracer", kosten("Tracer", bb.skills.Tracer || 0),
  "Cyber's Edge", kosten("Cyber's Edge", bb.skills["Cyber's Edge"] || 0), "Hyperdrive", kosten("Hyperdrive", bb.skills.Hyperdrive || 0));
