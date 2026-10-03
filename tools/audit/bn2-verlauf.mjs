// BN2-Audit 03.10.2026: Rang-Verlauf aller V2-Laeufe aus den Spielstaenden.
// Liest backups/INDEX.tsv-Dateien je Lauf (BN2L1, BN4L2, BN4L3, BN9L1-3,
// BN10L2-3) und gibt je Stand aus: Stunden im Knoten, Rang, maxRank,
// abgeschlossene Black Ops, Kampf-Mults, Anzahl Augs, Geld.
//
// Aufruf: node tools/audit/bn2-verlauf.mjs [Lauf ...]   z.B. BN2L1 BN4L2
// Nur lesen.
import fs from "node:fs";
import path from "node:path";
import { readSave } from "./gang-save.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const BACKUPS = path.join(ROOT, "backups");

export function runFiles(run) {
  return fs.readdirSync(BACKUPS).filter((f) => f.includes("_" + run + "_") && f.endsWith(".json.gz")).sort();
}

export function point(file) {
  const { p } = readSave(path.join(BACKUPS, file));
  const bb = p.bladeburner ? (p.bladeburner.data || p.bladeburner) : null;
  const m = p.mults;
  return {
    file,
    h: p.playtimeSinceLastBitnode / 3.6e6,
    hAug: p.playtimeSinceLastAug / 3.6e6,
    rank: bb ? bb.rank : null,
    maxRank: bb ? bb.maxRank : null,
    bo: bb ? bb.numBlackOpsComplete : null,
    sp: bb ? bb.totalSkillPoints : null,
    str: m.strength, def: m.defense, dex: m.dexterity, agi: m.agility,
    bbSucc: m.bladeburner_success_chance,
    skills: p.skills,
    augs: (p.augmentations || []).length,
    queued: (p.queuedAugmentations || []).length,
    money: p.money,
    karma: p.karma,
  };
}

const fmt = (x, d = 2) => (x == null ? "-" : Number(x).toFixed(d));

if (import.meta.url === "file:///" + process.argv[1].replace(/\\/g, "/") || process.argv[1].endsWith("bn2-verlauf.mjs")) {
  const runs = process.argv.slice(2).length ? process.argv.slice(2) : ["BN2L1", "BN4L2", "BN4L3"];
  for (const run of runs) {
    const files = runFiles(run);
    console.log("== " + run + " (" + files.length + " Staende)");
    console.log("h_node  h_aug  rank      maxRank   BO  SP    str   dex   agi   augs q  money     karma  file");
    let last = -1;
    for (const f of files) {
      const pt = point(f);
      // je Stunde hoechstens ein Punkt, plus der letzte
      if (pt.h - last < 0.9 && f !== files[files.length - 1]) continue;
      last = pt.h;
      console.log([fmt(pt.h, 2).padStart(6), fmt(pt.hAug, 2).padStart(5), fmt(pt.rank, 0).padStart(8), fmt(pt.maxRank, 0).padStart(8),
        String(pt.bo).padStart(3), String(pt.sp).padStart(5), fmt(pt.str).padStart(5), fmt(pt.dex).padStart(5), fmt(pt.agi).padStart(5),
        String(pt.augs).padStart(4), String(pt.queued).padStart(2), pt.money.toExponential(2).padStart(9), fmt(pt.karma, 0).padStart(6), f.slice(25, 60)].join(" "));
    }
  }
}
