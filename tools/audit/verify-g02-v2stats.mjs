// Gegenpruefung G02: Koennen Hacknet-Augs im V2 ueber eine Zaehlschwelle
// (Daedalus, Covenant, Illuminati) doch etwas wert sein?
// Liest je V2-Lauf (BN4L2/L3, BN9L1-3, BN10L2/L3, BN2L1) den spaetesten Spielstand
// und zeigt Kampfwerte (min der vier), Hacking, Zahl der INSTALLIERTEN Augs
// (Player.augmentations.length - so zaehlt FactionInfo.tsx haveAugmentations),
// Rang. Schwellen aus dem Spielquellcode:
//   Daedalus  FactionInfo.tsx:138-149  augs >= DaedalusAugsRequirement (30, BN-abh.),
//             100e9 $, hacking 2500 ODER alle Kampfwerte 1500
//   Covenant / Illuminati: werden unten aus FactionInfo.tsx gelesen und ausgegeben.
// Nur lesen. Aufruf: node tools/audit/verify-g02-v2stats.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const B = path.join(ROOT, "backups");
const SRC = path.join(ROOT, "reference", "bitburner-src", "src");
const flat = (x) => (x && typeof x === "object" && "ctor" in x && "data" in x ? x.data : x);

// Schwellen direkt aus dem Quellcode zeigen (kein Abschreiben)
const fi = fs.readFileSync(path.join(SRC, "Faction", "FactionInfo.tsx"), "utf8");
for (const name of ["Daedalus", "TheCovenant", "Illuminati"]) {
  const i = fi.indexOf("[FactionName." + name + "]");
  const block = fi.slice(i, fi.indexOf("}),", i));
  const reqs = block.slice(block.indexOf("inviteReqs"), block.indexOf("],", block.indexOf("inviteReqs")) + 1)
    .replace(/\s+/g, " ");
  console.log(name.padEnd(12), reqs);
}

const runs = ["BN4L2", "BN4L3", "BN9L1", "BN9L2", "BN9L3", "BN10L2", "BN10L3", "BN2L1"];
const files = fs.readdirSync(B).filter((f) => f.endsWith(".json.gz"));
console.log("\nLauf    Datei(spaetester Stand)                      minKampf  str/def/dex/agi           hack  installiert  Rang");
for (const r of runs) {
  const fs_ = files.filter((f) => f.includes("_" + r + "_")).sort();
  if (!fs_.length) continue;
  // spaetester Stand nach totalPlaytime, nicht nach Dateiname
  let best = null;
  for (const f of fs_) {
    const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(B, f))).toString("utf8"));
    const p = JSON.parse(save.data.PlayerSave).data;
    if (!best || p.totalPlaytime > best.p.totalPlaytime) best = { f, p };
  }
  // Maximum ueber alle Staende des Laufs (Kampfwerte koennen nach Einbau fallen)
  let maxMin = 0;
  for (const f of fs_) {
    const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(B, f))).toString("utf8"));
    const p = JSON.parse(save.data.PlayerSave).data;
    const s = p.skills;
    maxMin = Math.max(maxMin, Math.min(s.strength, s.defense, s.dexterity, s.agility));
  }
  const { f, p } = best;
  const s = p.skills;
  const bb = flat(p.bladeburner) || {};
  console.log(r.padEnd(7), f.slice(26, 54).padEnd(44), String(Math.min(s.strength, s.defense, s.dexterity, s.agility)).padStart(6),
    ("max " + maxMin).padStart(9), `${s.strength}/${s.defense}/${s.dexterity}/${s.agility}`.padEnd(20), String(s.hacking).padStart(5),
    String(p.augmentations.length).padStart(8), String(Math.round(bb.rank || 0)).padStart(9));
}
