// Gegenpruefung G06: wo steht die hoechste gekaufte Amortisation (Zeile, Stand)?
import fs from "node:fs";
import { loadSave, textFile } from "./hack-save.mjs";
const files = fs.readdirSync("backups").filter((f) => f.startsWith("LIVE_") && f.endsWith(".json.gz")).sort();
const top = [];
for (const f of files) {
  let servers; try { ({ servers } = loadSave("backups/" + f)); } catch { continue; }
  const txt = textFile(servers.home, "data/bn4net-log.txt"); if (!txt) continue;
  for (const line of txt.split("\n")) {
    const m = line.match(/^(\d\d:\d\d:\d\d)\s+(\S+): (\d+) -> (\d+) GB bestellt fuer rund ([\d.]+)m, amortisiert in (\d+) s\./);
    if (m && +m[6] > 900) top.push([+m[6], f.replace("LIVE_197f4d61481686_", ""), line]);
  }
}
top.sort((a, b) => b[0] - a[0]);
const seen = new Set();
for (const t of top) { if (seen.has(t[2])) continue; seen.add(t[2]); console.log(t[0], t[1], t[2]); if (seen.size > 12) break; }
