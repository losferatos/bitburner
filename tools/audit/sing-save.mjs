// Audit 03.10.2026, Bereich SING: Kennwerte aus den Spielstaenden (nur lesen).
// Aufruf: node tools/audit/sing-save.mjs [--all] [--file <muster>]
// Ohne --all: nur der juengste Stand. Mit --all: eine Zeile je Spielstand
// (Export-Bonus-Zeitpunkt, Int, Fokus, Arbeit, Faktionen), um zu sehen, wie
// oft der Export-Bonus tatsaechlich abgeholt wurde.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = path.join(root, "backups");

export function loadSave(file) {
  const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
  const player = JSON.parse(save.data.PlayerSave).data;
  return { save, player };
}

const jm = (m) => {
  if (!m) return {};
  const d = m.data || m;
  return Array.isArray(d) ? Object.fromEntries(d) : d;
};

// Spiel: PersonObjects/formulas/skill.ts:7-15 (calculateSkill)
export function calculateSkill(exp, mult = 1) {
  if (mult === 0) return 1;
  const v = Math.floor(mult * (32 * Math.log(exp + 534.6) - 200));
  return Math.max(v, 1);
}

export function rows() {
  const idx = fs.readFileSync(path.join(dir, "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1);
  return idx.map((l) => l.split("\t")).map((c) => ({ ts: c[0], file: c[1], bn: c[4], lauf: c[5], anlass: c[7] }));
}

export function summarize(file) {
  const { save, player: p } = loadSave(file);
  const fac = JSON.parse(save.data.FactionsSave);
  // Mitgliedschaft steht im Spieler (p.factions), FactionsSave traegt nur favor/rep/discovery
  const members = (p.factions || []).map((n) => { const f = fac[n] ? (fac[n].data || fac[n]) : {};
    return { n, favor: f.favor, rep: f.playerReputation }; });
  const ms = jm(p.moneySourceA);
  return {
    file: path.basename(file),
    bn: p.bitNodeN,
    lastExportBonus: Number(JSON.parse(save.data.LastExportBonus || "0")),
    lastSave: p.lastSave,
    intExp: p.exp.intelligence,
    intSkill: p.skills.intelligence,
    intCalc: calculateSkill(p.exp.intelligence, 1),
    persistentInt: p.persistentIntelligenceData,
    focus: p.focus,
    work: p.currentWork ? p.currentWork.ctor + ":" + JSON.stringify(p.currentWork.data).slice(0, 80) : null,
    members,
    lastNodeReset: p.lastNodeReset,
    lastAugReset: p.lastAugReset,
    playtimeSinceLastBitnode_h: p.playtimeSinceLastBitnode / 3.6e6,
    bitNodeOptions: p.bitNodeOptions,
    moneySourceA: ms,
    sf: jm(p.sourceFiles),
    exploits: p.exploits,
    hacking: p.skills.hacking,
    hackExp: p.exp.hacking,
    mults: { hacking_exp: p.mults.hacking_exp, faction_rep: p.mults.faction_rep },
    home: (() => {
      const all = JSON.parse(save.data.AllServersSave);
      const h = all.home && (all.home.data || all.home);
      return h ? { maxRam: h.maxRam, cores: h.cpuCores } : null;
    })(),
  };
}

// Textdatei von home aus dem Spielstand (AllServersSave.home.textFiles)
export function homeFile(file, name) {
  const { save } = loadSave(file);
  const all = JSON.parse(save.data.AllServersSave);
  const h = all.home.data || all.home;
  const tf = h.textFiles.data || h.textFiles;
  const ent = Array.isArray(tf) ? tf.find((e) => e[0] === name) : [name, tf[name]];
  if (!ent || !ent[1]) return null;
  const v = ent[1];
  return (v.data && v.data.text != null) ? v.data.text : (v.text != null ? v.text : JSON.stringify(v));
}

const args = process.argv.slice(2);
if (args.includes("--txt")) {
  // node tools/audit/sing-save.mjs --txt data/ausgang.txt [--file muster]
  const name = args[args.indexOf("--txt") + 1];
  const i = args.indexOf("--file");
  const r = rows();
  const f = i >= 0
    ? path.join(dir, fs.readdirSync(dir).filter((d) => d.includes(args[i + 1])).sort().pop())
    : path.join(dir, r[r.length - 1].file);
  console.log("# " + path.basename(f) + " :: " + name);
  console.log(homeFile(f, name));
} else if (args.includes("--all")) {
  const r = rows();
  let prev = null;
  for (const e of r) {
    const f = path.join(dir, e.file);
    if (!fs.existsSync(f)) continue;
    try {
      const s = summarize(f);
      const leb = s.lastExportBonus ? new Date(s.lastExportBonus).toISOString().slice(0, 16) : "0";
      const change = prev !== null && prev !== s.lastExportBonus ? "  <- NEU" : "";
      console.log([e.ts.slice(0, 16), "BN" + s.bn + "L" + e.lauf, e.anlass, "exportBonus " + leb,
        "int " + s.intSkill, "fac " + s.members.length, "focus " + s.focus].join(" | ") + change);
      prev = s.lastExportBonus;
    } catch (err) { console.log(e.file, "FEHLER", String(err).slice(0, 80)); }
  }
} else {
  const i = args.indexOf("--file");
  let f;
  if (i >= 0) {
    const pat = args[i + 1];
    f = path.join(dir, fs.readdirSync(dir).filter((d) => d.includes(pat)).sort().pop());
  } else {
    const r = rows();
    f = path.join(dir, r[r.length - 1].file);
  }
  console.log(JSON.stringify(summarize(f), null, 1));
}
