import { ACTIONS, C, skillMultipliers, actionTime, successChance, rankGain, rankLoss, rankRate,
         successesNeeded } from "./bbmodel.mjs";
import { simulate, maxStaminaOf, staminaGainPerSecond } from "./sim.mjs";

const skills = {hacking:341, strength:100, defense:100, dexterity:109, agility:107, charisma:80, intelligence:106};
const bbSkills = {"Hyperdrive":4,"Digital Observer":6,"Tracer":6,"Short-Circuit":5,"Blade's Intuition":4,
                  "Reaper":2,"Evasive System":3,"Datamancer":4,"Cloak":2,"Overclock":1,"Cyber's Edge":3};
const env0 = {pop:1564094106, comms:131, chaos:6.922924430015252, teamCount:0, bbSuccessMult:1};
const levels = {"Tracking":30,"Bounty Hunter":15,"Retirement":17,"Investigation":1,"Undercover Operation":1,
                "Sting Operation":1,"Raid":1,"Stealth Retirement Operation":1,"Assassination":1};
const successes = {"Tracking":518,"Bounty Hunter":140,"Retirement":186,"Investigation":0,"Undercover Operation":0,
                   "Sting Operation":0,"Raid":0,"Stealth Retirement Operation":0,"Assassination":0};
const BN10 = 0.8;

function bestRate(bbS, sk) {
  const m = skillMultipliers(bbS);
  const ms = maxStaminaOf(sk, m, 0);
  const env = {...env0, stamina: ms, maxStamina: ms};
  let best = null;
  for (const [n,a] of Object.entries(ACTIONS)) {
    const L = levels[n];
    const r = rankRate(a, L, sk, m, env, BN10);
    if (!best || r.perHour > best.perHour) best = {n, ...r, L};
  }
  return best;
}

console.log("=== A) Warum 33 Rang/h? Anteil der Zeit ohne Rangertrag ===");
const m = skillMultipliers(bbSkills);
const ms = maxStaminaOf(skills, m, 0);
const regen = staminaGainPerSecond(skills, m, ms);
for (const n of ["Tracking","Bounty Hunter","Retirement"]) {
  const a = ACTIONS[n], L = levels[n];
  const d = a.baseDifficulty * Math.pow(a.difficultyFac, L-1);
  const kosten = C.BaseStaminaLoss * (Math.pow(d, C.DiffMultExponentialFactor) + d / C.DiffMultLinearFactor);
  const t = actionTime(a, L, skills, m);
  const netto = kosten - regen * t;                       // Ausdauer je Aktion netto
  // HRC: 60 s, +1 % maxStamina + passive Regeneration
  const hrcGewinn = regen * 60 + ms * 0.01;
  const anteil = hrcGewinn / (hrcGewinn + netto);          // Arbeitsanteil im Gleichgewicht
  const r = rankRate(a, L, skills, m, {...env0, stamina:ms, maxStamina:ms}, BN10);
  console.log(`  ${n.padEnd(14)} Dauerbetrieb ${r.perHour.toFixed(1).padStart(6)} Rang/h | Ausdauer netto `
    + `${netto.toFixed(2)}/Aktion | tragfaehiger Arbeitsanteil ${(anteil*100).toFixed(0)} % `
    + `-> ${(r.perHour*anteil).toFixed(1)} Rang/h`);
}
console.log("  Gemessen: 33 Rang/h. Passt zu Tracking/Retirement im ausdauergeregelten Dauerlauf.");
console.log("  Rang je Stunde reiner HRC-Zeit: 0.00 (Formulas.ts:9-15 kennt keinen HRC-Fall).");

console.log("\n=== B) Hebel Overclock (Skill 'Overclock', data/Skills.ts:44-53, maxLvl 90) ===");
console.log("  Kosten Stufe 1 -> 90 in SP (Skill.ts:76-80, BladeburnerSkillCost BN10 = 1, nicht gesetzt):");
const kosten90 = Math.round(89 * 1 * (3 + 1.4 * (1 + (89 - 1) / 2)));
console.log(`    ${kosten90} SP  = ${kosten90 * 3} Rang an maxRank (RanksPerSkillPoint 3). Bot hat bisher 220 SP total.`);
for (const oc of [1, 10, 30, 60, 90]) {
  const b = bestRate({...bbSkills, Overclock: oc}, skills);
  console.log(`  Overclock ${String(oc).padStart(2)}: beste Aktion ${b.n.padEnd(30)} ${b.t}s  p=${(b.p*100).toFixed(1)}%  ${b.perHour.toFixed(0).padStart(6)} Rang/h (Dauerbetrieb)`);
}

console.log("\n=== C) Hebel Kampfwerte (BN10 StrengthLevelMultiplier usw. = 0.4) ===");
for (const f of [1, 2, 4, 8, 16]) {
  const sk = {...skills, strength:100*f, defense:100*f, dexterity:109*f, agility:107*f};
  const b = bestRate(bbSkills, sk);
  console.log(`  Kampfwerte x${String(f).padStart(2)} (str ${100*f}): ${b.n.padEnd(30)} ${b.t}s  p=${(b.p*100).toFixed(1)}%  ${b.perHour.toFixed(0).padStart(7)} Rang/h`);
}

console.log("\n=== D) Raid ist endlich: comms je Stadt begrenzt die Zahl der Erfolge ===");
const comms = {Aevum:91, Chongqing:44, "Sector-12":131, "New Tokyo":77, Ishima:129, Volhaven:131};
const summe = Object.values(comms).reduce((a,b)=>a+b,0);
console.log(`  comms gesamt ueber alle 6 Staedte: ${summe} (je erfolgreicher Raid -1, Bladeburner.ts:838)`);
let rk = 0, S = 0, L = 1;
for (let i = 0; i < summe; i++) { rk += rankGain(ACTIONS["Raid"], L, BN10); S++; while (S >= successesNeeded(L, C.OperationSuccessesPerLevel)) L++; }
console.log(`  Gesamter Rang aus ALLEN ${summe} moeglichen Raid-Erfolgen (Stufe steigt mit): ${rk.toFixed(0)}  (Endstufe ${L})`);
console.log(`  Fehlbetrag bis 400.000: ${(400000 - 660 - rk).toFixed(0)} Rang muessen anderswo herkommen.`);

console.log("\n=== E) Black Ops: Summe der Rangpraemien (data/BlackOperations.ts) ===");
const bo = [[2.5e3,50],[5e3,60],[7.5e3,75],[10e3,100],[12.5e3,125],[15e3,200],[20e3,300],[25e3,500],[30e3,750],
            [40e3,1e3],[50e3,1.5e3],[75e3,2e3],[100e3,2.5e3],[125e3,3e3],[150e3,4e3],[175e3,5e3],[200e3,7.5e3],
            [250e3,10e3],[300e3,15e3],[350e3,20e3],[400e3,40e3]];
const sumBO = bo.reduce((a,[,g])=>a+g,0);
console.log(`  Summe rankGain aller 21 Black Ops: ${sumBO} roh, x0.8 (BN10) = ${(sumBO*BN10).toFixed(0)} Rang`);
console.log(`  Davon vor Daedalus (die ersten 20): ${((sumBO-40e3)*BN10).toFixed(0)} Rang`);
console.log(`  Netto noch aufzubringen bis 400.000: ${(400000 - 660 - (sumBO-40e3)*BN10).toFixed(0)} Rang`);

console.log("\n=== F) Wachstumsgesetz analytisch (Frage 6) ===");
console.log("  Stufe L nach S Erfolgen: S ~ L^2/2  =>  L ~ sqrt(2S)   (LevelableAction.ts:251-253)");
console.log("  Rang je Erfolg ~ rewardFac^L ;  Aktionsdauer ~ difficultyFac^L ;  Erfolgschance ~ difficultyFac^-L");
console.log("  Aktion              ln(rew)  ln(diff)  Regime p=1: (rew/diff)   Regime p<1: (rew/diff^2)");
for (const [n,a] of Object.entries(ACTIONS)) {
  const k = Math.log(a.rewardFac), j = Math.log(a.difficultyFac);
  console.log(`  ${n.padEnd(30)} ${k.toFixed(5)}  ${j.toFixed(5)}   ${(a.rewardFac/a.difficultyFac).toFixed(4).padStart(8)}    ${(a.rewardFac/(a.difficultyFac**2)).toFixed(4).padStart(8)}`);
}
