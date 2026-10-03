// Audit 03.10.2026, Bereich PLAYER: Was bringen +10 Mrd je Einbauzyklus (Casino) im V2?
//
// Nutzt das Zyklusmodell des FAKT-Pruefers (tools/audit/fakt-v2.mjs, simulateBudget:
// gierige Augwahl nach Wert je Dollar, Kaufkette x1,9, Bladeburners-Rep 13.000,
// Vertragsruf 4.932 rep/h) und die dort gemessene Elastizitaet Rang/Kampfmass ~1,0
// (fakt-rang.mjs: Kampfwerte x1,40 -> Rang x1,41 in 10 h). Die Budgets 35 Mrd (BN2.1,
// GESCHAETZT im FAKT-Bericht 4.5) werden um 10 bzw. 20 Mrd erhoeht.
// GERECHNET_UNGEEICHT (Modell des FAKT-Bereichs; nicht gegen einen Casinolauf geeicht).
//
// Aufruf: node tools/audit/player-casino-wert.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const log = console.log;
console.log = () => {};                       // Ausgabe von fakt-v2.mjs beim Import unterdruecken
const { simulateBudget } = await import("./fakt-v2.mjs");
console.log = log;

const file = "LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz";
const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, "backups", file))).toString());
const p = JSON.parse(save.data.PlayerSave).data;
const owned = new Set([...(p.augmentations || []).map((a) => a.name), ...(p.queuedAugmentations || []).map((a) => a.name)]);
const R = 4932;
const scen = {
  "Ist BN2.1 (7 Hacking-Faktionen)": ["The Black Hand", "NiteSec", "Aevum", "Sector-12", "Netburners", "Tian Di Hui", "CyberSec", "Slum Snakes"],
  "S12, NiteSec, TDH (FAKT-1)": ["Sector-12", "NiteSec", "Tian Di Hui"],
  "S12, NiteSec, TDH, Syndicate": ["Sector-12", "NiteSec", "Tian Di Hui", "The Syndicate"],
};
console.log("Stand", file, "| besessen", owned.size, "| Zyklus 12 h, R", R, "rep/h, Bladeburners-Rep 13.000");
console.log("Szenario".padEnd(32), "Budget", "Stuecke", "ln Kampf", "x", " Delta ln gegen 35 Mrd (= Rang/h-Aenderung bei Elastizitaet 1)");
for (const [name, mem] of Object.entries(scen)) {
  const base = simulateBudget(mem, 12, R, owned, 35e9, 13000);
  for (const b of [1e9, 2e9, 3e9, 5e9, 8e9, 10e9, 15e9, 25e9, 35e9]) {
    const s = simulateBudget(mem, 12, R, owned, b, 13000);
    console.log(name.padEnd(32), (b / 1e9).toFixed(0).padStart(4) + " Mrd", String(s.count).padStart(5), s.v.toFixed(3).padStart(8), Math.exp(s.v).toFixed(2).padStart(5),
      ((s.v - base.v) >= 0 ? "+" : "") + (s.v - base.v).toFixed(3), "(" + ((Math.exp(s.v - base.v) - 1) * 100).toFixed(1) + " %)", s.names.length ? "" : "");
  }
}
