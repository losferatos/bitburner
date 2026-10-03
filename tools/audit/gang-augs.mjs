// Gang-Audit: Welche Augmentierungen verkauft eine Gang-Faktion, und was
// bringen sie fuer den Bladeburner-Ausgang (V2)?
//
// Quelle: reference/bitburner-src/src/Augmentation/Augmentations.ts (Block je
// Aug), Enums in src/Faction/Enums.ts und src/Augmentation/Enums.ts.
// Filter der Gang-Faktion: src/Faction/FactionHelpers.tsx:172-200
//   - !isSpecial und nicht Congruity Implant
//   - BN2: plus The Red Pill
//   - Ein-Faktion-Augs nur mit Wahrscheinlichkeit GangUniqueAugs (BN2 = 1)
//
// Aufruf: node tools/audit/gang-augs.mjs
// Ausgabe: Tabelle der kampf-/bladeburner-relevanten Augs mit Rep, Preis,
// Faktionen; Produkt der Kampfmultiplikatoren ueber Rep-Schwellen.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const SRC = path.join(ROOT, "reference", "bitburner-src", "src");

function parseEnum(file, enumName) {
  const t = fs.readFileSync(file, "utf8");
  const i = t.indexOf("export enum " + enumName);
  const j = t.indexOf("}", i);
  const out = {};
  for (const m of t.slice(i, j).matchAll(/(\w+)\s*=\s*"([^"]+)"/g)) out[m[1]] = m[2];
  return out;
}

// Liest jeden Block "[AugmentationName.X]: { ... }" bis zur passenden Klammer.
export function parseAugs() {
  const augEnum = parseEnum(path.join(SRC, "Augmentation", "Enums.ts"), "AugmentationName");
  const facEnum = parseEnum(path.join(SRC, "Faction", "Enums.ts"), "FactionName");
  const t = fs.readFileSync(path.join(SRC, "Augmentation", "Augmentations.ts"), "utf8");
  const res = [];
  const re = /\[AugmentationName\.(\w+)\]:\s*\{/g;
  let m;
  while ((m = re.exec(t))) {
    let depth = 1, k = re.lastIndex;
    while (depth > 0 && k < t.length) {
      const c = t[k];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      k++;
    }
    const body = t.slice(re.lastIndex, k - 1);
    const key = m[1];
    const num = (f) => {
      const mm = body.match(new RegExp("(?:^|\\n)\\s*" + f + ":\\s*([0-9.e+\\-]+)\\s*,"));
      return mm ? Number(mm[1]) : undefined;
    };
    const facM = body.match(/factions:\s*\[([^\]]*)\]/);
    const factions = facM ? [...facM[1].matchAll(/FactionName\.(\w+)/g)].map((x) => facEnum[x[1]] || x[1]) : [];
    res.push({
      key, name: augEnum[key] || key,
      repCost: num("repCost"), moneyCost: num("moneyCost"),
      isSpecial: /isSpecial:\s*true/.test(body),
      strength: num("strength"), defense: num("defense"), dexterity: num("dexterity"), agility: num("agility"),
      bb_success: num("bladeburner_success_chance"), bb_stamina_gain: num("bladeburner_stamina_gain"),
      bb_max_stamina: num("bladeburner_max_stamina"), bb_analysis: num("bladeburner_analysis"),
      faction_rep: num("faction_rep"),
      factions,
      // Voraussetzungen (Augmentations.ts "prereqs: [AugmentationName.X, ...]")
      prereqs: [...(((body.match(/prereqs:\s*\[([^\]]*)\]/) || [])[1]) || "").matchAll(/AugmentationName\.(\w+)/g)]
        .map((x) => augEnum[x[1]] || x[1]),
    });
  }
  return res;
}

// Gang-Faktionsfilter (FactionHelpers.tsx:172-200), BN2 mit GangUniqueAugs = 1:
// rng() >= 1 - 1 = 0 ist immer wahr, also bleiben alle Ein-Faktion-Augs.
export function gangOffer(augs, bitNodeN = 2, gangUniqueAugs = 1) {
  return augs.filter((a) => !a.isSpecial && a.name !== "violet Congruity Implant")
    .filter((a) => a.factions.length > 1 || gangUniqueAugs >= 1) // Erwartungswert-Filter fuer <1 extra
    .concat(bitNodeN === 2 ? augs.filter((a) => a.name === "The Red Pill") : []);
}

// Casino/RNG.ts:65-93 SFC32RNG (wortgleich)
export function SFC32RNG(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const genSeed = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
  let a = genSeed(), b = genSeed(), c = genSeed(), d = genSeed();
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

// Exakter Nachbau von getFactionAugmentationsFiltered fuer die Gang-Faktion
// (FactionHelpers.tsx:172-200): Reihenfolge = AugmentationName-Enum
// (Augmentations.ts:2091 createEnumKeyedRecord), Saat "BN<n>.<SF-Stufe n>".
export function exactGangOffer(bitNodeN, sfLvl, gangUniqueAugs, gangFaction = "Slum Snakes") {
  const augEnum = parseEnum(path.join(SRC, "Augmentation", "Enums.ts"), "AugmentationName");
  const parsed = Object.fromEntries(parseAugs().map((a) => [a.name, a]));
  // Unstable Circadian Modulator steht als Funktionsaufruf im Quelltext (Augmentations.ts:1970),
  // Faktion Speakers for the Dead (CircadianModulator.ts:19), nicht isSpecial.
  parsed["Unstable Circadian Modulator"] ??= { name: "Unstable Circadian Modulator", factions: ["Speakers for the Dead"], isSpecial: false };
  let list = Object.values(augEnum).map((n) => parsed[n]).filter(Boolean);
  const facAugs = list.filter((a) => a.factions.includes(gangFaction)).map((a) => a.name);
  list = list.filter((a) => !a.isSpecial && a.name !== "violet Congruity Implant");
  if (bitNodeN === 2) list.push(parsed["The Red Pill"]);
  const rng = SFC32RNG(`BN${bitNodeN}.${sfLvl}`);
  return list.filter((a) => {
    if (a.factions.length > 1) return true;
    if (facAugs.includes(a.name)) return true;
    return rng() >= 1 - gangUniqueAugs;
  }).map((a) => a.name);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (isMain) {
  const augs = parseAugs();
  console.log("Augs geparst:", augs.length, "davon isSpecial:", augs.filter((a) => a.isSpecial).map((a) => a.name).join(", "));
  const offer = gangOffer(augs);
  console.log("Gang-Faktion BN2 bietet:", offer.length);
  const combat = (a) => (a.strength || 1) * (a.defense || 1) * (a.dexterity || 1) * (a.agility || 1);
  const rel = offer.filter((a) => combat(a) > 1 || a.bb_success || a.bb_stamina_gain || a.bb_max_stamina)
    .sort((x, y) => x.repCost - y.repCost);
  console.log("\nKampf-/Bladeburner-relevant (sortiert nach Rep):");
  console.log("Rep        Preis      str  def  dex  agi  bbS  Name | Faktionen");
  for (const a of rel) {
    const f = (v) => (v ? v.toFixed(2) : "  - ").padStart(4);
    console.log(String(a.repCost).padEnd(10), (a.moneyCost / 1e9).toFixed(3).padStart(7) + "e9",
      f(a.strength), f(a.defense), f(a.dexterity), f(a.agility), f(a.bb_success), a.name, "|", a.factions.join(", "));
  }
  // TRP
  const trp = augs.find((a) => a.name === "The Red Pill");
  console.log("\nThe Red Pill:", JSON.stringify({ rep: trp.repCost, money: trp.moneyCost, isSpecial: trp.isSpecial, factions: trp.factions }));
  const nfg = augs.find((a) => a.name === "NeuroFlux Governor");
  console.log("NeuroFlux Governor isSpecial:", nfg && nfg.isSpecial);
  // JSON fuer andere Rechner
  fs.writeFileSync(path.join(ROOT, "tools", "audit", "gang-augs.json"), JSON.stringify(rel, null, 1));
}
