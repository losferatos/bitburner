// Gegenpruefung G06: Konto gegen Aug-Ruecklage (data/geldbedarf.txt) je Stand,
// dazu Park -> zeigt, ob bn4net (geldFrei = Konto - Ruecklage) Spielraum hatte.
import fs from "node:fs";
import { loadSave, textFile } from "./hack-save.mjs";
const muster = process.argv[2] || "BN2L";
const files = fs.readdirSync("backups").filter((f) => f.includes(muster) && f.endsWith(".json.gz")).sort();
for (const f of files) {
  const { p, servers } = loadSave("backups/" + f);
  const res = Number(textFile(servers.home, "data/geldbedarf.txt")) || 0;
  const park = (p.purchasedServers || []).reduce((a, h) => a + (servers[h] ? servers[h].maxRam : 0), 0);
  let torMode = null;
  try { const r = JSON.parse(textFile(servers.home, "data/bn4rep.json")); torMode = r.torRunde && r.torRunde.mode; } catch {}
  console.log(f.replace("LIVE_197f4d61481686_", "").replace(".json.gz", "").padEnd(34),
    "Konto", (p.money / 1e9).toFixed(2).padStart(7), "Mrd  Ruecklage", (res / 1e9).toFixed(2).padStart(7), "Mrd  frei",
    ((p.money - res) / 1e9).toFixed(2).padStart(7), "Mrd  park", park, "tor", torMode);
}
