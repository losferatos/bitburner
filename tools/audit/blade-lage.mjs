// Audit 03.10.2026 (Bereich BLADE): liest einen Spielstand aus backups/ und
// gibt die Bladeburner-Lage aus - Division, Staedte, Aktionsvorraete, Skills,
// Spielerwerte, Sleeves - plus die Bot-Telemetrie data/blade.json und
// data/aktionen.txt vom home-Server. Nur lesen, nichts schreiben.
//
// Aufruf: node tools/audit/blade-lage.mjs [backupdatei] [--aktionen N] [--json]
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
let datei = args.find((a) => !a.startsWith("--") && !/^\d+$/.test(a));
const nAkt = (() => { const i = args.indexOf("--aktionen"); return i >= 0 ? Number(args[i + 1]) : 40; })();
if (!datei) {
  const idx = fs.readFileSync(path.join(root, "backups", "INDEX.tsv"), "utf8").trim().split(/\r?\n/);
  datei = idx[idx.length - 1].split("\t")[1];
}
if (!path.isAbsolute(datei)) datei = path.join(root, "backups", path.basename(datei));

export function ladeSpielstand(pfad) {
  const roh = fs.readFileSync(pfad);
  const text = zlib.gunzipSync(roh).toString("utf8");
  const save = JSON.parse(text);
  const p = JSON.parse(save.data.PlayerSave).data;
  const servers = JSON.parse(save.data.AllServersSave);
  const factions = JSON.parse(save.data.FactionsSave);
  return { save, p, servers, factions };
}

// Reviver-Objekte ({ctor, data}) flach machen
export function flach(x) {
  if (Array.isArray(x)) return x.map(flach);
  if (x && typeof x === "object") {
    if ("ctor" in x && "data" in x && Object.keys(x).length === 2) return flach(x.data);
    const o = {};
    for (const [k, v] of Object.entries(x)) o[k] = flach(v);
    return o;
  }
  return x;
}

export function homeDatei(servers, name) {
  const home = flach(servers.home);
  const tf = home.textFiles;
  if (!tf) return null;
  // JSONMap -> [[name, {text}]]
  const liste = Array.isArray(tf) ? tf : (tf.data || Object.entries(tf));
  for (const e of liste) {
    const [fn, obj] = Array.isArray(e) ? e : [e.filename, e];
    if (fn === name || fn === "/" + name) return (obj && (obj.text ?? obj.data?.text)) ?? null;
  }
  return null;
}

if (import.meta.url.endsWith(path.basename(process.argv[1] || ""))) {
  const { p, servers, factions } = ladeSpielstand(datei);
  const bb = flach(p.bladeburner);
  const out = {
    datei: path.basename(datei),
    bitNodeN: p.bitNodeN,
    playtimeSinceLastBitnode_h: +(p.playtimeSinceLastBitnode / 3.6e6).toFixed(2),
    playtimeSinceLastAug_h: +(p.playtimeSinceLastAug / 3.6e6).toFixed(2),
    money: p.money,
    skills: p.skills,
    exp: p.exp,
    hp: p.hp,
    mults: Object.fromEntries(Object.entries(p.mults).filter(([k]) => /bladeburner|strength|defense|dexterity|agility|charisma|faction_rep/.test(k))),
    karma: p.karma,
    city: p.city,
    augs: (p.augmentations || []).map((a) => a.name || a),
    queued: (p.queuedAugmentations || []).map((a) => a.name || a),
    currentWork: p.currentWork ? flach(p.currentWork) : null,
  };
  if (bb) {
    out.bb = {
      rank: bb.rank, maxRank: bb.maxRank, skillPoints: bb.skillPoints, totalSkillPoints: bb.totalSkillPoints,
      teamSize: bb._teamSize ?? bb.teamSize, teamLost: bb.teamLost, numHosp: bb.numHosp, moneyLost: bb.moneyLost,
      stamina: bb.stamina, maxStamina: bb.maxStamina, staminaBonus: bb.staminaBonus,
      storedCycles: bb.storedCycles, city: bb.city, action: bb.action,
      actionTimeCurrent: bb.actionTimeCurrent, actionTimeToComplete: bb.actionTimeToComplete,
      numBlackOpsComplete: bb.numBlackOpsComplete, skills: bb.skills,
      automateEnabled: bb.automateEnabled,
    };
    out.cities = Object.fromEntries(Object.entries(bb.cities).map(([n, c]) => [n, {
      pop: c.pop, popEst: c.popEst, r: +(c.pop / c.popEst).toFixed(4), comms: c.comms, chaos: +c.chaos.toFixed(3),
    }]));
    const lev = (o) => Object.fromEntries(Object.entries(o).map(([n, a]) => [n, {
      count: +Number(a.count).toFixed(2), level: a.level, maxLevel: a.maxLevel, autoLevel: a.autoLevel,
      successes: a.successes, failures: a.failures, teamCount: a.teamCount,
    }]));
    out.contracts = lev(bb.contracts);
    out.operations = lev(bb.operations);
  }
  out.sleeves = (p.sleeves || []).map((s0) => {
    const s = flach(s0);
    return { shock: s.shock, sync: s.sync, skills: s.skills, city: s.city,
      work: s.currentWork ? (s.currentWork.type + ":" + (s.currentWork.actionId ? s.currentWork.actionId.type + "/" + s.currentWork.actionId.name : (s.currentWork.crimeType || s.currentWork.factionName || s.currentWork.classType || ""))) : null };
  });
  const bf = flach(factions);
  const bbf = bf.Bladeburners || bf["Bladeburners"];
  out.bladeburnerFaction = bbf ? { rep: bbf.playerReputation, favor: bbf.favor, member: bbf.isMember } : null;
  const bj = homeDatei(servers, "data/blade.json");
  out.bladeJson = bj ? JSON.parse(bj) : null;
  const ak = homeDatei(servers, "data/aktionen.txt");
  if (ak) {
    const zeilen = ak.split("\n").filter((z) => z.trim());
    out.aktionenZeilen = zeilen.length;
    out.aktionenLetzte = zeilen.slice(-nAkt).map((z) => { try { return JSON.parse(z); } catch { return z; } });
  }
  if (args.includes("--json")) console.log(JSON.stringify(out));
  else console.log(JSON.stringify(out, null, 1));
}
