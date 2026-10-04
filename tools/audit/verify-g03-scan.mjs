// Gegenpruefung G03: Wie verbreitet ist "kostet -0.0m - warte auf Geld" (shop-log) ueber ALLE Spielstaende?
// Aufruf: node tools/audit/verify-g03-scan.mjs
import fs from "node:fs";
import { readSave } from "./infra-save.mjs";
const files = fs.readdirSync("backups").filter((f) => f.endsWith(".json.gz")).sort();
const per = {};
for (const f of files) {
  const m = f.match(/_BN(\d+)L(\d+)_(\d{4}-\d\d-\d\d)T(\d\d-\d\d)/);
  if (!m) continue;
  let servers;
  try { ({ servers } = readSave("backups/" + f)); } catch { continue; }
  const tf = servers.home.data.textFiles.data.find(([n]) => n === "data/shop-log.txt");
  const text = tf ? ((tf[1].data || tf[1]).text || "") : "";
  const hit = /kostet -0\.0m/.test(text);
  const hasUp = /Ausbau werk-\d+ auf/.test(text) || /Ausgebaut:/.test(text);
  const key = "BN" + m[1];
  per[key] = per[key] || { saves: 0, mitAusbauzeile: 0, mitMinus: 0, vor0904: 0 };
  per[key].saves++;
  if (hasUp) per[key].mitAusbauzeile++;
  if (hit) per[key].mitMinus++;
  if (m[3] < "2026-09-05") per[key].vor0904++;
}
console.log(JSON.stringify(per, null, 1));
