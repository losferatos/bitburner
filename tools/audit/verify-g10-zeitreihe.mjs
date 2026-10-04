// Gegenpruefung G10 (BLADE-1): Zeitreihe der Staedte ueber alle BN2-Spielstaende.
// Zeigt je Stand: aktuelle Stadt, pop/popEst/r/chaos/comms je Stadt, Rang,
// Raid-Zaehler (Erfolge/Fehlschlaege), Vorrat. Nur lesen.
// Aufruf: node tools/audit/verify-g10-zeitreihe.mjs [muster=BN2L]
import fs from "node:fs";
import path from "node:path";
import { ladeSpielstand, flach } from "./blade-lage.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const muster = process.argv[2] || "BN2L";
const dateien = fs.readdirSync(path.join(root, "backups")).filter((f) => f.includes(muster) && f.endsWith(".json.gz")).sort();
const kurz = { "Sector-12": "S12", Aevum: "Aev", Volhaven: "Vol", Chongqing: "Cho", "New Tokyo": "NTo", Ishima: "Ish" };
for (const f of dateien) {
  let st;
  try { st = ladeSpielstand(path.join(root, "backups", f)); } catch (e) { console.log(f, "FEHLER", e.message); continue; }
  const bb = st.p.bladeburner ? flach(st.p.bladeburner) : null;
  if (!bb) { console.log(f, "keine Division"); continue; }
  const raid = bb.operations.Raid;
  const kopf = f.replace(/^LIVE_[0-9a-f]+_/, "").replace(".json.gz", "");
  const zeilen = Object.entries(bb.cities).map(([n, c]) => kurz[n] + (n === bb.city ? "*" : " ") + " pop " + String(Math.round(c.pop / 1e6)).padStart(5) + "M est " + String(Math.round(c.popEst / 1e6)).padStart(5) + "M r " + (c.pop / c.popEst).toFixed(2) + " ch " + c.chaos.toFixed(1).padStart(6) + " cm " + String(c.comms).padStart(3));
  console.log("\n" + kopf, "Rang", Math.round(bb.rank), "Raid L" + raid.level, "ok", raid.successes, "fehl", raid.failures, "Vorrat", Number(raid.count).toFixed(1), "HP/Stadt:", bb.city);
  for (const z of zeilen) console.log("   " + z);
}
