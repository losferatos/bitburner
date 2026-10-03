// Audit 03.10.2026 (BLADE): Zeit- und Ranganteile je Aktion aus dem
// Aktionsprotokoll data/aktionen.txt eines Spielstands (nur Abschnitte seit
// dem letzten Knotenwechsel, Stempel nodeReset aus data/blade.json).
// Aufruf: node tools/audit/blade-aktionen.mjs [backupdatei] [--alle] [--seit ms]
import path from "node:path";
import fs from "node:fs";
import { ladeSpielstand, homeDatei } from "./blade-lage.mjs";

const args = process.argv.slice(2);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
let datei = args.find((a) => !a.startsWith("--") && !/^\d+$/.test(a));
if (!datei) {
  const idx = fs.readFileSync(path.join(root, "backups", "INDEX.tsv"), "utf8").trim().split(/\r?\n/);
  datei = idx[idx.length - 1].split("\t")[1];
}
if (!path.isAbsolute(datei)) datei = path.join(root, "backups", path.basename(datei));
const { servers } = ladeSpielstand(datei);
const bj = JSON.parse(homeDatei(servers, "data/blade.json") || "null");
const ak = (homeDatei(servers, "data/aktionen.txt") || "").split("\n").filter((z) => z.trim()).map((z) => { try { return JSON.parse(z); } catch { return null; } }).filter(Boolean);
let seit = bj && bj.nodeReset ? bj.nodeReset : 0;
const iSeit = args.indexOf("--seit");
if (iSeit >= 0) seit = Number(args[iSeit + 1]);
if (args.includes("--alle")) seit = 0;
const zeilen = ak.filter((z) => z.von >= seit);
const je = new Map();
let gesamtMs = 0, gesamtRang = 0;
for (const z of zeilen) {
  const ms = z.bis - z.von;
  const rang = (Number.isFinite(z.rangBis) && Number.isFinite(z.rangVon)) ? z.rangBis - z.rangVon : 0;
  const e = je.get(z.aktion) || { ms: 0, rang: 0, n: 0, ausd: 0, ausdN: 0 };
  e.ms += ms; e.rang += rang; e.n++;
  if (Number.isFinite(z.ausdauerVon) && Number.isFinite(z.ausdauerBis)) { e.ausd += z.ausdauerBis - z.ausdauerVon; e.ausdN++; }
  je.set(z.aktion, e);
  gesamtMs += ms; gesamtRang += rang;
}
const erste = zeilen.length ? zeilen[0].von : null, letzte = zeilen.length ? zeilen[zeilen.length - 1].bis : null;
console.log("Datei", path.basename(datei), "Abschnitte", zeilen.length, "von", erste && new Date(erste).toISOString(), "bis", letzte && new Date(letzte).toISOString());
console.log("Wanduhr-Spanne h", erste ? ((letzte - erste) / 3.6e6).toFixed(2) : null, "protokolliert h", (gesamtMs / 3.6e6).toFixed(2), "Rang", gesamtRang.toFixed(1));
const liste = [...je.entries()].sort((a, b) => b[1].ms - a[1].ms);
for (const [name, e] of liste) {
  console.log(name.padEnd(48), (100 * e.ms / gesamtMs).toFixed(1).padStart(5) + " %",
    (e.ms / 60000).toFixed(1).padStart(7) + " min", ("Rang " + e.rang.toFixed(1)).padStart(12),
    ("Rang/min " + (e.rang / (e.ms / 60000)).toFixed(2)).padStart(16), ("n " + e.n).padStart(6),
    e.ausdN ? ("dAusd/Abschn " + (e.ausd / e.ausdN).toFixed(2)) : "");
}
