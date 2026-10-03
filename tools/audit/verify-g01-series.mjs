// verify-g01-series.mjs - Zeitreihe eines Laufs aus backups/ (eigener Leser).
// Aufruf: node tools/audit/verify-g01-series.mjs <bitNode> <lauf> [--blade]
import fs from "node:fs";
import path from "node:path";
import { loadSave, flat, ROOT, homeFile } from "./verify-g01-save.mjs";

const [bn, run] = [Number(process.argv[2] || 2), Number(process.argv[3] || 1)];
const withBlade = process.argv.includes("--blade");
const idx = fs.readFileSync(path.join(ROOT, "backups/INDEX.tsv"), "utf8").trim().split("\n").slice(1).map((l) => l.split("\t"));
const rows = idx.filter((r) => Number(r[4]) === bn && Number(r[5]) === run);
let last = null;
for (const r of rows) {
  const file = r[1];
  let s;
  try { s = loadSave(file); } catch (e) { console.log("FEHLER", file, e.message); continue; }
  const p = s.player;
  const bb = flat(p.bladeburner) || {};
  const ms = flat(p.moneySourceB) || {};
  const h = p.playtimeSinceLastBitnode / 3.6e6;
  const augH = p.playtimeSinceLastAug / 3.6e6;
  const sk = p.skills;
  const line = [r[0].slice(5, 16), r[7].padEnd(11), "h", h.toFixed(2), "augH", augH.toFixed(2),
    "rank", (bb.rank ?? 0).toFixed(0), "bo", bb.numBlackOpsComplete ?? 0, "stored", ((bb.storedCycles ?? 0) / 5 / 3600).toFixed(2) + "h",
    "str/def/dex/agi", [sk.strength, sk.defense, sk.dexterity, sk.agility].join("/"),
    "mStr", p.mults.strength.toFixed(3), "mBB", p.mults.bladeburner_success_chance.toFixed(3),
    "augs", (p.augmentations || []).length, "q", (p.queuedAugmentations || []).length,
    "$", (p.money / 1e9).toFixed(2) + "G", "hackInc", ((ms.hacking ?? 0) / 1e9).toFixed(1) + "G",
    "augSpent", ((ms.augmentations ?? 0) / 1e9).toFixed(1) + "G", "karma", (p.karma ?? 0).toFixed(0)];
  if (withBlade) {
    const bj = homeFile(s.servers, "data/blade.json");
    if (bj) { try { const b = JSON.parse(bj); line.push("akt", b.aktion, "L", b.stufe, "ch", b.chance, "Typh", b.boChancen?.["Operation Typhoon"], "Daed", b.boChancen?.["Operation Daedalus"]); } catch {} }
  }
  console.log(line.join(" "));
}
