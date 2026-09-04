import { simulate, maxStaminaOf, staminaGainPerSecond } from "./sim.mjs";
import { skillMultipliers } from "./bbmodel.mjs";

const skills = {hacking:341, strength:100, defense:100, dexterity:109, agility:107, charisma:80, intelligence:106};
const bbSkills = {"Hyperdrive":4,"Digital Observer":6,"Tracer":6,"Short-Circuit":5,"Blade's Intuition":4,
                  "Reaper":2,"Evasive System":3,"Datamancer":4,"Cloak":2,"Overclock":1,"Cyber's Edge":3};
const m = skillMultipliers(bbSkills);
const env = {pop:1564094106, comms:131, chaos:6.922924430015252, teamCount:0, bbSuccessMult:1};
const levels = {"Tracking":30,"Bounty Hunter":15,"Retirement":17,"Investigation":1,"Undercover Operation":1,
                "Sting Operation":1,"Raid":1,"Stealth Retirement Operation":1,"Assassination":1};
const successes = {"Tracking":518,"Bounty Hunter":140,"Retirement":186,"Investigation":0,"Undercover Operation":0,
                   "Sting Operation":0,"Raid":0,"Stealth Retirement Operation":0,"Assassination":0};
const base = {skills, bbSkills, levels, successes, env, rank:660.63, staminaBonus:0};

console.log("=== EICHUNG 5: maxStamina / Ausdauerregeneration ===");
const ms = maxStaminaOf(skills, m, 0);
console.log(`  maxStamina Modell ${ms.toFixed(8)}  vs. Spielstand 50.32849886337204  `
  + `Abweichung ${(100*Math.abs(ms-50.32849886337204)/50.32849886337204).toExponential(2)} %`);
console.log(`  Ausdauer/s ${staminaGainPerSecond(skills,m,ms).toFixed(6)}  (= ${(staminaGainPerSecond(skills,m,ms)*3600).toFixed(1)}/h)`);

console.log("\n=== EICHUNG 6 (End-zu-End): reproduziert das Modell die gemessenen 33 Rang/h? ===");
const nurContracts = simulate({...base, bnRankMult:0.8, hours:24, policy:"contractsOnly"});
console.log(`  Nur Contracts, ausdauergeregelt: ${((nurContracts.rank-660.63)/24).toFixed(1)} Rang/h`
  + `   Arbeitsanteil ${(nurContracts.duty*100).toFixed(0)} %`);
console.log(`  Gemessen (Auftrag): 33 Rang/h (+616 in 18,7 h Spielzeit)`);

console.log("\n=== FRAGE 5: beste verfuegbare Aktion, BN10, ab Rang 660 ===");
for (const h of [1, 24, 24*7, 24*30]) {
  const r = simulate({...base, bnRankMult:0.8, hours:h, policy:"greedy"});
  console.log(`  nach ${String(h).padStart(4)} h Spielzeit: Rang ${r.rank.toFixed(0).padStart(9)}   `
    + `Schnitt ${((r.rank-660.63)/h).toFixed(1).padStart(8)} Rang/h   Arbeitsanteil ${(r.duty*100).toFixed(0)}%   `
    + `Stufen ${Object.entries(r.lvl).filter(([,v])=>v>1).map(([k,v])=>k.slice(0,4)+":"+v).join(" ")}`);
}

console.log("\n=== Stundenprofil des Greedy-Laufs (erste 12 h) ===");
const g = simulate({...base, bnRankMult:0.8, hours:12, policy:"greedy"});
for (const s of g.trace)
  console.log(`  h=${s.h.toFixed(0).padStart(3)}  Rang ${s.rank.toFixed(0).padStart(7)}  Aktion ${s.best.padEnd(30)} Stufe ${String(s.L).padStart(3)}  p=${(s.p*100).toFixed(1)}%  ${s.tt}s`);

console.log("\n=== FRAGE 6: Wachstumsgesetz - Verdopplungszeit im Zeitverlauf (BN10, greedy) ===");
const lang = simulate({...base, bnRankMult:0.8, hours:24*120, policy:"greedy"});
let ziel = 1320, letzte = 0;
for (const s of lang.trace) {
  if (s.rank >= ziel) { console.log(`  Rang ${ziel.toFixed(0).padStart(8)} erreicht bei h=${s.h.toFixed(0).padStart(5)}   (Verdopplung dauerte ${(s.h-letzte).toFixed(0)} h)`); letzte = s.h; ziel *= 2; }
}
console.log(`  Endstand nach ${lang.hours.toFixed(0)} h: Rang ${lang.rank.toFixed(0)}`);
console.log(`  Endstufen: ${Object.entries(lang.lvl).map(([k,v])=>k.slice(0,4)+":"+v).join(" ")}`);

console.log("\n=== FRAGE 7: BN6 (BladeburnerRank = 1.0) - selbe Startlage, nur der Multiplikator anders ===");
for (const h of [24, 24*7]) {
  const r6  = simulate({...base, bnRankMult:1.0, hours:h, policy:"greedy"});
  const r10 = simulate({...base, bnRankMult:0.8, hours:h, policy:"greedy"});
  console.log(`  ${String(h).padStart(4)} h: BN6 Rang ${r6.rank.toFixed(0).padStart(8)} | BN10 Rang ${r10.rank.toFixed(0).padStart(8)}  -> Faktor ${(r6.rank/r10.rank).toFixed(3)}`);
}
