// Audit 03.10.2026, Bereich FAKT: Augmentierungs-Katalog aus dem Spielquellcode
// (reference/bitburner-src/src/Augmentation/Augmentations.ts + Enums.ts)
// als Daten nachgebaut. Liefert je Faktion die fuer den Bladeburner-Weg (V2)
// relevanten Stuecke mit Rep-Bedarf.
//
// Aufruf: node tools/audit/fakt-augs.mjs [--json] [--faction "Name"]
//
// Eichung: Stichproben gegen Werte, die im Spielstand bzw. Bot-Log stehen
// (siehe Ausgabe "EICHUNG" am Ende).
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const SRC = path.join(ROOT, "reference", "bitburner-src", "src");

function readEnum(file, enumName) {
  const t = fs.readFileSync(file, "utf8");
  const start = t.indexOf("export enum " + enumName);
  const body = t.slice(start, t.indexOf("}", start));
  const map = {};
  for (const m of body.matchAll(/(\w+)\s*=\s*"([^"]+)"/g)) map[m[1]] = m[2];
  return map;
}

export function loadAugs() {
  const augEnum = readEnum(path.join(SRC, "Augmentation", "Enums.ts"), "AugmentationName");
  const facEnum = readEnum(path.join(SRC, "Faction", "Enums.ts"), "FactionName");
  const t = fs.readFileSync(path.join(SRC, "Augmentation", "Augmentations.ts"), "utf8");
  const out = {};
  const re = /\[AugmentationName\.(\w+)\]:\s*\{/g;
  let m;
  while ((m = re.exec(t))) {
    // Klammern zaehlen bis zum Ende des Objekts
    let i = re.lastIndex, depth = 1;
    while (depth > 0 && i < t.length) {
      const c = t[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      i++;
    }
    const body = t.slice(re.lastIndex, i - 1);
    const name = augEnum[m[1]] || m[1];
    const a = { name, key: m[1], mults: {}, factions: [], isSpecial: false, prereqs: [] };
    // nur Felder der obersten Ebene (keine verschachtelten Objekte)
    for (const f of body.matchAll(/^\s{6}(\w+):\s*([^,\n]+),?\s*$/gm)) {
      const k = f[1], v = f[2].trim();
      if (k === "repCost") a.repCost = Number(eval(v));
      else if (k === "moneyCost") a.moneyCost = Number(eval(v));
      else if (k === "isSpecial") a.isSpecial = v.startsWith("true");
      else if (/^-?[\d.e]+$/.test(v)) a.mults[k] = Number(v);
    }
    const fm = body.match(/factions:\s*\[([\s\S]*?)\]/);
    if (fm) for (const x of fm[1].matchAll(/FactionName\.(\w+)/g)) a.factions.push(facEnum[x[1]] || x[1]);
    const pm = body.match(/prereqs:\s*\[([\s\S]*?)\]/);
    if (pm) for (const x of pm[1].matchAll(/AugmentationName\.(\w+)/g)) a.prereqs.push(augEnum[x[1]] || x[1]);
    out[name] = a;
  }
  return out;
}

// Grobes V2-Mass: Kampfwerte gehen in die Bladeburner-Erfolgschance ein
// (Bladeburner/Actions/Action.ts getSuccessChance -> competence). Mass =
// mittlerer ln-Gewinn der vier Kampf-Multiplikatoren + ln(bb_success) +
// halbes ln der Erfahrungs-Mults. Nur fuer die RANGFOLGE, nicht als Ertrag.
export function v2Value(a) {
  const g = (k) => Math.log(a.mults[k] || 1);
  const combat = (g("strength") + g("defense") + g("dexterity") + g("agility")) / 4;
  const combatExp = (g("strength_exp") + g("defense_exp") + g("dexterity_exp") + g("agility_exp")) / 4;
  return combat + 0.5 * combatExp + g("bladeburner_success_chance") + 0.25 * g("bladeburner_stamina_gain")
    + 0.25 * g("bladeburner_max_stamina") + 0.1 * g("bladeburner_analysis");
}

if (process.argv[1] && process.argv[1].endsWith("fakt-augs.mjs")) {
  const augs = loadAugs();
  const args = process.argv.slice(2);
  const only = args.includes("--faction") ? args[args.indexOf("--faction") + 1] : null;
  const byFac = {};
  for (const a of Object.values(augs)) for (const f of a.factions) (byFac[f] ||= []).push(a);
  if (args.includes("--json")) { console.log(JSON.stringify(augs, null, 1)); process.exit(0); }
  console.log("Anzahl Augs:", Object.keys(augs).length);
  for (const [f, list] of Object.entries(byFac).sort()) {
    if (only && f !== only) continue;
    const v2 = list.filter((a) => v2Value(a) > 0).sort((x, y) => x.repCost - y.repCost);
    const sum = v2.reduce((s, a) => s + v2Value(a), 0);
    console.log("\n" + f + "  (V2-relevant " + v2.length + "/" + list.length + ", Summe ln " + sum.toFixed(3) + ")");
    for (const a of v2) {
      const uniq = a.factions.length === 1 ? " EINZIG" : " (" + a.factions.length + " Faktionen)";
      console.log("   " + String(a.repCost).padStart(8) + " rep  " + a.name.padEnd(48) + " v2=" + v2Value(a).toFixed(3) + uniq);
    }
  }
  // EICHUNG: bekannte Werte aus dem Spielstand / Bot-Log
  const chk = [
    ["EsperTech Bladeburner Eyewear", 1.25e3],
    ["EMS-4 Recombination", 2.5e3],
    ["Wired Reflexes", 1.25e3],
    ["Neurotrainer I", 1e3],
    ["Embedded Netburner Module Core V2 Upgrade", 1e6 * 0 + augs["Embedded Netburner Module Core V2 Upgrade"]?.repCost],
  ];
  console.log("\nEICHUNG (Soll aus Quellcode-Literal / Ist aus Parser):");
  for (const [n, soll] of chk) console.log("  " + n + ": Ist " + (augs[n] ? augs[n].repCost : "FEHLT") + " / Soll " + soll);
}
