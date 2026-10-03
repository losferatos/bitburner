// Audit 03.10.2026, Bereich AUG: Augmentierungsdaten direkt aus dem
// Spielquellcode 3.0.2 lesen (reference/bitburner-src/src/Augmentation/
// Augmentations.ts + Enums.ts), ohne TypeScript-Lauf. Liefert je Aug:
// name, repCost, moneyCost, factions, prereqs, isSpecial, mults.
// Aufruf: node tools/audit/aug-data.mjs [--json] [--name "<Aug>"]
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "../../reference/bitburner-src/src");

function parseEnum(file, enumName) {
  const t = fs.readFileSync(file, "utf8");
  const start = t.indexOf("export enum " + enumName);
  const body = t.slice(start, t.indexOf("}", start));
  const map = {};
  for (const m of body.matchAll(/(\w+)\s*=\s*"([^"]+)"/g)) map[m[1]] = m[2];
  return map;
}

const MULT_KEYS = [
  "hacking", "strength", "defense", "dexterity", "agility", "charisma",
  "hacking_exp", "strength_exp", "defense_exp", "dexterity_exp", "agility_exp", "charisma_exp",
  "hacking_chance", "hacking_speed", "hacking_money", "hacking_grow",
  "company_rep", "faction_rep", "crime_money", "crime_success", "dnet_money", "work_money",
  "hacknet_node_money", "hacknet_node_purchase_cost", "hacknet_node_ram_cost",
  "hacknet_node_core_cost", "hacknet_node_level_cost",
  "bladeburner_max_stamina", "bladeburner_stamina_gain", "bladeburner_analysis",
  "bladeburner_success_chance",
];

function num(expr, donationBonus) {
  // nur einfache Ausdruecke: Zahl, 1.01 + donationBonus, 1 / (1.01 + donationBonus), Infinity
  const e = expr.replace(/donationBonus/g, String(donationBonus)).trim();
  if (!/^[0-9eE.+\-*/() Infinity]+$/.test(e)) return null;
  // eslint-disable-next-line no-new-func
  return Function("return (" + e + ")")();
}

export function loadAugs({ donations = 262 } = {}) {
  const augEnum = parseEnum(path.join(SRC, "Augmentation/Enums.ts"), "AugmentationName");
  let facEnum = {};
  try {
    facEnum = parseEnum(path.join(SRC, "Faction/Enums.ts"), "FactionName");
  } catch {
    facEnum = {};
  }
  const t = fs.readFileSync(path.join(SRC, "Augmentation/Augmentations.ts"), "utf8");
  const donationBonus = donations / 1e6 / 100;
  const out = {};
  const re = /\[AugmentationName\.(\w+)\]:\s*\{/g;
  let m;
  while ((m = re.exec(t))) {
    const key = m[1];
    // Blockende: naechste Zeile "    }," auf gleicher Einrueckung
    let depth = 1;
    let i = re.lastIndex;
    while (depth > 0 && i < t.length) {
      if (t[i] === "{") depth++;
      else if (t[i] === "}") depth--;
      i++;
    }
    const block = t.slice(re.lastIndex, i - 1);
    const name = augEnum[key] || key;
    const a = { key, name, repCost: null, moneyCost: null, factions: [], prereqs: [], isSpecial: false, mults: {} };
    const rc = block.match(/repCost:\s*([^,\n]+),/);
    if (rc) a.repCost = num(rc[1], donationBonus);
    const mc = block.match(/moneyCost:\s*([^,\n]+),/);
    if (mc) a.moneyCost = num(mc[1], donationBonus);
    a.isSpecial = /isSpecial:\s*true/.test(block);
    const pr = block.match(/prereqs:\s*\[([^\]]*)\]/);
    if (pr) a.prereqs = [...pr[1].matchAll(/AugmentationName\.(\w+)/g)].map((x) => augEnum[x[1]] || x[1]);
    const fa = block.match(/factions:\s*\[([\s\S]*?)\]/);
    if (fa) a.factions = [...fa[1].matchAll(/FactionName\.(\w+)/g)].map((x) => facEnum[x[1]] || x[1]);
    if (/factions:\s*Object\.values\(FactionName\)/.test(block)) a.factions = ["(alle ausser SoA/Bladeburners/Church)"];
    for (const k of MULT_KEYS) {
      const mm = block.match(new RegExp("\\n\\s*" + k + ":\\s*([^,\\n]+),"));
      if (mm) {
        const v = num(mm[1], donationBonus);
        if (v !== null) a.mults[k] = v;
      }
    }
    out[name] = a;
  }
  // Circadian Modulator: Werte zufaellig (CircadianModulator.ts), Kosten fest
  const cm = augEnum.UnstableCircadianModulator;
  if (cm && out[cm]) {
    out[cm].repCost = 3.625e5;
    out[cm].moneyCost = 5e9;
    out[cm].factions = ["Speakers for the Dead"];
    out[cm].random = true;
  }
  return out;
}

export { MULT_KEYS };

if (process.argv[1] && process.argv[1].endsWith("aug-data.mjs")) {
  const augs = loadAugs();
  const args = process.argv.slice(2);
  const ni = args.indexOf("--name");
  if (ni >= 0) console.log(JSON.stringify(augs[args[ni + 1]], null, 1));
  else if (args.includes("--json")) console.log(JSON.stringify(augs, null, 1));
  else {
    console.log("Anzahl Augs:", Object.keys(augs).length);
    for (const a of Object.values(augs))
      console.log(a.name.padEnd(55), String(a.repCost).padStart(9), String(a.moneyCost).padStart(10), a.isSpecial ? "S" : " ", JSON.stringify(a.mults));
  }
}
