// Gegenpruefung G06 (HACK-4 b): wie zuverlaessig ist der Anlauf (Vorbereitung)
// in der Praxis? Zaehlt in allen Staenden bn4net-log.txt: "ist vorbereitet"
// gegen "Anlauf nach N min ohne Erfolg abgebrochen".
import fs from "node:fs";
import { loadSave, textFile } from "./hack-save.mjs";
const files = fs.readdirSync("backups").filter((f) => f.endsWith(".json.gz") && f.startsWith("LIVE_")).sort();
const seen = new Set(); const per = {};
for (const f of files) {
  let servers; try { ({ servers } = loadSave("backups/" + f)); } catch { continue; }
  const txt = textFile(servers.home, "data/bn4net-log.txt"); if (!txt) continue;
  const bn = f.replace("LIVE_197f4d61481686_", "").split("_")[0];
  const day = f.replace("LIVE_197f4d61481686_", "").split("_")[1].slice(0, 10);
  for (const line of txt.split("\n")) {
    const ok = / ist vorbereitet - Stapelbetrieb beginnt/.test(line);
    const ab = /: Anlauf nach (\d+) min ohne Erfolg abgebrochen/.exec(line);
    if (!ok && !ab) continue;
    const key = bn + day + line; if (seen.has(key)) continue; seen.add(key);
    per[bn] = per[bn] || { vorbereitet: 0, abgebrochen: 0, hosts: {} };
    if (ok) per[bn].vorbereitet++; else per[bn].abgebrochen++;
  }
}
for (const [k, v] of Object.entries(per)) console.log(k.padEnd(8), JSON.stringify(v));
