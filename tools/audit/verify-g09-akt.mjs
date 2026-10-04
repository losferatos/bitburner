// G09: Aktionsprotokoll (data/aktionen.txt) je Stunde des Knotens: Zeitanteile und Rang je Aktion.
// Aufruf: node verify-g09-akt.mjs <stand-muster> [binH]
import { readSave, homeText, homeJson, fmt } from "./verify-g09-lib.mjs";
import fs from "node:fs";
const pat = process.argv[2];
const bin = Number(process.argv[3] || 1);
const f = fs.readdirSync("C:/Users/erche/Desktop/claude_projecto/bitburner/backups").find((x) => x.includes(pat));
const { save, p } = readSave(f);
const bj = homeJson(save, "data/blade.json");
const nodeReset = bj && bj.nodeReset;
const txt = homeText(save, "data/aktionen.txt") || "";
const rows = txt.split("\n").filter((z) => z.trim()).map((z) => { try { return JSON.parse(z); } catch { return null; } }).filter(Boolean);
console.log("Datei", f, "Zeilen", rows.length, "nodeReset", nodeReset && new Date(nodeReset).toISOString(), "erste", new Date(rows[0].von).toISOString(), "letzte", new Date(rows[rows.length-1].bis).toISOString());
const sel = rows.filter((r) => r.von >= (nodeReset || 0));
const bins = new Map();
for (const r of sel) {
  const hb = Math.floor((r.von - nodeReset) / 3.6e6 / bin) * bin;
  const b = bins.get(hb) || {};
  const k = r.aktion;
  const e = b[k] || { ms: 0, rang: 0, n: 0 };
  e.ms += r.bis - r.von; e.n++;
  if (Number.isFinite(r.rangVon) && Number.isFinite(r.rangBis)) e.rang += r.rangBis - r.rangVon;
  b[k] = e; bins.set(hb, b);
}
for (const [hb, b] of [...bins.entries()].sort((a, c) => a[0] - c[0])) {
  const tot = Object.values(b).reduce((s, e) => s + e.ms, 0);
  const rtot = Object.values(b).reduce((s, e) => s + e.rang, 0);
  const parts = Object.entries(b).sort((a, c) => c[1].ms - a[1].ms).map(([k, e]) => `${k.replace("Operations/","O:").replace("Contracts/","C:").replace("General/","G:")} ${fmt(100*e.ms/tot,0)}% n${e.n} r${fmt(e.rang,0)}`);
  console.log(`h${fmt(hb,1)} (erfasst ${fmt(tot/3.6e6/bin*100,0)}% , Rang ${fmt(rtot,0)}): ` + parts.join(" | "));
}
