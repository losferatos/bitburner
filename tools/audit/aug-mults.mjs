// Audit 03.10.2026, Bereich AUG: Spielermultiplikatoren aus installierten
// Augs + Source-Files + Exploits + Entropie nachrechnen und gegen den
// Spielstand eichen.
//
// Formelkette (Quellcode 3.0.2):
//   reapplyAllAugmentations: mults = Produkt der Aug-Mults, NFG level-mal
//     (PlayerObjectGeneralMethods.ts:412-430, AugmentationHelpers.ts:39-67)
//   reapplyAllSourceFiles: SF-Faktoren (SourceFile/applySourceFile.ts:13-175)
//   applyExploit: 1,001^n bzw. 0,999^n (Exploits/applyExploits.ts:4-40)
//   applyEntropy: 0,98^entropy auf alle Mults, Kosten /0,98^e
//     (PersonObjects/Grafting/EntropyAccumulation.ts:6-47)
// Aufruf: node tools/audit/aug-mults.mjs <save.json.gz> [weitere ...]
import { loadSave } from "./aug-save.mjs";
import { loadAugs, MULT_KEYS } from "./aug-data.mjs";

const COST_KEYS = new Set(["hacknet_node_purchase_cost", "hacknet_node_ram_cost", "hacknet_node_core_cost", "hacknet_node_level_cost"]);

function sfApply(m, bn, lvl) {
  const sum = (base) => {
    let s = 0;
    for (let i = 0; i < lvl; i++) s += base / Math.pow(2, i);
    return s / 100;
  };
  const mul = (keys, f) => keys.forEach((k) => (m[k] *= f));
  const HACK = ["hacking_chance", "hacking_speed", "hacking_money", "hacking_grow", "hacking", "hacking_exp"];
  const COMBAT = ["strength", "defense", "dexterity", "agility"];
  const COMBAT_EXP = ["strength_exp", "defense_exp", "dexterity_exp", "agility_exp"];
  const HN_COST = ["hacknet_node_purchase_cost", "hacknet_node_ram_cost", "hacknet_node_core_cost", "hacknet_node_level_cost"];
  switch (bn) {
    case 1: {
      const inc = 1 + sum(16);
      mul([...HACK, ...COMBAT, "charisma", ...COMBAT_EXP, "charisma_exp", "company_rep", "faction_rep", "crime_money", "crime_success", "hacknet_node_money", "work_money"], inc);
      mul(HN_COST, 1 / inc);
      break;
    }
    case 2: mul(["crime_money", "crime_success", "charisma"], 1 + sum(24)); break;
    case 3: mul(["charisma", "work_money"], 1 + sum(8)); break;
    case 5: mul(HACK, 1 + sum(8)); break;
    case 6: mul([...COMBAT, ...COMBAT_EXP], 1 + sum(8)); break;
    case 7: mul(["bladeburner_max_stamina", "bladeburner_stamina_gain", "bladeburner_analysis", "bladeburner_success_chance"], 1 + sum(8)); break;
    case 8: mul(["hacking_grow"], 1 + sum(12)); break;
    case 9: mul(["hacknet_node_money"], 1 + sum(12)); mul(HN_COST, 1 - sum(12)); break;
    case 11: mul(["work_money", "company_rep"], 1 + sum(32)); break;
    default: break;
  }
}

export function computeMults(p, augs) {
  const m = Object.fromEntries(MULT_KEYS.map((k) => [k, 1]));
  for (const pa of p.augmentations || []) {
    const a = augs[pa.name];
    if (!a) continue;
    const times = pa.name === "NeuroFlux Governor" ? pa.level || 1 : 1;
    for (let i = 0; i < times; i++) for (const [k, v] of Object.entries(a.mults)) m[k] *= v;
  }
  for (const [bn, lvl] of (p.sourceFiles && p.sourceFiles.data) || []) sfApply(m, bn, lvl);
  const n = (p.exploits || []).length;
  for (const k of MULT_KEYS) {
    if (k === "dnet_money" || k.startsWith("bladeburner_")) continue;
    m[k] *= COST_KEYS.has(k) ? Math.pow(0.999, n) : Math.pow(1.001, n);
  }
  const e = Math.pow(0.98, p.entropy || 0);
  for (const k of MULT_KEYS) m[k] = COST_KEYS.has(k) ? m[k] / e : m[k] * e;
  return m;
}

if (process.argv[1] && process.argv[1].endsWith("aug-mults.mjs")) {
  const augs = loadAugs();
  for (const f of process.argv.slice(2)) {
    const { p } = loadSave(f);
    const m = computeMults(p, augs);
    let maxDev = 0;
    const devs = [];
    for (const k of MULT_KEYS) {
      if (!(k in p.mults)) continue;
      const d = m[k] / p.mults[k] - 1;
      if (Math.abs(d) > 1e-9) devs.push(`${k}: soll ${p.mults[k].toFixed(6)} ist ${m[k].toFixed(6)} (${(d * 100).toFixed(3)} %)`);
      maxDev = Math.max(maxDev, Math.abs(d));
    }
    console.log(`${f.split(/[\\/]/).pop()}  BN${p.bitNodeN}  augs ${p.augmentations.length}  entropy ${p.entropy}  exploits ${(p.exploits || []).length}  max. Abweichung ${(maxDev * 100).toExponential(2)} %`);
    for (const d of devs.slice(0, 12)) console.log("   ", d);
  }
}
