// Gegenpruefung G10: Level/Erfolge/Vorrat aller Operationen und Vertraege je Spielstand (BN2.1).
import fs from "node:fs";
import path from "node:path";
import { ladeSpielstand, flach } from "./blade-lage.mjs";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const muster = process.argv[2] || "BN2L1_2026-10-0";
const dateien = fs.readdirSync(path.join(root, "backups")).filter((f) => f.includes(muster) && f.endsWith(".json.gz")).sort();
for (const f of dateien) {
  const { p } = ladeSpielstand(path.join(root, "backups", f));
  const bb = flach(p.bladeburner); if (!bb) continue;
  const o = bb.operations, c = bb.contracts;
  const z = (n, a) => n.slice(0, 5) + " L" + a.level + "/" + a.maxLevel + " ok" + a.successes + " f" + a.failures + " v" + Number(a.count).toFixed(0);
  console.log(f.replace(/^LIVE_[0-9a-f]+_/, "").replace(".json.gz", "").padEnd(36), "Rang", String(Math.round(bb.rank)).padStart(6), "|", ["Raid", "Assassination", "Stealth Retirement Operation"].map((n) => z(n, o[n])).join(" | "), "|", ["Retirement", "Bounty Hunter", "Tracking"].map((n) => z(n, c[n])).join(" | "));
}
