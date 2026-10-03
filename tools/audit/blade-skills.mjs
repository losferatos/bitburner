// Audit 03.10.2026 (BLADE): Was haetten die Skillpunkte in Datamancer
// anderswo gebracht? Und wie bewertet blade.js Datamancer (relNutzen mit
// schaetzNot aus der ROHEN Spanne, blade.js:1163-1194, 1335-1350)?
// Formeln: blade-formeln.mjs (geeicht). Aufruf:
//   node tools/audit/blade-skills.mjs [backupdatei]
import path from "node:path";
import { ladeSpielstand, flach } from "./blade-lage.mjs";
import { AKTIONEN, SKILLS, successChance, successRange, actionTime, skillCost, rankGain, rankLoss } from "./blade-formeln.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const datei = process.argv[2] || "LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz";
const { p } = ladeSpielstand(path.join(root, "backups", path.basename(datei)));
const bb = flach(p.bladeburner);
const P = { skills: p.skills, mults: p.mults };
const city = bb.cities[bb.city];
const lvl = (n) => (bb.contracts[n] || bb.operations[n] || { level: 1 }).level;
const mkBB = (skills) => ({ skills, stamina: bb.maxStamina, maxStamina: bb.maxStamina, staminaBonus: bb.staminaBonus });

const TY = AKTIONEN["Operation Typhoon"], RAID = AKTIONEN.Raid, RET = AKTIONEN.Retirement;
function kennzahlen(skills) {
  const B = mkBB(skills);
  const ty = successChance(TY, 1, P, B, city);
  const pr = successChance(RAID, lvl("Raid"), P, B, city);
  const evRaid = pr * rankGain(RAID, lvl("Raid")) - (1 - pr) * rankLoss(RAID, lvl("Raid"));
  const tRaid = actionTime(RAID, lvl("Raid"), P, B);
  const pRet = successChance(RET, lvl("Retirement"), P, B, city);
  return { ty, pr, evRaidMin: 60 * evRaid / tRaid, pRet };
}
// Datamancer-Kosten bis zur jetzigen Stufe
const dm = bb.skills["Datamancer"] || 0;
let dmKosten = 0;
for (let i = 0; i < dm; i++) dmKosten += skillCost("Datamancer", i);
console.log("Skills", JSON.stringify(bb.skills), "totalSP", bb.totalSkillPoints, "Datamancer", dm, "Kosten", dmKosten, "SP =", (100 * dmKosten / bb.totalSkillPoints).toFixed(1) + " %");

const jetzt = kennzahlen(bb.skills);
// Gegenentwurf: Datamancer 0, die Punkte gierig nach d ln(Typhoon-competence) / Preis
const alt = { ...bb.skills, Datamancer: 0 };
let rest = dmKosten;
const KANDIDATEN = ["Blade's Intuition", "Digital Observer", "Short-Circuit", "Reaper", "Evasive System", "Tracer", "Cloak"];
const ziel = (s) => { const k = kennzahlen(s); return Math.log(k.ty) + 0.5 * Math.log(k.evRaidMin); };   // Tor + Rangrate
for (;;) {
  let best = null;
  const basis = ziel(alt);
  for (const n of KANDIDATEN) {
    const L = alt[n] || 0;
    const c = skillCost(n, L);
    if (c > rest) continue;
    const s2 = { ...alt, [n]: L + 1 };
    const wert = (ziel(s2) - basis) / c;
    if (!best || wert > best.wert) best = { n, c, wert };
  }
  if (!best) break;
  alt[best.n] = (alt[best.n] || 0) + 1;
  rest -= best.c;
}
const nachher = kennzahlen(alt);
console.log("Gegenentwurf", JSON.stringify(alt), "Rest-SP", rest);
console.log("Typhoon-Chance   jetzt", jetzt.ty.toFixed(4), " ohne Datamancer", nachher.ty.toFixed(4), " Faktor", (nachher.ty / jetzt.ty).toFixed(3));
console.log("Raid-Chance      jetzt", jetzt.pr.toFixed(4), " ohne Datamancer", nachher.pr.toFixed(4));
console.log("Raid Rang/min    jetzt", jetzt.evRaidMin.toFixed(2), " ohne Datamancer", nachher.evRaidMin.toFixed(2), " Faktor", (nachher.evRaidMin / jetzt.evRaidMin).toFixed(3));
console.log("Retirement-Chance jetzt", jetzt.pRet.toFixed(4), " ohne Datamancer", nachher.pRet.toFixed(4));

// Was relNutzen dem Bot sagt: schaetzNot aus der rohen Spanne (blade.js:1335-1350)
const B0 = mkBB(bb.skills);
let breit = 0;
for (const n of ["Investigation", "Undercover Operation", "Sting Operation", "Raid", "Stealth Retirement Operation", "Assassination", "Tracking", "Bounty Hunter", "Retirement"]) {
  const [lo, hi] = successRange(AKTIONEN[n], lvl(n), P, B0, city);
  breit = Math.max(breit, hi - lo);
}
const schaetzNot = Math.max(0, Math.min(1, (breit - 0.1) / 0.9));
const relDM = (100 * 5 / (100 + 5 * dm)) * schaetzNot;
const preisDM = skillCost("Datamancer", dm);
const relBI = 100 * ((1 + (alt["Blade's Intuition"] >= 0 ? (bb.skills["Blade's Intuition"] || 0) : 0) * 0.03 + 0.03) / (1 + (bb.skills["Blade's Intuition"] || 0) * 0.03) - 1);
const preisBI = skillCost("Blade's Intuition", bb.skills["Blade's Intuition"] || 0);
console.log("Bot-Sicht: breiteste rohe Spanne", breit.toFixed(3), "schaetzNot", schaetzNot.toFixed(3),
  "Datamancer relNutzen", relDM.toFixed(3), "/ Preis", preisDM, "=", (relDM / preisDM).toFixed(4),
  "| Blade's Intuition", relBI.toFixed(3), "/", preisBI, "=", (relBI / preisBI).toFixed(4), "(x Abdeckung 1 x klemmFaktor 1)");
