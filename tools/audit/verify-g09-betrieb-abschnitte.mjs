// G09-Betrieb: rohe Abschnitte des Aktionsprotokolls in einem Node-Stundenfenster.
// Aufruf: node ... <backupmuster> <vonH> <bisH>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ladeSpielstand, homeDatei } from "./blade-lage.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const [pat, von, bis] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4])];
const f = fs.readdirSync(path.join(root, "backups")).filter((x) => x.includes(pat))[0];
const { servers } = ladeSpielstand(path.join(root, "backups", f));
const bj = JSON.parse(homeDatei(servers, "data/blade.json") || "null");
const seit = bj.nodeReset;
const ak = (homeDatei(servers, "data/aktionen.txt") || "").split("\n").filter((z) => z.trim()).map((z) => { try { return JSON.parse(z); } catch { return null; } }).filter(Boolean);
for (const a of ak) {
  const h = (a.von - seit) / 3.6e6;
  if (h < von || h > bis) continue;
  console.log(h.toFixed(2), ((a.bis - a.von) / 60000).toFixed(1) + "m", a.aktion, "rang", a.rangVon, "->", a.rangBis, "n", a.n ?? a.anzahl ?? "", JSON.stringify(Object.fromEntries(Object.entries(a).filter(([k]) => !["von", "bis", "aktion", "rangVon", "rangBis"].includes(k)))).slice(0, 200));
}
