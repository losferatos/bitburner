// G09-Betrieb: Aktionsprotokoll (data/aktionen.txt) eines Spielstands nach Wanduhr-Stunden gebucht.
// Aufruf: node tools/audit/verify-g09-betrieb-aktionen.mjs <backupmuster> [stundenBreite=1]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ladeSpielstand, homeDatei } from "./blade-lage.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const pat = process.argv[2];
const breite = Number(process.argv[3] || 1);
const f = fs.readdirSync(path.join(root, "backups")).filter((x) => x.includes(pat))[0];
const { servers } = ladeSpielstand(path.join(root, "backups", f));
const bj = JSON.parse(homeDatei(servers, "data/blade.json") || "null");
const ak = (homeDatei(servers, "data/aktionen.txt") || "").split("\n").filter((z) => z.trim()).map((z) => { try { return JSON.parse(z); } catch { return null; } }).filter(Boolean);
const seit = bj && bj.nodeReset ? bj.nodeReset : 0;
const z = ak.filter((a) => a.von >= seit);
console.log(f, "nodeReset", new Date(seit).toISOString(), "Abschnitte", z.length);
const t0 = z.length ? z[0].von : 0;
const buckets = new Map();
for (const a of z) {
  const b = Math.floor((a.von - seit) / (breite * 3.6e6));
  const e = buckets.get(b) || { ms: 0, rang: 0, je: new Map() };
  const ms = a.bis - a.von;
  const rang = (Number.isFinite(a.rangBis) && Number.isFinite(a.rangVon)) ? a.rangBis - a.rangVon : 0;
  e.ms += ms; e.rang += rang;
  const j = e.je.get(a.aktion) || { ms: 0, rang: 0, n: 0 };
  j.ms += ms; j.rang += rang; j.n++;
  e.je.set(a.aktion, j);
  buckets.set(b, e);
}
for (const [b, e] of [...buckets.entries()].sort((x, y) => x[0] - y[0])) {
  const top = [...e.je.entries()].sort((x, y) => y[1].ms - x[1].ms).slice(0, 6)
    .map(([n, j]) => `${n.replace("Operations/", "Op/").replace("Contracts/", "C/").replace("General/", "G/")} ${(j.ms / 60000).toFixed(0)}m n${j.n} r${j.rang.toFixed(0)}`).join(" | ");
  console.log(`Node-Stunde ${b * breite}-${(b + 1) * breite}: protokolliert ${(e.ms / 60000).toFixed(0)} min, Rang ${e.rang.toFixed(0)} || ${top}`);
}
