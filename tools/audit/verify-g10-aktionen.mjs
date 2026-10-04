// Gegenpruefung G10 (BLADE-1): Aktionsprotokoll BN2.1 in Zeitfenstern.
// Je Fenster: Minuten und Rang je Aktion (Wanduhr der Aktion, nicht Spielzeit),
// damit sichtbar wird, WELCHE Aktion in WELCHER Phase den Rang getragen hat.
// Aufruf: node tools/audit/verify-g10-aktionen.mjs [backup] [fensterStunden=2]
import path from "node:path";
import fs from "node:fs";
import { ladeSpielstand, homeDatei } from "./blade-lage.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const datei = process.argv[2] || "LIVE_197f4d61481686_BN2L1_2026-10-04T10-38_pre-jump.json.gz";
const fenster = Number(process.argv[3] || 2) * 3.6e6;
const { servers } = ladeSpielstand(path.join(root, "backups", datei));
const bj = JSON.parse(homeDatei(servers, "data/blade.json") || "null");
const ak = (homeDatei(servers, "data/aktionen.txt") || "").split("\n").filter((z) => z.trim()).map((z) => { try { return JSON.parse(z); } catch { return null; } }).filter(Boolean);
const seit = bj && bj.nodeReset ? bj.nodeReset : 0;
// Lokalzeit = UTC+2 (CEST am 03./04.10.2026)
const lokal = (ms) => new Date(ms + 2 * 3.6e6).toISOString().slice(5, 16).replace("T", " ");
const zeilen = ak.filter((z) => z.von >= seit);
const t0 = zeilen[0].von;
const bucket = new Map();
for (const z of zeilen) {
  const k = Math.floor((z.von - t0) / fenster);
  const b = bucket.get(k) || { min: new Map(), rang: new Map(), lücke: 0 };
  const ms = z.bis - z.von;
  const rang = (Number.isFinite(z.rangBis) && Number.isFinite(z.rangVon)) ? z.rangBis - z.rangVon : 0;
  const a = z.aktion.replace("Operations/", "").replace("Contracts/", "C:").replace("General/Hyperbolic Regeneration Chamber", "Kammer").replace("General/", "").replace("Black Operations/Operation ", "BO ");
  b.min.set(a, (b.min.get(a) || 0) + ms / 60000);
  b.rang.set(a, (b.rang.get(a) || 0) + rang);
  bucket.set(k, b);
}
for (const [k, b] of [...bucket.entries()].sort((x, y) => x[0] - y[0])) {
  const von = t0 + k * fenster;
  const summe = [...b.min.values()].reduce((x, y) => x + y, 0);
  const rs = [...b.rang.values()].reduce((x, y) => x + y, 0);
  const teile = [...b.min.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([n, m]) => n + " " + m.toFixed(0) + "min/" + (b.rang.get(n)).toFixed(0) + "R");
  console.log(lokal(von), "bis", lokal(von + fenster), "| prot.", summe.toFixed(0), "min, Rang", rs.toFixed(0), "|", teile.join(" | "));
}
