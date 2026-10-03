// Audit 03.10.2026, Bereich FAKT: Was bringen zusaetzliche Kampf-Augs im V2-Weg
// an Rang? Nutzt das vorhandene Bladeburner-Modell tools/bbrank/sim.mjs
// (Nachbau Bladeburner.ts process/completeAction, v3.0.1) mit dem BN2.1-Stand.
//
// Vorgehen: (1) Gegenprobe des Modells gegen den echten Rangzuwachs 08:33 -> 09:59
// (BN2.1). (2) 10 h ab dem 09:59-Stand mit Kampfwerten x1,00 / x1,40 / x1,75
// (die Faktoren aus fakt-v2.mjs: Augs eines 12-h-Zyklus je nach Beitrittspolitik).
// Nach einem Einbau liegen die Stufen bei gleicher Erfahrung um den Faktor des
// Multiplikators hoeher (Stufe = mult * (32 ln(exp+534,6) - 200)), deshalb
// skaliert der Vergleich die vier Kampfwerte direkt.
//
// Aufruf: node tools/audit/fakt-rang.mjs
import { simulate } from "../bbrank/sim.mjs";

const bbSkills0833 = {"Hyperdrive":4,"Digital Observer":8,"Tracer":8,"Short-Circuit":7,"Blade's Intuition":6,"Cyber's Edge":4,"Evasive System":3,"Reaper":4,"Cloak":3,"Datamancer":10};
const s0833 = {hacking:355,strength:183,defense:165,dexterity:166,agility:166,charisma:42,intelligence:153};
const lv0833 = {"Tracking":1,"Bounty Hunter":1,"Retirement":8,"Investigation":1,"Undercover Operation":1,"Sting Operation":1,"Raid":4,"Stealth Retirement Operation":1,"Assassination":1};
const su0833 = {"Retirement":45,"Raid":15};
const env0833 = {pop:623520797, comms:47, chaos:11.43, teamCount:0, bbSuccessMult:1};

const g = simulate({skills:s0833, bbSkills:bbSkills0833, levels:lv0833, successes:su0833, env:env0833,
  bnRankMult:1, hours:1.433, policy:"greedy", rank:1259.97, stamina:40.03});
console.log("GEGENPROBE 08:33 -> 09:59 (1,43 h): Modell +" + Math.round(g.rank - 1259.97)
  + " Rang (greedy), real +" + Math.round(1734.16 - 1259.97) + " Rang");

const bbSkills = {"Hyperdrive":5,"Digital Observer":10,"Tracer":9,"Short-Circuit":8,"Blade's Intuition":7,"Cyber's Edge":5,"Evasive System":4,"Reaper":4,"Cloak":4,"Datamancer":12};
const s0959 = {hacking:372,strength:194,defense:181,dexterity:181,agility:181,charisma:57,intelligence:153};
const lv = {"Tracking":12,"Bounty Hunter":7,"Retirement":11,"Investigation":1,"Undercover Operation":1,"Sting Operation":1,"Raid":5,"Stealth Retirement Operation":1,"Assassination":1};
const su = {"Tracking":88,"Bounty Hunter":35,"Retirement":85,"Raid":21};
const env = {pop:587363003, comms:41, chaos:49.10, teamCount:0, bbSuccessMult:1};
let base = null;
for (const f of [1, 1.40, 1.75]) {
  const sk = {...s0959, strength:s0959.strength*f, defense:s0959.defense*f, dexterity:s0959.dexterity*f, agility:s0959.agility*f};
  const r = simulate({skills:sk, bbSkills, levels:lv, successes:su, env, bnRankMult:1, hours:10, policy:"greedy", rank:1734.16});
  const gain = r.rank - 1734.16;
  if (base === null) base = gain;
  console.log(`Kampfwerte x${f.toFixed(2)}: +${Math.round(gain)} Rang in 10 h (${(gain/base).toFixed(2)}x), Einsatzanteil ${(100*r.duty).toFixed(0)} %`);
}
