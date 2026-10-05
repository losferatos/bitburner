// Audit geldwert BN3 (05.10.2026): Gegenprobe des Rangmodells bei kleinem Rang und grossem K mit dem
// mechanischen Nachbau tools/bbrank/sim.mjs (greedy, Erwartungswerte, Skillpunkte fest). Nur lesen.
import { simulate } from "../bbrank/sim.mjs";
const levels = {"Tracking":1,"Bounty Hunter":1,"Retirement":1,"Investigation":1,"Undercover Operation":1,"Sting Operation":1,"Raid":1,"Stealth Retirement Operation":1,"Assassination":1};
const successes = Object.fromEntries(Object.keys(levels).map(k=>[k,0]));
const env = {pop:1.5e9, comms:0, chaos:0, teamCount:0, bbSuccessMult:1};
for (const [lab, L, bbS] of [["K=1 frueh (Stufe 130)",130,{}],["K=1 spaet Zyklus 1 (Stufe 400, Skills 20)",400,{"Reaper":20,"Evasive System":20,"Blade's Intuition":15,"Tracer":10,"Digital Observer":10,"Overclock":10}],["Grafts K~5 frueh (Stufe 700, ohne Skills)",700,{}],["Grafts K~7 (Stufe 1000, ohne Skills)",1000,{}]]) {
  const skills = {hacking:200, strength:L, defense:L, dexterity:L, agility:L, charisma:1, intelligence:155};
  const out = [];
  for (const h of [1, 2, 4]) { const r = simulate({skills, bbSkills:bbS, levels, successes, env, rank:0, bnRankMult:1, hours:h, policy:"greedy"}); out.push(`${h}h: ${Math.round(r.rank)}`); }
  console.log(lab.padEnd(46), out.join("  "));
}
