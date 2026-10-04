// Gegenpruefung G11 (BLADE-2): Wie sieht der vorgeschlagene Tracer-Messwert "Anteil der Vertraege am Rang aus
// data/aktionen.txt" je Stunde aus? Zeitanteil und Ranganteil der Contracts/* im Spieler-Protokoll, daneben der
// Ranganteil aus den Erfolgszaehlern der Staende (Spieler + Sleeves, verify-g11-ranganteil.mjs).
import path from "node:path";
import { ladeSpielstand, homeDatei } from "./blade-lage.mjs";
import { root } from "./verify-g11-lib.mjs";
const datei = process.argv[2] || "LIVE_197f4d61481686_BN2L1_2026-10-04T10-38_pre-jump.json.gz";
const { servers } = ladeSpielstand(path.join(root, "backups", datei));
const bj = JSON.parse(homeDatei(servers, "data/blade.json") || "null");
const ak = (homeDatei(servers, "data/aktionen.txt") || "").split("\n").filter((z) => z.trim()).map((z) => { try { return JSON.parse(z); } catch { return null; } }).filter(Boolean).filter((z) => z.von >= (bj?.nodeReset || 0));
const t0 = ak[0].von;
const je = new Map();
for (const z of ak) {
  const b = Math.floor((z.von - t0) / 3.6e6);
  const e = je.get(b) || { ms: 0, msC: 0, r: 0, rC: 0 };
  const ms = z.bis - z.von, r = Math.max(0, (z.rangBis ?? 0) - (z.rangVon ?? 0));
  e.ms += ms; e.r += r;
  if (z.aktion.startsWith("Contracts/")) { e.msC += ms; e.rC += r; }
  je.set(b, e);
}
console.log("Stunde (lokal = UTC+2) | Zeitanteil Vertraege | Ranganteil Vertraege (nur Spielerabschnitte) | Rang gesamt");
for (const [b, e] of [...je.entries()].sort((a, c) => a[0] - c[0])) {
  console.log(new Date(t0 + b * 3.6e6 + 2 * 3.6e6).toISOString().slice(5, 13) + "h", (100 * e.msC / e.ms).toFixed(0).padStart(3) + " %", (e.r > 0 ? (100 * e.rC / e.r).toFixed(0) : "-").padStart(4) + " %", Math.round(e.r));
}
