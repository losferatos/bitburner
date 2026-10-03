// Audit 03.10.2026 (Bereich INFRA): liest einen Spielstand aus backups/ und
// gibt die Infrastruktur-Kennwerte aus: home RAM/Kerne, Cloud-Server,
// Programme, TOR, Geldquellen (moneySourceA = seit Einbau, B = seit Knoten).
// Aufruf: node tools/audit/infra-save.mjs <datei.json.gz> [--json]
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";

export function readSave(file) {
  const raw = fs.readFileSync(file);
  const text = zlib.gunzipSync(raw).toString("utf8");
  const save = JSON.parse(text);
  const player = JSON.parse(save.data.PlayerSave).data;
  const servers = JSON.parse(save.data.AllServersSave);
  return { save, player, servers };
}

function unwrap(o) {
  return o && o.data ? o.data : o;
}

export function infraFacts(file) {
  const { player: p, servers } = readSave(file);
  const sf = {};
  for (const [n, lvl] of (p.sourceFiles && p.sourceFiles.data) || []) sf[n] = lvl;
  const home = unwrap(servers.home);
  const purchased = (p.purchasedServers || []).map((h) => {
    const s = unwrap(servers[h]);
    return { host: h, maxRam: s ? s.maxRam : null, cores: s ? s.cpuCores : null };
  });
  const hacknet = (p.hacknetNodes || []).map((h) => {
    const s = unwrap(servers[h]);
    return s ? { host: h, maxRam: s.maxRam, cores: s.cores, level: s.level, cache: s.cache } : h;
  });
  // Netz-RAM aller gerooteten Fremdserver (ohne home, Cloud, Hacknet)
  let foreignRam = 0;
  let foreignRooted = 0;
  for (const [name, so] of Object.entries(servers)) {
    const s = unwrap(so);
    if (!s || name === "home" || s.purchasedByPlayer) continue;
    if (name.startsWith("hacknet-")) continue;
    if (s.hasAdminRights && s.maxRam > 0) { foreignRam += s.maxRam; foreignRooted++; }
  }
  const msA = unwrap(p.moneySourceA) || {};
  const msB = unwrap(p.moneySourceB) || {};
  return {
    file: path.basename(file),
    bitNodeN: p.bitNodeN,
    sourceFiles: sf,
    totalPlaytimeH: p.totalPlaytime / 3.6e6,
    sinceBitnodeH: p.playtimeSinceLastBitnode / 3.6e6,
    sinceAugH: p.playtimeSinceLastAug / 3.6e6,
    money: p.money,
    hacking: p.skills && p.skills.hacking,
    intelligence: p.skills && p.skills.intelligence,
    intExp: p.exp && p.exp.intelligence,
    hackingExp: p.exp && p.exp.hacking,
    hackingMult: p.mults && p.mults.hacking,
    augsInstalled: (p.augmentations || []).length,
    augsQueued: (p.queuedAugmentations || []).length,
    homeRam: home.maxRam,
    homeCores: home.cpuCores,
    homePrograms: home.programs,
    tor: (home.serversOnNetwork || []).includes("darkweb"),
    purchased,
    purchasedRamTotal: purchased.reduce((a, b) => a + (b.maxRam || 0), 0),
    hacknet,
    foreignRam,
    foreignRooted,
    moneySourceA: msA,
    moneySourceB: msB,
  };
}

if (process.argv[1] && process.argv[1].endsWith("infra-save.mjs")) {
  const file = process.argv[2];
  const f = infraFacts(file);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(f, null, 1));
  } else {
    const { hacknet, purchased, homePrograms, moneySourceA, moneySourceB, ...rest } = f;
    console.log(rest);
    console.log("purchased:", purchased.map((s) => s.host + ":" + s.maxRam).join(" "));
    console.log("hacknet:", JSON.stringify(hacknet));
    console.log("programs:", homePrograms.join(", "));
    const pick = (m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== 0));
    console.log("moneySourceA (seit Einbau):", pick(moneySourceA));
    console.log("moneySourceB (seit Knoten):", pick(moneySourceB));
  }
}
