// P2b: Live-Schnappschuss der Gang aus dem Spielstand (NUR LESEN).
// Holt getSaveFile ueber die Bruecke (Port 8795, Instanz LIVE) oder liest ein Backup
// (backups/*.json.gz) und gibt ein kompaktes Gang-Objekt aus: Mitglieder mit allen
// Rohwerten (exp, mult, asc_points, Stufen, Aufgabe, earnedRespect), Gang-Summen,
// AllGangs (Macht/Territorium der NPC-Gangs), Spieler-Mults, Slum-Snakes-Favor.
//
// Aufruf: node tools/audit/gang-p2b-live.mjs [--file <backup.json.gz>] [--out <datei.json>] [--quiet]
import fs from "node:fs";
import zlib from "node:zlib";

export async function loadLive() {
  const url = "http://localhost:8795/api/rpc?" + new URLSearchParams({ method: "getSaveFile", instance: "LIVE" });
  const body = await (await fetch(url, { signal: AbortSignal.timeout(30000) })).json();
  if (body.error) throw new Error(body.error);
  const raw = Buffer.from(body.result.save, "latin1");
  return JSON.parse(zlib.gunzipSync(raw).toString("utf8"));
}

export function loadBackup(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const unwrap = (x) => (x && x.data !== undefined && x.ctor ? x.data : x);

export function snapshot(save) {
  const p = JSON.parse(save.data.PlayerSave).data;
  const gang = unwrap(p.gang);
  const factions = JSON.parse(save.data.FactionsSave);
  const slum = unwrap(factions["Slum Snakes"]);
  let all = null;
  try { all = JSON.parse(save.data.AllGangsSave); } catch { all = null; }
  const members = (gang ? gang.members : []).map((mm) => {
    const m = unwrap(mm);
    return {
      name: m.name, task: m.task, earnedRespect: m.earnedRespect,
      lvl: { hack: m.hack, str: m.str, def: m.def, dex: m.dex, agi: m.agi, cha: m.cha },
      exp: { hack: m.hack_exp, str: m.str_exp, def: m.def_exp, dex: m.dex_exp, agi: m.agi_exp, cha: m.cha_exp },
      mult: { hack: m.hack_mult, str: m.str_mult, def: m.def_mult, dex: m.dex_mult, agi: m.agi_mult, cha: m.cha_mult },
      ascPoints: { hack: m.hack_asc_points, str: m.str_asc_points, def: m.def_asc_points, dex: m.dex_asc_points, agi: m.agi_asc_points, cha: m.cha_asc_points },
      upgrades: m.upgrades, augmentations: m.augmentations,
    };
  });
  return {
    playtimeSinceLastBitnode: p.playtimeSinceLastBitnode,
    playtimeSinceLastAug: p.playtimeSinceLastAug,
    totalPlaytime: save.data.totalPlaytime !== undefined ? save.data.totalPlaytime : p.totalPlaytime,
    bitNodeN: p.bitNodeN,
    money: p.money,
    factionRepMult: p.mults.faction_rep,
    mults: p.mults,
    slumSnakes: slum ? { playerReputation: slum.playerReputation, favor: slum.favor } : null,
    gang: gang ? {
      facName: gang.facName, isHackingGang: gang.isHackingGang,
      respect: gang.respect, wanted: gang.wanted,
      respectGainRate: gang.respectGainRate, wantedGainRate: gang.wantedGainRate, moneyGainRate: gang.moneyGainRate,
      storedCycles: gang.storedCycles, storedTerritoryAndPowerCycles: gang.storedTerritoryAndPowerCycles,
      territoryClashChance: gang.territoryClashChance, territoryWarfareEngaged: gang.territoryWarfareEngaged,
    } : null,
    members,
    allGangs: all,
    augCount: (p.augmentations || []).length,
    queued: (p.queuedAugmentations || []).length,
    skills: p.skills,
    augNames: (p.augmentations || []).map((a) => a.name),
    queuedNames: (p.queuedAugmentations || []).map((a) => a.name),
    bbSkills: (() => { const bb = p.bladeburner && (p.bladeburner.data || p.bladeburner); if (!bb) return null; const o = {}; for (const [k, v] of Object.entries(bb.skills || {})) o[k] = v; return o; })(),
    sf: (p.sourceFiles && p.sourceFiles.data) || null,
    keys: Object.keys(save.data),
  };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/audit/gang-p2b-live.mjs");
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const f = arg("--file", null);
  const save = f ? loadBackup(f) : await loadLive();
  const snap = snapshot(save);
  snap.wall = Date.now();
  const out = arg("--out", null);
  if (out) fs.writeFileSync(out, JSON.stringify(snap));
  if (!process.argv.includes("--quiet")) console.log(JSON.stringify(snap, null, 1).slice(0, 12000));
}
