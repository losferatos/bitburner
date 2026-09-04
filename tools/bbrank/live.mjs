/** Eichung der Formel gegen die LIVE-Protokollzeilen des laufenden Spiels (04.09.2026 01:52-01:59). */
import { ACTIONS, C, skillMultipliers, actionTime, rankGain, difficultyOf, successChance } from "./bbmodel.mjs";
import { maxStaminaOf } from "./sim.mjs";

const skills = {hacking:341, strength:100, defense:100, dexterity:109, agility:107, charisma:80, intelligence:106};
const bbSkills = {"Hyperdrive":4,"Digital Observer":6,"Tracer":6,"Short-Circuit":5,"Blade's Intuition":4,
                  "Reaper":2,"Evasive System":3,"Datamancer":4,"Cloak":2,"Overclock":1,"Cyber's Edge":3};
const m = skillMultipliers(bbSkills);
const A = ACTIONS["Tracking"], L = 30, BN10 = 0.8;

// 1) Ranggewinn je Erfolg. addOffset(x,10) streut gleichverteilt um +-10 % (utils/helpers/addOffset.ts:12-22)
const erwartet = rankGain(A, L, BN10);
const lo = erwartet * 0.9, hi = erwartet * 1.1;
const beobachtet = [0.693, 0.791, 0.821, 0.728];        // aus consoleLogs, "Gained X rank"
console.log("=== EICHUNG 7: Ranggewinn je Tracking-Erfolg, Formel vs. LIVE-Protokoll ===");
console.log(`  Formel: rankGain 0.3 * rewardFac 1.041^(30-1) * BladeburnerRank 0.8 = ${erwartet.toFixed(6)}`);
console.log(`  addOffset +-10 %  ->  zulaessiges Fenster [${lo.toFixed(4)} .. ${hi.toFixed(4)}]`);
for (const v of beobachtet)
  console.log(`   ${v >= lo && v <= hi ? "OK    " : "FEHLER"} protokolliert ${v.toFixed(3)}`);
console.log(`  Mittel beobachtet ${(beobachtet.reduce((a,b)=>a+b)/beobachtet.length).toFixed(4)} vs. Erwartungswert ${erwartet.toFixed(4)}`);

// 2) Aktionsdauer: die zwei Fehlschlaege lagen exakt 19 s auseinander (01:53:47 -> 01:54:06 -> 01:54:25)
console.log("\n=== EICHUNG 8: Aktionsdauer Tracking Stufe 30 ===");
console.log(`  Formel ${actionTime(A, L, skills, m)} s   |   Protokoll 01:53:47 -> 01:54:06 -> 01:54:25 = 19 s, 19 s`);

// 3) Schaden je Fehlschlag: hpLoss * difficultyMultiplier, aufgerundet
const d = difficultyOf(A, L);
const dm = Math.pow(d, C.DiffMultExponentialFactor) + d / C.DiffMultLinearFactor;
console.log("\n=== EICHUNG 9: Schaden je fehlgeschlagenem Tracking ===");
console.log(`  Formel ceil(hpLoss 0.5 * difficultyMult ${dm.toFixed(4)}) = ${Math.ceil(0.5*dm)}   |   Protokoll "Took 3 damage"`);

// 4) HRC-Ausdauergewinn: 1 % von maxStamina
const ms = maxStaminaOf(skills, m, 0);
console.log("\n=== EICHUNG 10: Ausdauergewinn je HRC ===");
console.log(`  Formel maxStamina ${ms.toFixed(4)} * HrcStaminaGain 1 % = ${(ms*0.01).toFixed(4)}   |   Protokoll "Restored 0.503 / 0.507 stamina"`);
console.log(`  HRC-Rang laut Protokoll: keine Zeile "Gained ... rank" -> 0. Formel: 0.`);

// 5) Rangrate im beobachteten Fenster
console.log("\n=== Beobachtetes Fenster 01:52:20 - 01:59:17 (417 s) ===");
const summe = beobachtet.reduce((a,b)=>a+b);
console.log(`  4 Erfolge, 3 Fehlschlaege, 3x HRC (180 s ohne Ertrag)`);
console.log(`  Rang +${summe.toFixed(3)} in 417 s = ${(summe/417*3600).toFixed(1)} Rang/h  (Check-in meldet 33 Rang/h)`);
console.log(`  Davon durch HRC: 0.000 Rang in ${180} s = ${(180/417*100).toFixed(0)} % der Zeit.`);
const p = successChance(A, L, skills, m, {pop:1564094106, comms:131, chaos:6.92, teamCount:0, stamina:27.3, maxStamina:ms});
console.log(`  Erfolgschance Formel ${(p*100).toFixed(1)} % | Fenster 4/7 = 57 % | Lebenslauf 518/1002 = 51.7 %`);
