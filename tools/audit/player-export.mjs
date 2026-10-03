// Audit 03.10.2026, Bereich PLAYER: Export-Bonus - wie oft abgeholt, was ist er wert?
//
// Spiel 3.0.2 (nur gelesen):
//   ExportBonus.tsx:6-21        canGetBonus: Wanduhr-Abstand > 24 h; giveExportBonus: +1 Favor
//                               fuer JEDE Mitgliedsfaktion (Player.factions)
//   SaveObject.ts:239-251       exportGame() ruft giveExportBonus() zuerst; ns.singularity.exportGame
//                               (Singularity.ts:1193-1196) geht diesen Weg; hasExportGameBonus :1201-1204
//   Bladeburner/Formulas.ts:46-49  Bladeburners-Ruf = 2 x Rang x faction_rep x (1 + Favor/100)
//   FactionHelpers.tsx:132-170  Passivruf: rate x min(0,1; Favor/1000 + 0,01) x FactionPassiveRepGain
//   reputation.ts:8-14          Arbeitsruf x (1 + Favor/100) x FactionWorkRepGain
//   Faction.ts:70,79            Favor bleibt ueber Einbauten (Rep -> Favor), faellt beim Knotenwechsel auf 0
//
// Bot: src/export.js:42-46,180-200 exportiert NUR, wenn die Bruecke > 90 min ohne gruene
// Sicherung ist (Bonus = Nebeneffekt); src/exportbonus.js nur auf Auftrag (tools/task.js).
//
// EICHUNG: Favor aller Mitgliedsfaktionen im Stand 17:16 (BN2.1, Knotenbeginn 05:42) = 1,
// genau ein Bonus seit Knotenbeginn (lastExportBonus 15:16:43Z) - der Mechanismus "+1 je
// Mitgliedsfaktion" ist damit am Spielstand bestaetigt.
//
// Aufruf: node tools/audit/player-export.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSave, latestFile } from "./player-save.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = path.join(root, "backups");

const isMain = process.argv[1] && process.argv[1].endsWith("player-export.mjs");
if (isMain) {
  const idx = fs.readFileSync(path.join(dir, "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((l) => l.split("\t"));
  const bonus = new Set();
  let first = null, last = null;
  const seenHour = new Set();
  for (const c of idx) {
    const f = path.join(dir, c[1]);
    if (!fs.existsSync(f)) continue;
    const hk = c[0].slice(0, 13);
    if (seenHour.has(hk)) continue;
    seenHour.add(hk);
    try {
      const { save } = loadSave(f);
      const leb = Number(JSON.parse(save.data.LastExportBonus || "0"));
      if (leb > 0) bonus.add(leb);
      const t = Date.parse(c[0]);
      if (!first || t < first) first = t;
      if (!last || t > last) last = t;
    } catch { /* defekt */ }
  }
  const list = [...bonus].sort((a, b) => a - b);
  const span = (list[list.length - 1] - list[0]) / 86400000;
  const gaps = list.slice(1).map((t, i) => (t - list[i]) / 3600000);
  console.log("## Export-Bonus aus den Spielstaenden");
  console.log("Abholungen (verschiedene LastExportBonus):", list.length, "zwischen", new Date(list[0]).toISOString().slice(0, 16), "und", new Date(list[list.length - 1]).toISOString().slice(0, 16));
  console.log("Zeitraum", span.toFixed(1), "Tage -> moeglich bei taeglicher Abholung:", Math.floor(span) + 1, " Quote", (100 * list.length / (Math.floor(span) + 1)).toFixed(0), "%");
  console.log("Abstaende (h):", gaps.map((g) => g.toFixed(0)).join(", "));
  console.log("verschenkte Tage (Abstand - 24 h, aufsummiert):", (gaps.reduce((s, g) => s + Math.max(0, g - 24), 0) / 24).toFixed(1));

  // Eichung: Favor im aktuellen Stand
  const { save, player } = loadSave(latestFile());
  const FS = JSON.parse(save.data.FactionsSave);
  const fav = player.factions.map((n) => [n, (FS[n].data || FS[n]).favor]);
  console.log("\n## Eichung (", path.basename(latestFile()), ")");
  console.log("lastNodeReset", new Date(player.lastNodeReset).toISOString(), " LastExportBonus", new Date(Number(JSON.parse(save.data.LastExportBonus))).toISOString());
  console.log("Favor je Mitgliedsfaktion:", fav.map(([n, f]) => n + "=" + f).join(", "));

  // Wert eines Bonus
  console.log("\n## Wert von +1 Favor (je Bonus, alle Mitgliedsfaktionen)");
  for (const F of [0, 1, 5, 20, 50]) {
    const work = (1 + (F + 1) / 100) / (1 + F / 100) - 1;
    const passive = Math.min(0.1, (F + 1) / 1000 + 0.01) / Math.min(0.1, F / 1000 + 0.01) - 1;
    console.log("Favor", String(F).padStart(3), "-> Arbeitsruf und Bladeburners-Ruf +", (100 * work).toFixed(2), "%   Passivruf +", (100 * passive).toFixed(1), "%");
  }
}
