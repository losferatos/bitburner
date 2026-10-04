// Gegenpruefung G10 (BLADE-1): Rang-/Black-Op-Verlauf von BN2.1, um zu sehen,
// WELCHE Phase vom Raid-Rang getragen war und welche von der Chance.
// Je Stand: Rang, Black Ops erledigt, naechste Black Op (Rang noetig),
// bot-Telemetrie data/blade.json (Typhoon-Chance, Stadt, Aktion), Stunde.
// Aufruf: node tools/audit/verify-g10-knotenlauf.mjs [muster=BN2L]
import fs from "node:fs";
import path from "node:path";
import { ladeSpielstand, flach, homeDatei } from "./blade-lage.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const muster = process.argv[2] || "BN2L";
const dateien = fs.readdirSync(path.join(root, "backups")).filter((f) => f.includes(muster) && f.endsWith(".json.gz")).sort();
for (const f of dateien) {
  const st = ladeSpielstand(path.join(root, "backups", f));
  const bb = st.p.bladeburner ? flach(st.p.bladeburner) : null;
  if (!bb) continue;
  const kopf = f.replace(/^LIVE_[0-9a-f]+_/, "").replace(".json.gz", "");
  let bj = null;
  try { bj = JSON.parse(homeDatei(st.servers, "data/blade.json")); } catch { /* fehlt */ }
  const sk = st.p.skills;
  console.log(kopf.padEnd(38), "Rang", String(Math.round(bb.rank)).padStart(7), "BO", String(bb.numBlackOpsComplete).padStart(2),
    "Kampf", [sk.strength, sk.defense, sk.dexterity, sk.agility].map(Math.round).join("/"),
    "SP", bb.skillPoints, "| aktion:", bj ? (bj.aktion || bj.action || "?") : "-", "| BO-Chance", bj ? (bj.boChance ?? bj.boChancen ?? JSON.stringify(bj.boChancen)?.slice(0, 40) ?? "-") : "-",
    "Stadt", bb.city);
}
