// G09-Betrieb, Teil D: wie oft ist das D5-Signal (istAktion startet mit "Operations/") im Hungerfenster ueberhaupt an?
// sleeve.js tastet blade.json einmal je Takt (60 s) ab (src/sleeve.js:713-725). Anteil = Zeitanteil der Operation im Protokoll.
// Dazu: Anteil Spieler-Diplomacy je Fenster (Befund SLEEVE-3 am echten Verlauf).
// Aufruf: node tools/audit/verify-g09-betrieb-signal.mjs <backupmuster>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ladeSpielstand, homeDatei } from "./blade-lage.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const pat = process.argv[2] || "BN2L1_2026-10-04T10-38_pre-jump";
const f0 = fs.readdirSync(path.join(root, "backups")).filter((x) => x.includes(pat))[0];
const { servers } = ladeSpielstand(path.join(root, "backups", f0));
const bj = JSON.parse(homeDatei(servers, "data/blade.json") || "null");
const seit = bj.nodeReset;
const ak = (homeDatei(servers, "data/aktionen.txt") || "").split("\n").filter((z) => z.trim()).map((z) => { try { return JSON.parse(z); } catch { return null; } }).filter(Boolean);
const fenster = (name, h0, h1) => {
  let ms = 0, op = 0, dip = 0, raid = 0, kammer = 0, rang = 0;
  for (const a of ak) {
    const h = (a.von - seit) / 3.6e6;
    if (h < h0 || h >= h1) continue;
    const d = a.bis - a.von;
    ms += d;
    if (a.aktion.startsWith("Operations/")) op += d;
    if (a.aktion === "Operations/Raid") raid += d;
    if (a.aktion === "General/Diplomacy") dip += d;
    if (a.aktion.includes("Regeneration")) kammer += d;
    if (Number.isFinite(a.rangBis) && Number.isFinite(a.rangVon)) rang += a.rangBis - a.rangVon;
  }
  const p = (x) => (ms ? (100 * x / ms).toFixed(0) : "-") + " %";
  console.log(`${name.padEnd(46)} protokolliert ${(ms / 60000).toFixed(0).padStart(4)} min | Operation ${p(op).padStart(5)} (Raid ${p(raid)}) | Spieler-Diplomacy ${p(dip).padStart(5)} | Kammer ${p(kammer).padStart(5)} | Rang ${rang.toFixed(0)}`);
};
fenster("Hunger (Vorrat ~0): Knoten 3,5-4,85 h", 3.5, 4.85);
fenster("Vorrat da: Knoten 2,0-3,5 h", 2.0, 3.5);
fenster("Chaos-Regime Raid: Knoten 14,0-16,2 h", 14.0, 16.2);
fenster("Chaos-Regime: Knoten 14,0-18,2 h", 14.0, 18.2);
fenster("Chaos-Regime ohne Diplomacy: Knoten 18,2-19,2 h", 18.2, 19.2);
fenster("Op-Phase: Knoten 19,2-26 h", 19.2, 26);
fenster("ganzer Knoten", 0, 40);
