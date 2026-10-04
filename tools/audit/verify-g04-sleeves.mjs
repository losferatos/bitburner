// Audit 04.10.2026, Gegenpruefung G04: Arbeit von Spieler UND Sleeves in jedem Stand
// (share hat nur Abnehmer, wenn Spieler oder ein Sleeve FactionWork macht).
// Aufruf: node tools/audit/verify-g04-sleeves.mjs <muster>
import fs from "node:fs";
import { loadSave } from "./hack-save.mjs";
const muster = process.argv[2] || "BN2L";
const files = fs.readdirSync("backups").filter((f) => f.includes(muster) && f.endsWith(".json.gz")).sort();
const zaehl = {};
for (const f of files) {
  const { p } = loadSave("backups/" + f);
  const sl = (p.sleeves || []).map((s) => {
    const x = s.data || s; const w = x.currentWork; return w ? (w.ctor || w.type || "?") + (w.data && w.data.factionName ? ":" + w.data.factionName : "") + (w.data && w.data.crimeType ? ":" + w.data.crimeType : "") + (w.data && w.data.classType ? ":" + w.data.classType : "") : "null";
  });
  const pw = p.currentWork ? (p.currentWork.ctor || "?") : "null";
  for (const k of [pw, ...sl]) zaehl[k] = (zaehl[k] || 0) + 1;
  console.log(f.replace(/^LIVE_\w+?_/, "").replace(".json.gz", ""), "player:", pw, "| sleeves:", sl.join(", "));
}
console.log(zaehl);
