// Liest Spielerkennwerte fuer das Audit "player" aus Spielstaenden (backups/*.json.gz).
// Nur lesen. Aufruf: node tools/audit/player-save.mjs [dateimuster] [--keys]
// Ohne Muster: der juengste Stand laut backups/INDEX.tsv.
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
  return { save, player };
}

export function jsonMap(m) {
  // JSONMap {"ctor":"JSONMap","data":[[k,v],...]} -> Objekt
  if (!m) return {};
  const d = m.data || m;
  if (Array.isArray(d)) return Object.fromEntries(d);
  return d;
}

export function factions(save) {
  const fs_ = JSON.parse(save.data.FactionsSave);
  const out = {};
  for (const [name, f] of Object.entries(fs_)) {
    const d = f.data || f;
    out[name] = { rep: d.playerReputation, favor: d.favor, member: d.isMember, banned: d.isBanned, invited: d.alreadyInvited };
  }
  return out;
}

export function latestFile() {
  const idx = fs.readFileSync(path.join(dir, "INDEX.tsv"), "utf8").trim().split(/\r?\n/);
  const last = idx[idx.length - 1].split("\t");
  return path.join(dir, last[1]);
}

export function summarize(file) {
  const { save, player: p } = loadSave(file);
  const ms = p.moneySourceA ? (p.moneySourceA.data || p.moneySourceA) : null;
  const msB = p.moneySourceB ? (p.moneySourceB.data || p.moneySourceB) : null;
  const facs = factions(save);
  // Mitgliedschaft steht NICHT im FactionsSave (dort nur favor/playerReputation/discovery),
  // sondern in Player.factions - so wie ExportBonus.tsx:16 sie liest.
  const joined = Object.fromEntries((p.factions || []).map((n) => [n, facs[n] || {}]));
  return {
    file: path.basename(file),
    bitNodeN: p.bitNodeN,
    sourceFiles: jsonMap(p.sourceFiles),
    playtimeSinceLastAug_h: p.playtimeSinceLastAug / 3.6e6,
    playtimeSinceLastBitnode_h: p.playtimeSinceLastBitnode / 3.6e6,
    totalPlaytime_h: p.totalPlaytime / 3.6e6,
    karma: p.karma,
    numPeopleKilled: p.numPeopleKilled,
    money: p.money,
    city: p.city,
    hp: p.hp,
    skills: p.skills,
    exp: p.exp,
    persistentInt: p.persistentIntelligenceData,
    exploits: p.exploits,
    achievementsCount: Array.isArray(p.achievements) ? p.achievements.length : null,
    focus: p.focus,
    currentWork: p.currentWork ? { ctor: p.currentWork.ctor, ...(p.currentWork.data || {}) } : null,
    multsSel: p.mults ? {
      crime_money: p.mults.crime_money, crime_success: p.mults.crime_success,
      str: p.mults.strength, def: p.mults.defense, dex: p.mults.dexterity, agi: p.mults.agility, cha: p.mults.charisma,
      str_exp: p.mults.strength_exp, dex_exp: p.mults.dexterity_exp, hack_exp: p.mults.hacking_exp,
      faction_rep: p.mults.faction_rep, hacking: p.mults.hacking,
    } : null,
    moneySourcesSinceAug: ms,
    moneySourcesSinceBitnode: msB,
    lastExportBonus: save.data.LastExportBonus,
    lastExportBonusIso: save.data.LastExportBonus ? new Date(Number(JSON.parse(save.data.LastExportBonus))).toISOString() : null,
    joinedFactions: joined,
    augsInstalled: (p.augmentations || []).length,
    augsQueued: (p.queuedAugmentations || []).map((a) => a.name),
    bitNodeOptions: p.bitNodeOptions,
    hasGang: !!p.gang,
  };
}

const args = process.argv.slice(2);
if (process.argv[1] && process.argv[1].endsWith("player-save.mjs")) {
  const pat = args.find((a) => !a.startsWith("--"));
  let files;
  if (pat) files = fs.readdirSync(dir).filter((f) => f.includes(pat) && f.endsWith(".json.gz")).map((f) => path.join(dir, f));
  else files = [latestFile()];
  if (args.includes("--keys")) {
    const { save, player } = loadSave(files[0]);
    console.log(Object.keys(save.data));
    console.log(Object.keys(player));
  } else {
    for (const f of files) console.log(JSON.stringify(summarize(f), null, 1));
  }
}
