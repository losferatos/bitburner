// Liest Sleeve-, Karma- und Bladeburner-Kennwerte aus Spielstaenden (backups/*.json.gz).
// Nur lesen. Aufruf: node tools/audit/sleeve-save.mjs [muster] [--full]
// Ohne Muster: alle BN2L1-Staende plus der letzte BN12L3-Stand.
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

export function homeTextFile(save, name) {
  // AllServersSave: JSON-String, darin home mit textFiles (JSONMap)
  const all = JSON.parse(save.data.AllServersSave);
  const home = all.home && (all.home.data || all.home);
  if (!home) return null;
  const tf = home.textFiles;
  const entries = tf && tf.data ? tf.data : Array.isArray(tf) ? tf : [];
  for (const e of entries) {
    if (Array.isArray(e)) {
      const [k, v] = e;
      if (k === name) return (v.data || v).text;
    } else if (e && (e.data || e).filename === name) return (e.data || e).text;
  }
  return null;
}

function sleeveSummary(s) {
  const d = s.data || s;
  const w = d.currentWork ? (d.currentWork.data || d.currentWork) : null;
  const wctor = d.currentWork ? d.currentWork.ctor : null;
  return {
    shock: +Number(d.shock).toFixed(3),
    sync: +Number(d.sync).toFixed(3),
    memory: d.memory,
    storedCycles: d.storedCycles,
    skills: d.skills,
    exp: d.exp,
    multsSel: d.mults ? { str: d.mults.strength, dex: d.mults.dexterity, cha: d.mults.charisma,
      str_exp: d.mults.strength_exp, crime_success: d.mults.crime_success, faction_rep: d.mults.faction_rep } : null,
    augs: (d.augmentations || []).map((a) => a.name),
    city: d.city,
    work: wctor ? { ctor: wctor, ...(w.actionId ? { action: w.actionId.name } : {}),
      ...(w.crimeType ? { crime: w.crimeType } : {}), ...(w.factionName ? { faction: w.factionName, ft: w.factionWorkType } : {}),
      ...(w.classType ? { cls: w.classType } : {}), cyclesWorked: w.cyclesWorked, done: w.tasksCompleted } : null,
  };
}

export function summarize(file, full = false) {
  const { save, player: p } = loadSave(file);
  const bb = p.bladeburner && (p.bladeburner.data || p.bladeburner);
  const out = {
    file: path.basename(file),
    bitNodeN: p.bitNodeN,
    playtimeSinceLastBitnode_h: +(p.playtimeSinceLastBitnode / 3.6e6).toFixed(3),
    playtimeSinceLastAug_h: +(p.playtimeSinceLastAug / 3.6e6).toFixed(3),
    karma: +Number(p.karma).toFixed(3),
    numPeopleKilled: p.numPeopleKilled,
    money: p.money,
    skills: p.skills,
    sleevesFromCovenant: p.sleevesFromCovenant,
    gang: p.gang ? "ja" : null,
    augsInstalled: (p.augmentations || []).length,
    queued: (p.queuedAugmentations || []).length,
    bb: bb ? { rank: bb.rank, maxRank: bb.maxRank, teamSize: bb.teamSize, teamLost: bb.teamLost,
      stamina: bb.stamina, maxStamina: bb.maxStamina, city: bb.city, blackOps: bb.numBlackOpsComplete,
      action: bb.action, skillPoints: bb.skillPoints } : null,
    sleeves: (p.sleeves || []).map(sleeveSummary),
  };
  if (full) {
    for (const name of ["data/sleeve.json", "data/blade.json", "data/bn4rep.json", "data/verfahren.txt"]) {
      const t = homeTextFile(save, name);
      out[name] = t ? t.slice(0, 3000) : null;
    }
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith("sleeve-save.mjs")) {
  const args = process.argv.slice(2);
  const full = args.includes("--full");
  const pat = args.find((a) => !a.startsWith("--"));
  let files = fs.readdirSync(dir).filter((f) => f.endsWith(".json.gz"));
  if (pat) files = files.filter((f) => f.includes(pat));
  else files = files.filter((f) => f.includes("BN2L1") || f.includes("BN12L3_2026-10-03T04-42"));
  files.sort((a, b) => a.slice(-35).localeCompare(b.slice(-35)));
  for (const f of files) {
    try { console.log(JSON.stringify(summarize(path.join(dir, f), full))); }
    catch (e) { console.log(JSON.stringify({ file: f, err: String(e).slice(0, 200) })); }
  }
}
