// verify-g01-augs.mjs - eigener Parser fuer Augmentation/Augmentations.ts (3.0.2).
// Unabhaengig von aug-data.mjs / gang-augs.mjs. Liefert je Aug: Name, repCost,
// moneyCost, Mults, isSpecial, factions, prereqs.
// Aufruf: node tools/audit/verify-g01-augs.mjs  -> Liste der Kampf-Augs im BN2-Gangangebot
import fs from "node:fs";

const SRC = "C:/Users/erche/Desktop/claude_projecto/bitburner/reference/bitburner-src/src/";

export function loadAugs() {
  const enumTxt = fs.readFileSync(SRC + "Augmentation/Enums.ts", "utf8");
  const keyToName = {};
  const enumBlock = enumTxt.slice(enumTxt.indexOf("export enum AugmentationName"));
  for (const m of enumBlock.slice(0, enumBlock.indexOf("}")).matchAll(/(\w+)\s*=\s*"([^"]+)"/g)) keyToName[m[1]] = m[2];
  const facTxt = fs.readFileSync(SRC + "Faction/Enums.ts", "utf8");
  const facKey = {};
  for (const m of facTxt.matchAll(/(\w+)\s*=\s*"([^"]+)"/g)) facKey[m[1]] = m[2];

  const txt = fs.readFileSync(SRC + "Augmentation/Augmentations.ts", "utf8");
  const parts = txt.split(/\n\s{4}\[AugmentationName\.(\w+)\]:\s*\{/);
  const augs = {};
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i];
    // Block endet beim naechsten Eintrag (split) - letzter Block endet bei "};"
    let body = parts[i + 1];
    const end = body.indexOf("\n  };");
    if (end >= 0) body = body.slice(0, end);
    const a = { key, name: keyToName[key], mults: {}, isSpecial: false, factions: [], prereqs: [] };
    for (const m of body.matchAll(/^\s{6}(\w+):\s*([0-9.e+-]+|Infinity),?\s*$/gm)) {
      const v = m[2] === "Infinity" ? Infinity : Number(m[2]);
      if (m[1] === "repCost") a.repCost = v;
      else if (m[1] === "moneyCost") a.moneyCost = v;
      else a.mults[m[1]] = v;
    }
    if (/^\s{6}isSpecial:\s*true/m.test(body)) a.isSpecial = true;
    const fm = body.match(/factions:\s*\[([\s\S]*?)\]/);
    if (fm) a.factions = [...fm[1].matchAll(/FactionName\.(\w+)/g)].map((x) => facKey[x[1]] || x[1]);
    const pm = body.match(/prereqs:\s*\[([\s\S]*?)\]/);
    if (pm) a.prereqs = [...pm[1].matchAll(/AugmentationName\.(\w+)/g)].map((x) => keyToName[x[1]] || x[1]);
    augs[a.name] = a;
  }
  return augs;
}

export const COMBAT_KEYS = ["strength", "defense", "dexterity", "agility"];
export const BB_KEYS = ["bladeburner_success_chance", "bladeburner_max_stamina", "bladeburner_stamina_gain", "bladeburner_analysis"];

export function isCombat(a) {
  return COMBAT_KEYS.some((k) => (a.mults[k] ?? 1) !== 1);
}

if (process.argv[1] && process.argv[1].endsWith("verify-g01-augs.mjs")) {
  const augs = loadAugs();
  const all = Object.values(augs);
  console.log("Augs geparst:", all.length);
  // Probe gegen bekannte Werte (aus dem Quelltext abgelesen): SPTN-97, TRP, Graphene Bone Lacings
  for (const n of ["SPTN-97 Gene Modification", "The Red Pill", "Graphene Bone Lacings", "Hydroflame Left Arm", "BLADE-51b Tesla Armor"]) {
    const a = augs[n];
    console.log("  Probe", n, a ? `rep ${a.repCost} $ ${a.moneyCost} special ${a.isSpecial} mults ${JSON.stringify(a.mults)} fac ${a.factions.join(",")}` : "FEHLT");
  }
  // BN2-Gangangebot: !isSpecial && !Congruity (+TRP). GangUniqueAugs=1 -> rng() >= 0 immer wahr.
  const offer = all.filter((a) => !a.isSpecial && a.name !== "Congruity Implant");
  const combatOffer = offer.filter(isCombat);
  const combatSpecial = all.filter((a) => a.isSpecial && isCombat(a));
  const bbAugs = all.filter((a) => a.factions.includes("Bladeburners"));
  console.log("Gangangebot BN2 ohne TRP:", offer.length, "(+TRP =", offer.length + 1, ")");
  console.log("davon Kampf-Augs (str/def/dex/agi != 1):", combatOffer.length);
  console.log("Kampf-Augs isSpecial (nicht im Angebot):", combatSpecial.map((a) => a.name).join(" | "));
  console.log("Bladeburners-Augs:", bbAugs.length, "davon isSpecial:", bbAugs.filter((a) => a.isSpecial).length,
    "nicht special:", bbAugs.filter((a) => !a.isSpecial).map((a) => a.name).join(","));
  const rows = combatOffer.map((a) => ({ n: a.name, rep: a.repCost, $: a.moneyCost,
    str: a.mults.strength ?? 1, def: a.mults.defense ?? 1, dex: a.mults.dexterity ?? 1, agi: a.mults.agility ?? 1,
    bb: a.mults.bladeburner_success_chance ?? 1, fac: a.factions.length, pre: a.prereqs.join("+") }))
    .sort((x, y) => y.rep - x.rep);
  for (const r of rows) console.log(`  ${r.n.padEnd(48)} rep ${String(r.rep).padStart(8)} $ ${r.$.toExponential(3)} str ${r.str} def ${r.def} dex ${r.dex} agi ${r.agi} bb ${r.bb} fac ${r.fac} ${r.pre}`);
}
