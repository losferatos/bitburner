// Gegenpruefung G01 (Substanz): eigener Spielstand-Leser.
// Liest einen Spielstand (backups/*.json.gz) und gibt die Kennwerte aus, die
// fuer die Gang-Ertragsrechnung gebraucht werden. Unabhaengig vom Leser des
// Erstpruefers geschrieben (nur gleiche Dekodierregel aus dem BRIEFING).
//
// Aufruf: node tools/audit/verify-g01-save.mjs <Teilstring des Dateinamens>
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function loadSave(file) {
  const raw = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
  const player = JSON.parse(raw.data.PlayerSave).data;
  const factions = JSON.parse(raw.data.FactionsSave);
  let servers = null;
  try { servers = JSON.parse(raw.data.AllServersSave); } catch { servers = null; }
  return { raw, player, factions, servers };
}

// Datei vom home-Server (Bot-Telemetrie) aus dem Spielstand holen
export function homeFile(servers, name) {
  if (!servers) return null;
  const home = servers.home && (servers.home.data || servers.home);
  if (!home) return null;
  const tf = home.textFiles;
  // textFiles ist eine JSONMap {ctor:"JSONMap", data:[[name, {ctor:"TextFile", data:{text}}]]}
  const entries = tf && tf.data ? tf.data : [];
  for (const [n, v] of entries) {
    if (n === name || n === "/" + name) return (v.data || v).text;
  }
  return null;
}

export function findBackup(part) {
  const dir = path.join(ROOT, "backups");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json.gz") && f.includes(part)).sort();
  if (!files.length) throw new Error("kein Spielstand mit " + part);
  return path.join(dir, files[files.length - 1]);
}

function main() {
  const part = process.argv[2] || "BN2L1_2026-10-03T21-17";
  const file = findBackup(part);
  const { player: p, factions, servers } = loadSave(file);
  const bb = p.bladeburner && (p.bladeburner.data || p.bladeburner);
  const out = {
    file: path.basename(file),
    bitNodeN: p.bitNodeN,
    hNode: p.playtimeSinceLastBitnode / 3.6e6,
    hSinceAug: p.playtimeSinceLastAug / 3.6e6,
    money: p.money,
    karma: p.karma,
    skills: p.skills,
    exp: p.exp,
    mults: p.mults,
    gang: p.gang ? "JA" : null,
    augsInstalled: (p.augmentations || []).map((a) => a.name + (a.level > 1 ? " x" + a.level : "")),
    augsQueued: (p.queuedAugmentations || []).map((a) => a.name),
    rank: bb && bb.rank,
    maxRank: bb && bb.maxRank,
    city: bb && bb.city,
    stamina: bb && [bb.stamina, bb.maxStamina, bb.staminaBonus],
    storedCycles: bb && bb.storedCycles,
    bbSkills: bb && bb.skills,
    blackOpsDone: bb && bb.numBlackOpsComplete,
    rep: Object.fromEntries(Object.entries(factions).map(([k, v]) => [k, Math.round((v.data || v).playerReputation)]).filter(([, r]) => r > 0)),
    favor: Object.fromEntries(Object.entries(factions).map(([k, v]) => [k, +((v.data || v).favor || 0).toFixed(2)]).filter(([, r]) => r > 0)),
    slumSnakes: factions["Slum Snakes"] && (factions["Slum Snakes"].data || factions["Slum Snakes"]),
  };
  console.log(JSON.stringify(out, null, 1));
  const bj = homeFile(servers, "data/blade.json");
  if (bj) console.log("blade.json:", bj.slice(0, 3000));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
