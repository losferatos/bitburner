// Rang/h-Hebel der Gang-Kampfaugs in BN2.1, mit dem geeichten Bladeburner-
// Modell tools/bbrank/bbmodel.mjs (eich.mjs: gegen BN10-Spielstand geeicht).
// Hier zusaetzlich: Eichung maxStamina gegen den BN2.1-Spielstand.
//
// Aufruf: node tools/audit/gang-bbhebel.mjs
import path from "node:path";
import { ACTIONS, skillMultipliers, rankRate } from "../bbrank/bbmodel.mjs";
import { maxStaminaOf } from "../bbrank/sim.mjs";
import { readSave } from "./gang-save.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const { p } = readSave(path.join(ROOT, "backups", "LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz"));
const bb = p.bladeburner.data;
const sk0 = { ...p.skills };
const m = skillMultipliers(bb.skills);

// Eichung: maxStamina (Bladeburner.ts calculateMaxStamina) gegen Spielstand
const msModel = maxStaminaOf(sk0, m, bb.staminaBonus || 0, p.mults.bladeburner_max_stamina || 1);
console.log(`EICHUNG maxStamina: Modell ${msModel.toFixed(6)} / Spielstand ${bb.maxStamina.toFixed(6)} -> `
  + `${Math.abs(msModel - bb.maxStamina) / bb.maxStamina < 1e-6 ? "OK" : "ABWEICHUNG " + ((msModel / bb.maxStamina - 1) * 100).toFixed(3) + " %"}`);

const levels = {};
for (const [k, v] of Object.entries(bb.contracts)) levels[k] = (v.data || v).maxLevel;
for (const [k, v] of Object.entries(bb.operations)) levels[k] = (v.data || v).maxLevel;
const city = bb.cities["Volhaven"].data || bb.cities["Volhaven"];
const env0 = { pop: city.pop, comms: city.comms, chaos: city.chaos, teamCount: 0, bbSuccessMult: p.mults.bladeburner_success_chance };

function best(sk, freeLevel, noRaid = false) {
  const ms = maxStaminaOf(sk, m, bb.staminaBonus || 0);
  const env = { ...env0, stamina: ms, maxStamina: ms };
  let b = null;
  for (const [n, a] of Object.entries(ACTIONS)) {
    if (noRaid && n === "Raid") continue; // Raid ist endlich (comms je Stadt)
    const Ls = freeLevel ? Array.from({ length: 120 }, (_, i) => i + 1) : [levels[n] || 1];
    for (const L of Ls) {
      const r = rankRate(a, L, sk, m, env, 1); // BN2 BladeburnerRank = 1
      if (!b || r.perHour > b.perHour) b = { n, L, ...r };
    }
  }
  return b;
}
const scen = [
  ["heute (BN2.1, h5,3)", {}],
  ["+ Gang-Runde 20 Mrd", { strength: 5.22, defense: 5.62, dexterity: 2.83, agility: 3.20 }],
  ["+ Gang-Runde 100 Mrd", { strength: 9.83, defense: 23.28, dexterity: 3.11, agility: 2.28 }],
  ["nur Kampf x1,8 (typ. V2-Laufende ohne Gang)", { strength: 1.8, defense: 1.8, dexterity: 1.8, agility: 1.8 }],
];
const b0 = { fix: best(sk0, false), free: best(sk0, true), nr: best(sk0, true, true) };
for (const [label, f] of scen) {
  const sk = { ...sk0 };
  for (const [s, x] of Object.entries(f)) sk[s] = Math.floor(sk0[s] * x);
  const fx = best(sk, false), fr = best(sk, true), nr = best(sk, true, true);
  console.log(label.padEnd(44), `| heutige Stufen: ${fx.n} L${fx.L} p=${(fx.p * 100).toFixed(0)}% ${fx.perHour.toFixed(0)} Rang/h (x${(fx.perHour / b0.fix.perHour).toFixed(2)})`
    + ` | freie Stufe: ${fr.n} L${fr.L} p=${(fr.p * 100).toFixed(0)}% ${fr.perHour.toFixed(0)} Rang/h (x${(fr.perHour / b0.free.perHour).toFixed(2)})`
    + ` | ohne Raid: ${nr.n} L${nr.L} p=${(nr.p * 100).toFixed(0)}% ${nr.perHour.toFixed(0)} Rang/h (x${(nr.perHour / b0.nr.perHour).toFixed(2)})`);
}
