// Liest Hacknet-/Hash-Kennwerte aus Spielstaenden (backups/*.json.gz). Nur lesen.
// Aufruf: node tools/audit/hash-save.mjs [muster ...]
// Ohne Muster: alle BN2L1-Staende. Muster ist ein Teilstring des Dateinamens.
// Ausgabe je Stand: Spielzeit seit Einbau/Knoten, Geld, Rang, Hash-Stufen,
// Flotte (Level/Kerne/RAM/Cache/Rate), Hacknet-Mults, Geldquellen.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = path.join(root, "backups");

export function loadSave(file) {
  const raw = fs.readFileSync(file);
  const save = JSON.parse(zlib.gunzipSync(raw).toString("utf8"));
  const player = JSON.parse(save.data.PlayerSave).data;
  const servers = JSON.parse(save.data.AllServersSave);
  return { save, player, servers };
}

export function homeTextFile(servers, name) {
  const home = servers.home && (servers.home.data || servers.home);
  if (!home) return null;
  const tf = home.textFiles;
  const entries = tf && tf.data ? tf.data : Array.isArray(tf) ? tf : [];
  for (const e of entries) {
    if (Array.isArray(e)) {
      const [k, v] = e;
      if (k === name) return (v.data || v).text;
    }
  }
  return null;
}

export function hacknetState(file) {
  const { player: p, servers } = loadSave(file);
  const hm = p.hashManager && (p.hashManager.data || p.hashManager);
  const fleet = (p.hacknetNodes || []).map((h) => {
    const d = servers[h] && (servers[h].data || servers[h]);
    if (!d) return { name: h, missing: true };
    return {
      name: h, level: d.level, cores: d.cores, cache: d.cache, maxRam: d.maxRam,
      ramUsed: d.ramUsed, hashRate: d.hashRate, hashCapacity: d.hashCapacity,
      online: d.onlineTimeSeconds, total: d.totalHashesGenerated,
    };
  });
  const bb = p.bladeburner && (p.bladeburner.data || p.bladeburner);
  const mults = Object.fromEntries(Object.entries(p.mults || {}).filter(([k]) => /hacknet/.test(k)));
  const ms = p.moneySourceA && (p.moneySourceA.data || p.moneySourceA);
  const msB = p.moneySourceB && (p.moneySourceB.data || p.moneySourceB);
  let hashesJson = null;
  try { hashesJson = JSON.parse(homeTextFile(servers, "data/hashes.json") || "null"); } catch { hashesJson = null; }
  return {
    file: path.basename(file),
    bitNodeN: p.bitNodeN,
    hSinceAug: p.playtimeSinceLastAug / 3.6e6,
    hSinceNode: p.playtimeSinceLastBitnode / 3.6e6,
    money: p.money,
    rank: bb ? bb.rank : null, maxRank: bb ? bb.maxRank : null,
    sp: bb ? bb.skillPoints : null, totalSP: bb ? bb.totalSkillPoints : null,
    hashes: hm ? hm.hashes : null, capacity: hm ? hm.capacity : null,
    upgrades: hm ? Object.fromEntries(Object.entries(hm.upgrades).filter(([, v]) => v > 0)) : null,
    fleet, mults,
    moneySince: ms ? { hacknet: ms.hacknet, hacknet_expenses: ms.hacknet_expenses, hacking: ms.hacking,
      crime: ms.crime, bladeburner: ms.bladeburner, codingcontract: ms.codingcontract, total: ms.total,
      augmentations: ms.augmentations, sleeves: ms.sleeves, work: ms.work, class: ms.class,
      servers: ms.servers, other: ms.other } : null,
    moneyNode: msB ? { hacknet: msB.hacknet, hacknet_expenses: msB.hacknet_expenses, hacking: msB.hacking,
      crime: msB.crime, bladeburner: msB.bladeburner, total: msB.total, augmentations: msB.augmentations } : null,
    hashesJson,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const pats = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const full = process.argv.includes("--full");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json.gz"))
    .filter((f) => (pats.length ? pats.some((m) => f.includes(m)) : f.includes("BN2L1"))).sort();
  for (const f of files) {
    const s = hacknetState(path.join(dir, f));
    const rate = s.fleet.reduce((a, x) => a + (x.hashRate || 0), 0);
    if (full) { console.log(JSON.stringify(s, null, 1)); continue; }
    console.log([
      s.file.replace("LIVE_197f4d61481686_", ""),
      "hAug=" + s.hSinceAug.toFixed(2), "hNode=" + s.hSinceNode.toFixed(2),
      "money=" + (s.money / 1e9).toFixed(2) + "e9",
      "rank=" + (s.rank == null ? "-" : s.rank.toFixed(0)),
      "nSrv=" + s.fleet.length, "rate=" + rate.toFixed(4), "cap=" + s.capacity,
      "upg=" + JSON.stringify(s.upgrades),
      "hnMoney=" + (s.mults.hacknet_node_money || 0).toFixed(4),
    ].join(" "));
  }
}
