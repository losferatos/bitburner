// Audit 03.10.2026, Bereich AUG: Spielstand dekodieren (nur lesen).
// Aufruf: node tools/audit/aug-save.mjs <backup.json.gz> [--files] [--file <pfad auf home>]
// Gibt Spieler-Mults, Augs, Warteschlange, Entropie, Faktionsruf/-favor,
// Bladeburner-Rang und (optional) Dateien auf home aus.
import fs from "node:fs";
import zlib from "node:zlib";

export function loadSave(path) {
  const raw = fs.readFileSync(path);
  const text = zlib.gunzipSync(raw).toString("utf8");
  const save = JSON.parse(text);
  const p = JSON.parse(save.data.PlayerSave).data;
  let factions = null;
  try {
    factions = JSON.parse(save.data.FactionsSave);
  } catch (e) {
    factions = null;
  }
  let servers = null;
  try {
    servers = JSON.parse(save.data.AllServersSave);
  } catch (e) {
    servers = null;
  }
  return { save, p, factions, servers };
}

export function homeFiles(servers) {
  if (!servers) return {};
  const home = servers.home ? servers.home.data || servers.home : null;
  if (!home) return {};
  const out = {};
  const scripts = home.scripts && (home.scripts.data || home.scripts);
  const texts = home.textFiles && (home.textFiles.data || home.textFiles);
  const add = (coll) => {
    if (!coll) return;
    const entries = Array.isArray(coll) ? coll : Object.entries(coll);
    for (const e of entries) {
      if (Array.isArray(e)) {
        const [k, v] = e;
        const d = v && v.data ? v.data : v;
        out[k] = d && (d.code !== undefined ? d.code : d.text);
      } else if (e && e.data) {
        out[e.data.filename] = e.data.code !== undefined ? e.data.code : e.data.text;
      }
    }
  };
  add(scripts);
  add(texts);
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const path = args[0];
  const { p, factions, servers } = loadSave(path);
  const sf = {};
  for (const [n, l] of (p.sourceFiles && p.sourceFiles.data) || []) sf[n] = l;
  const bb = p.bladeburner && (p.bladeburner.data || p.bladeburner);
  const res = {
    bitNodeN: p.bitNodeN,
    sf,
    money: p.money,
    playtimeSinceLastAug_h: p.playtimeSinceLastAug / 3.6e6,
    playtimeSinceLastBitnode_h: p.playtimeSinceLastBitnode / 3.6e6,
    entropy: p.entropy,
    karma: p.karma,
    skills: p.skills,
    exp: p.exp,
    mults: p.mults,
    augmentations: (p.augmentations || []).map((a) => (a.level > 1 ? `${a.name}@${a.level}` : a.name)),
    queued: (p.queuedAugmentations || []).map((a) => (a.level > 1 ? `${a.name}@${a.level}` : a.name)),
    city: p.city,
    focus: p.focus,
    currentWork: p.currentWork ? { ctor: p.currentWork.ctor, ...(p.currentWork.data || {}) } : null,
    factionsJoined: p.factions,
    bladeburner: bb
      ? {
          rank: bb.rank,
          maxRank: bb.maxRank,
          skillPoints: bb.skillPoints,
          numBlackOpsComplete: bb.numBlackOpsComplete,
          stamina: bb.stamina,
          maxStamina: bb.maxStamina,
        }
      : null,
  };
  if (factions) {
    res.factionRep = {};
    for (const [name, f] of Object.entries(factions)) {
      const d = f.data || f;
      if (d.playerReputation > 0 || d.favor > 0 || d.isMember)
        res.factionRep[name] = { rep: d.playerReputation, favor: d.favor, member: d.isMember };
    }
  }
  if (args.includes("--files")) {
    res.homeFiles = Object.keys(homeFiles(servers)).sort();
  }
  const fi = args.indexOf("--file");
  if (fi >= 0) {
    const files = homeFiles(servers);
    console.log(files[args[fi + 1]] ?? `(nicht gefunden: ${args[fi + 1]})`);
    return;
  }
  console.log(JSON.stringify(res, null, 1));
}

if (process.argv[1] && process.argv[1].endsWith("aug-save.mjs")) {
  main();
}
