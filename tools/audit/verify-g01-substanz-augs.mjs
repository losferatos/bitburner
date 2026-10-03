// Gegenpruefung G01 (Substanz): Augmentierungsdaten direkt aus dem Spielquellcode
// (reference/bitburner-src/src/Augmentation/Augmentations.ts + Enums.ts),
// unabhaengig von aug-data.mjs / gang-augs.mjs des Erstpruefers.
// Verfahren: Objektliteral "metadata" ausschneiden, Enum-Bezuege durch die
// echten Namen ersetzen, als JS auswerten.
//
// Aufruf: node tools/audit/verify-g01-substanz-augs.mjs   (gibt die Gang-Angebotsliste BN2 aus)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = path.join(ROOT, "reference", "bitburner-src", "src");

function parseEnum(file, enumName) {
  const txt = fs.readFileSync(file, "utf8");
  const start = txt.indexOf("export enum " + enumName);
  const body = txt.slice(start, txt.indexOf("}", start));
  const map = {};
  for (const m of body.matchAll(/^\s*(\w+)\s*=\s*"([^"]*)"/gm)) map[m[1]] = m[2];
  return map;
}

export function loadAugs() {
  const augEnum = parseEnum(path.join(SRC, "Augmentation", "Enums.ts"), "AugmentationName");
  const facEnum = parseEnum(path.join(SRC, "Faction", "Enums.ts"), "FactionName");
  const txt = fs.readFileSync(path.join(SRC, "Augmentation", "Augmentations.ts"), "utf8");
  const a = txt.indexOf("const metadata");
  const objStart = txt.indexOf("= {", a) + 2;
  const objEnd = txt.indexOf("  return createEnumKeyedRecord", objStart);
  let body = txt.slice(objStart, objEnd).trim();
  body = body.replace(/;\s*$/, "");
  body = body.replace(/ as [A-Za-z<>\[\]]+/g, "");
  // eslint-disable-next-line no-new-func
  // Unstable Circadian Modulator: Boni wechseln stuendlich (CircadianModulator.ts), hier ohne Werte gefuehrt
  const ucm = () => ({ moneyCost: 5e9, repCost: 3.625e5, factions: ["Speakers for the Dead"], ucmRandom: true });
  const fn = new Function("donationBonus", "CONSTANTS", "AugmentationName", "FactionName", "CompletedProgramName",
    "getUnstableCircadianModulatorParams", "return (" + body + ");");
  const progProxy = new Proxy({}, { get: (_, k) => String(k) });
  const meta = fn(0, { Donations: 0 }, augEnum, facEnum, progProxy, ucm);
  // Reihenfolge = Reihenfolge des Enums (wie createEnumKeyedRecord)
  const list = [];
  for (const name of Object.values(augEnum)) {
    const d = meta[name];
    if (!d) continue; // z.B. UnstableCircadianModulator wird separat erzeugt
    list.push({ name, ...d });
  }
  return { list, augEnum, facEnum };
}

export const COMBAT_KEYS = ["strength", "defense", "dexterity", "agility"];
export function isCombatAug(a) {
  return COMBAT_KEYS.some((k) => a[k] && a[k] !== 1);
}

function main() {
  const { list } = loadAugs();
  const special = list.filter((a) => a.isSpecial);
  const bbAugs = list.filter((a) => (a.factions || []).includes("Bladeburners"));
  console.log("Augs gesamt", list.length, "| isSpecial", special.length);
  console.log("Bladeburners-Augs:", bbAugs.length, "davon isSpecial:", bbAugs.filter((a) => a.isSpecial).length,
    "| nicht speziell:", bbAugs.filter((a) => !a.isSpecial).map((a) => a.name).join(", "));
  // Gang-Angebot BN2 (FactionHelpers.tsx:172-200): alle !isSpecial ausser Congruity, plus TRP
  const offer = list.filter((a) => !a.isSpecial && a.name !== "Congruity Implant");
  if (!offer.find((a) => a.name === "The Red Pill")) offer.push(list.find((a) => a.name === "The Red Pill"));
  const combat = offer.filter(isCombatAug);
  console.log("Gang-Angebot BN2:", offer.length, "| davon mit Kampfwert:", combat.length);
  console.log("Kampf-Augs (rep / Preis Mrd / str def dex agi / prereq):");
  for (const a of combat.sort((x, y) => y.moneyCost - x.moneyCost)) {
    console.log("  " + a.name.padEnd(42), String(a.repCost).padStart(9), (a.moneyCost / 1e9).toFixed(3).padStart(9),
      COMBAT_KEYS.map((k) => (a[k] || 1).toFixed(2)).join(" "), (a.prereqs || []).join("+"));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
