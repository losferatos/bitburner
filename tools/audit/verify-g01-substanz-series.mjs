// Gegenpruefung G01 (Substanz): Zeitreihe eines Laufs aus allen Spielstaenden.
// Je Spielstand: Knotenzeit, ausstehende BB-Bonuszeit, effektive BB-Zeit,
// Rang, Geld, installierte/wartende Augs, Kampf-Mults.
//
// Aufruf: node tools/audit/verify-g01-substanz-series.mjs <Teilstring, z.B. BN2L1>
import fs from "node:fs";
import path from "node:path";
import { loadSave, ROOT } from "./verify-g01-substanz-save.mjs";

const part = process.argv[2] || "BN2L1";
const dir = path.join(ROOT, "backups");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json.gz") && f.includes(part)).sort();
console.log("datei | hKnoten | bonus_h | eff_h | rang | geld_Mrd | augsInst | queued | str_mult | agi_mult | str | agi | stamMax");
for (const f of files) {
  let s;
  try { s = loadSave(path.join(dir, f)); } catch (e) { console.log(f, "FEHLER", e.message); continue; }
  const p = s.player;
  const bb = p.bladeburner && (p.bladeburner.data || p.bladeburner);
  const h = p.playtimeSinceLastBitnode / 3.6e6;
  // storedCycles: 5 Zyklen je Sekunde
  const bonusH = bb ? (bb.storedCycles || 0) / 5 / 3600 : 0;
  const nInst = (p.augmentations || []).reduce((a, x) => a + (x.level || 1), 0);
  console.log([
    f.replace(/^LIVE_[0-9a-f]+_/, "").replace(".json.gz", ""),
    h.toFixed(2), bonusH.toFixed(2), (h - bonusH).toFixed(2),
    bb ? Math.round(bb.rank) : "-",
    (p.money / 1e9).toFixed(2),
    nInst, (p.queuedAugmentations || []).length,
    p.mults.strength.toFixed(3), p.mults.agility.toFixed(3),
    p.skills.strength, p.skills.agility,
    bb ? bb.maxStamina.toFixed(1) : "-",
  ].join(" | "));
}
