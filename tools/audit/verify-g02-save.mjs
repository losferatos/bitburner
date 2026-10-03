// Gegenpruefung G02 (Audit 03.10.2026): Hacknet-Augs im Kampfknoten.
// Liest alle BN2L1-Spielstaende ab 09:59 (auch die NACH dem Einbau um 19:01,
// die die Befundberichte noch nicht hatten) und zeigt je Stand:
//   Warteschlange in Kaufreihenfolge, Geld, moneySourceA/B.augmentations,
//   NFG-Stufe, Hacknet-Server (Anzahl, Level, Rate), hashManager,
//   mults.hacknet_node_money, Netburners-Ruf, Rang.
// Nur lesen. Aufruf: node tools/audit/verify-g02-save.mjs [--json]
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BACKUPS = path.join(ROOT, "backups");
const flat = (x) => (x && typeof x === "object" && "ctor" in x && "data" in x ? x.data : x);

export function loadBN2(file) {
  const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(BACKUPS, file))).toString("utf8"));
  const p = JSON.parse(save.data.PlayerSave).data;
  const servers = JSON.parse(save.data.AllServersSave);
  const facs = JSON.parse(save.data.FactionsSave);
  return { save, p, servers, facs };
}

export function listBN2Files(fromIso = "2026-10-03T09-59") {
  return fs.readdirSync(BACKUPS)
    .filter((f) => f.startsWith("LIVE_197f4d61481686_BN2L1_") && f.endsWith(".json.gz"))
    .filter((f) => f.slice(26, 42) >= fromIso)
    .sort((a, b) => a.slice(26, 42).localeCompare(b.slice(26, 42)));
}

export function snapshot(file) {
  const { p, servers, facs } = loadBN2(file);
  const msA = flat(p.moneySourceA) || {};
  const msB = flat(p.moneySourceB) || {};
  const hm = flat(p.hashManager) || {};
  const hn = (p.hacknetNodes || []).map((h) => {
    if (typeof h === "string") {
      const s = flat(servers[h]) || {};
      return { host: h, level: s.level, cores: s.cores, ram: s.maxRam, cache: s.cache, rate: s.hashRate,
        totalHashes: s.totalHashesGenerated };
    }
    const d = flat(h);
    return { host: d.name, level: d.level, cores: d.cores, ram: d.ram, rate: d.moneyGainRatePerSecond };
  });
  const nfgInst = (p.augmentations.find((a) => a.name === "NeuroFlux Governor") || {}).level || 0;
  const q = p.queuedAugmentations.map((a) => a.name);
  const rep = (n) => { const f = flat(facs[n]); return f ? f.playerReputation : null; };
  const bb = flat(p.bladeburner) || {};
  return {
    file, stamp: file.slice(26, 42), anlass: file.slice(43).replace(".json.gz", ""),
    sinceAug_h: p.playtimeSinceLastAug / 3.6e6, sinceNode_h: p.playtimeSinceLastBitnode / 3.6e6,
    money: p.money, augA: -(msA.augmentations || 0), augB: -(msB.augmentations || 0),
    hacknetA: msA.hacknet || 0, hacknetB: msB.hacknet || 0, hacknetExpA: -(msA.hacknet_expenses || 0),
    hacknetExpB: -(msB.hacknet_expenses || 0),
    installed: p.augmentations.map((a) => a.name + (a.level > 1 ? "x" + a.level : "")),
    nfgInst, q, hn, hashes: hm.hashes, capacity: hm.capacity,
    upgrades: hm.upgrades ? flat(hm.upgrades) : null,
    hnMult: p.mults.hacknet_node_money, factions: p.factions,
    netburners: rep("Netburners"), rank: bb.rank, maxRank: bb.maxRank,
  };
}

if (process.argv[1] && process.argv[1].endsWith("verify-g02-save.mjs")) {
  const asJson = process.argv.includes("--json");
  const out = listBN2Files().map(snapshot);
  if (asJson) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
  for (const s of out) {
    console.log(`\n## ${s.stamp} ${s.anlass}  seitEinbau ${s.sinceAug_h.toFixed(2)} h  Knoten ${s.sinceNode_h.toFixed(2)} h  Rang ${s.rank?.toFixed(0)}`);
    console.log(`  Geld ${(s.money / 1e9).toFixed(3)} Mrd  augA ${(s.augA / 1e9).toFixed(4)}  augB ${(s.augB / 1e9).toFixed(4)} Mrd`
      + `  hacknetA ${(s.hacknetA / 1e9).toFixed(4)}  hacknetB ${(s.hacknetB / 1e9).toFixed(4)}  hnExpB ${(s.hacknetExpB / 1e6).toFixed(1)} Mio`);
    console.log(`  NFG eingebaut ${s.nfgInst}  eingebaut ${s.installed.length}: ${s.installed.join(", ")}`);
    console.log(`  Warteschlange ${s.q.length}: ${s.q.join(" | ")}`);
    console.log(`  Hacknet ${s.hn.length}: ${s.hn.map((h) => `${h.host} L${h.level} C${h.cores} R${h.ram} c${h.cache} ${h.rate?.toFixed(4)}H/s`).join("; ")}`);
    console.log(`  Hashes ${s.hashes?.toFixed(1)}/${s.capacity}  hnMult ${s.hnMult?.toFixed(4)}  Netburners ${s.netburners?.toFixed(0)}  member ${s.factions.includes("Netburners")}`);
    if (s.upgrades) console.log(`  Stufen ${JSON.stringify(s.upgrades)}`);
  }
}
