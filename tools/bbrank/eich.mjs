import { ACTIONS, C, skillMultipliers, actionTime, successChance, rankGain, rankLoss,
         successesNeeded, levelFromSuccesses, rankRate, difficultyOf } from "./bbmodel.mjs";

// ---- Live-Stand aus dem Spielstand (getSaveFile, 04.09.2026 ~01:52) ----
const skills = {hacking:341, strength:100, defense:100, dexterity:109, agility:107, charisma:80, intelligence:106};
const bbSkills = {"Hyperdrive":4,"Digital Observer":6,"Tracer":6,"Short-Circuit":5,"Blade's Intuition":4,
                  "Reaper":2,"Evasive System":3,"Datamancer":4,"Cloak":2,"Overclock":1,"Cyber's Edge":3};
const m = skillMultipliers(bbSkills);
const RANK = 660.6257813231015, MAXRANK = 660.6257813231015, TOTAL_SP = 220;
const BN10 = 0.8;                       // BitNode.tsx:876 (case 10)
const BN6  = 1.0;                       // BitNode.tsx case 6: BladeburnerRank nicht gesetzt -> Default 1 (BitNodeMultipliers.ts:19)
const city = {pop:1564094106, popEst:1051020781, comms:131, chaos:6.922924430015252}; // Sector-12
const env = {stamina:25.50965299690286, maxStamina:50.32849886337204, teamCount:0,
             pop:city.pop, comms:city.comms, chaos:city.chaos, bbSuccessMult:1};
const envFull = {...env, stamina:50.32849886337204};  // volle Ausdauer -> Penalty 1

const ok = (b) => b ? "OK " : "FEHLER ";
console.log("=== EICHUNG gegen bekannte Werte aus dem Spielstand ===");

// (1) Skillpunkte aus maxRank  (Bladeburner.ts:1285-1292)
const spCalc = Math.floor((MAXRANK - 3) / C.RanksPerSkillPoint + 1);
console.log(ok(spCalc === TOTAL_SP) + `totalSkillPoints: Modell ${spCalc} vs. Spielstand ${TOTAL_SP}`);

// (2) maxLevel der drei Contracts aus successes  (LevelableAction.ts:246-253)
const save = {"Tracking":{s:518,L:30},"Bounty Hunter":{s:140,L:15},"Retirement":{s:186,L:17}};
for (const [n,{s,L}] of Object.entries(save)) {
  const calc = levelFromSuccesses(s, C.ContractSuccessesPerLevel);
  console.log(ok(calc===L) + `maxLevel ${n}: Modell ${calc} vs. Spielstand ${L}  `
    + `(erreicht bei ${successesNeeded(L-1,3)} Erfolgen, naechste Stufe bei ${successesNeeded(L,3)}, ist ${s})`);
}

// (3) Beobachtete Erfolgsquote der Contracts gegen die Formel
console.log("\n=== Erfolgsquoten: Formel (jetzt, volle Ausdauer) vs. Lebenslauf im Spielstand ===");
const hist = {"Tracking":[518,484],"Bounty Hunter":[140,530],"Retirement":[186,425]};
for (const [n,[s,f]] of Object.entries(hist)) {
  const L = save[n].L;
  const p = successChance(ACTIONS[n], L, skills, m, envFull);
  console.log(`  ${n.padEnd(14)} Stufe ${String(L).padStart(2)}  Formel ${(p*100).toFixed(1)}%   `
    + `historisch ${(100*s/(s+f)).toFixed(1)}% (${s}/${s+f})`);
}

console.log("\n=== FRAGE 4: Ranggewinn der General-Aktionen (Formulas.ts:9-15) ===");
console.log("  Hyperbolic Regeneration Chamber : 0 Rang  (kein case in calculateActionRankGain -> return 0)");
console.log("  Training / Diplomacy / Recruitment / Incite Violence : 0 Rang (dito)");
console.log(`  Field Analysis                  : 0.1 * BladeburnerRank = ${0.1*BN10} Rang je 30 s`
  + ` = ${(0.1*BN10/30*3600).toFixed(1)} Rang/h`);

console.log("\n=== FRAGE 5: Rangrate bei Rang 660 in BN10 ===");
const rows = [];
for (const [n,a] of Object.entries(ACTIONS)) {
  const L = save[n] ? save[n].L : 1;                       // Ops stehen im Spielstand alle auf Stufe 1
  const r = rankRate(a, L, skills, m, envFull, BN10);
  rows.push({n, L, p:r.p, t:r.t, gain:rankGain(a,L,BN10), per:r.per, h:r.perHour});
}
rows.sort((x,y)=>y.h-x.h);
console.log("Aktion                        Stufe  Erfolg%   Dauer  Rang/Erfolg  E[Rang]/Akt  Rang/h");
for (const r of rows)
  console.log(`${r.n.padEnd(30)}${String(r.L).padStart(4)}   ${(r.p*100).toFixed(1).padStart(6)}  `
    + `${String(r.t).padStart(5)}s  ${r.gain.toFixed(3).padStart(11)}  ${r.per.toFixed(3).padStart(11)}  ${r.h.toFixed(1).padStart(7)}`);
console.log(`Field Analysis (General)                -   100.0     30s  ${(0.1*BN10).toFixed(3).padStart(11)}  `
  + `${(0.1*BN10).toFixed(3).padStart(11)}  ${(0.1*BN10/30*3600).toFixed(1).padStart(7)}`);
console.log(`Hyperbolic Regen (General)              -   100.0     60s        0.000        0.000     0.0   <-- laeuft gerade`);

console.log("\n=== Gegenprobe: was WAERE die Rate mit den Ops auf ihrer Sattelstufe? ===");
// "Sattelstufe" = hoechste Stufe, bei der die Erfolgschance noch >= 0.99 ist
for (const [n,a] of Object.entries(ACTIONS)) {
  let best = null;
  for (let L=1; L<=200; L++) {
    const r = rankRate(a, L, skills, m, envFull, BN10);
    if (!best || r.perHour > best.h) best = {L, h:r.perHour, p:r.p, t:r.t};
  }
  console.log(`  ${n.padEnd(30)} beste Stufe ${String(best.L).padStart(3)}  ${(best.p*100).toFixed(1).padStart(5)}%  `
    + `${String(best.t).padStart(5)}s  ${best.h.toFixed(1).padStart(9)} Rang/h`);
}
