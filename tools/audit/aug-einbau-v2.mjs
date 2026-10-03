// Audit 03.10.2026, Bereich AUG: Lohnt ein Einbau im Kampfknoten (V2)?
//
// Was ein Einbau tut (reference/bitburner-src/src):
//   PlayerObjectGeneralMethods.ts:80-141  Skills -> 1, Exp -> 0 (alle sechs),
//     Geld -> 1000 + Donations, Hacknet-Server und Hash-Upgrades weg (:130-131),
//     Sleeves: shockRecovery/synchronize (Auftrag weg, :122)
//   Prestige.ts:55-199  Faktionsruf -> Favor, Bladeburner nur resetAction (:152-155)
//   Bladeburner.ts:259-263  Rang/Faehigkeiten bleiben, Faktion wird neu betreten
//   Prestige.ts:328-339  der SF9.3-Gratisserver kommt NUR beim Knotenwechsel
//
// Modell (Stufen exakt, Rang-Umrechnung GESCHAETZT):
//   Ohne Einbau: Exp je Wert waechst linear mit g (gemessen zwischen zwei
//     Spielstaenden), Stufe = floor(m*(32 ln(E+534,6)-200)).
//   Mit Einbau zur Zeit 0: Exp 0, Mults * r (wartende Stuecke + NFG-Stufen),
//     Gym-Phase bis Tiefstand 100 (bbtrain.js / blade.js BBTRAIN_ZIEL, kein Rang),
//     Gym = 10 * Ortsfaktor(Powerhouse 10 -> 10/s Grund) * str_exp-Mult,
//     immer EIN Wert (Work/Formulas.ts:108-121, Locations Powerhouse expMult 10);
//     danach waechst Exp wie vorher mit g * (exp_mult'/exp_mult).
//   Rangrate ~ competence^k (k = 1,2 GESCHAETZT, siehe aug-graft.mjs).
//
// Eichung: Stufen aus Exp/Mult gegen die sechs Skills im Spielstand (exakt).
//
// Aufruf: node tools/audit/aug-einbau-v2.mjs [--k 1.2] [--rate 330] [--nfg 8]
import { loadSave } from "./aug-save.mjs";
import { loadAugs } from "./aug-data.mjs";
import { computeMults } from "./aug-mults.mjs";
import { skill, competence } from "./aug-graft.mjs";

const args = process.argv.slice(2);
const k = Number(args[args.indexOf("--k") + 1]) || 1.2;
const rate0 = Number(args[args.indexOf("--rate") + 1]) || 330;
const nfgExtra = Number.isFinite(Number(args[args.indexOf("--nfg") + 1])) && args.includes("--nfg") ? Number(args[args.indexOf("--nfg") + 1]) : 8;

const A = "backups/LIVE_197f4d61481686_BN2L1_2026-10-03T08-33_hourly.json.gz";
const B = "backups/LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz";
const augs = loadAugs();
const sa = loadSave(A).p, sb = loadSave(B).p;
const STATS = ["strength", "defense", "dexterity", "agility"];

// Eichung Stufen
const mB = computeMults(sb, augs);
let ok = true;
for (const s of ["hacking", ...STATS, "charisma"]) {
  const bn = s === "hacking" ? 0.8 : 1; // BN2 HackingLevelMultiplier 0.8 (BitNode.tsx:571)
  const L = skill(sb.exp[s], mB[s] * bn);
  if (L !== sb.skills[s]) ok = false;
  console.log(`EICHUNG Stufe ${s.padEnd(9)} nachgerechnet ${L}  Spielstand ${sb.skills[s]}`);
}
console.log("Eichung Stufen:", ok ? "alle exakt" : "ABWEICHUNG");

const dtH = (sb.playtimeSinceLastAug - sa.playtimeSinceLastAug) / 3.6e6;
const g = Object.fromEntries(STATS.map((s) => [s, (sb.exp[s] - sa.exp[s]) / dtH]));
console.log(`Exp-Zuwachs ${dtH.toFixed(2)} h:`, STATS.map((s) => `${s} ${g[s].toFixed(0)}/h`).join(", "));
const bbB = sb.bladeburner.data || sb.bladeburner, bbA = sa.bladeburner.data || sa.bladeburner;
console.log(`Rangzuwachs im selben Fenster: ${((bbB.rank - bbA.rank) / dtH).toFixed(0)}/h`);

// Zustand nach Einbau: wartende Stuecke + nfgExtra NFG-Stufen
const after = JSON.parse(JSON.stringify(sb));
for (const q of sb.queuedAugmentations) after.augmentations.push({ name: q.name, level: 1 });
const nfg = after.augmentations.find((a) => a.name === "NeuroFlux Governor");
nfg.level += nfgExtra;
const mA = computeMults(after, augs);
console.log(`Mults nach Einbau (${sb.queuedAugmentations.length} Stuecke + ${nfgExtra} NFG):`, STATS.map((s) => `${s} x${(mA[s] / mB[s]).toFixed(4)}`).join(", "), `exp x${(mA.strength_exp / mB.strength_exp).toFixed(4)}, bb_success x${(mA.bladeburner_success_chance / mB.bladeburner_success_chance).toFixed(4)}`);

const intel = sb.skills.intelligence;
const cNow = competence(sb.exp, mB, 2, intel);
// Gym-Phase: Exp fuer Stufe 100 je Wert
const expFor = (L, m) => Math.exp((L / m + 200) / 32) - 534.6;
let gymH = 0;
for (const s of STATS) gymH += expFor(100, mA[s]) / (10 * mA[s + "_exp"]) / 3600;
console.log(`Gym-Phase nach Einbau bis Tiefstand 100: ${(gymH * 60).toFixed(1)} min (ein Wert je Zeitpunkt, Powerhouse)`);

const H = 60; // Stunden Horizont
const step = 0.05;
let cumNo = 0, cumYes = 0, breakEven = null;
const rows = [];
for (let t = step; t <= H + 1e-9; t += step) {
  const eNo = Object.fromEntries(STATS.map((s) => [s, sb.exp[s] + g[s] * t]));
  eNo.hacking = sb.exp.hacking;
  const cNo = competence(eNo, mB, 2, intel);
  let cYes = 0;
  if (t > gymH) {
    const tt = t - gymH;
    const eYes = Object.fromEntries(STATS.map((s) => [s, expFor(100, mA[s]) + g[s] * (mA[s + "_exp"] / mB[s + "_exp"]) * tt]));
    eYes.hacking = 0; // Hacking-Exp ist nach dem Einbau auch weg (fuer V2-competence 0,1 Gewicht)
    cYes = competence(eYes, mA, 2, intel);
  }
  cumNo += rate0 * Math.pow(cNo / cNow, k) * step;
  cumYes += t > gymH ? rate0 * Math.pow(cYes / cNow, k) * step : 0;
  if (breakEven === null && cumYes >= cumNo) breakEven = t;
  if (Math.abs(t - Math.round(t)) < 1e-6 && [1, 2, 4, 6, 8, 12, 16, 24, 36, 48, 60].includes(Math.round(t))) {
    rows.push(`t=${String(Math.round(t)).padStart(2)} h  competence ohne x${(cNo / cNow).toFixed(3)}  mit x${(cYes / cNow).toFixed(3)}   Rang kumuliert ohne ${cumNo.toFixed(0)}  mit ${cumYes.toFixed(0)}  Differenz ${(cumYes - cumNo).toFixed(0)}`);
  }
}
console.log(`\nModell k=${k}, Rangrate heute ${rate0}/h (nur competence-Effekt; Faehigkeitspunkte/Stufenfreischaltung fuer beide Pfade gleich angenommen)`);
for (const r of rows) console.log(r);
console.log(`Gewinnschwelle (kumulierter Rang mit >= ohne): ${breakEven !== null ? breakEven.toFixed(1) + " h nach dem Einbau" : "nicht innerhalb " + H + " h"}`);
