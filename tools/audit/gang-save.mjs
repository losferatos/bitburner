// Liest Spielstaende (backups/*.json.gz) und gibt die Kennwerte aus, die fuer
// das Gang-Audit gebraucht werden: Karma, Geld, Faktionsreputation, Rang,
// Sleeve-Taetigkeit, Augs, Gang-Objekt (falls vorhanden).
//
// Aufruf: node tools/audit/gang-save.mjs [Filter-Teilstring im Dateinamen]
// Ohne Filter: alle BN2-Staende.
//
// Nur lesen - kein Schreiben ausser auf stdout.
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const BACKUPS = path.join(ROOT, "backups");

export function readSave(file) {
  const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
  const p = JSON.parse(save.data.PlayerSave).data;
  const factions = JSON.parse(save.data.FactionsSave);
  return { save, p, factions };
}

export function summary(file) {
  const { save, p, factions } = readSave(file);
  const rep = {};
  for (const [k, v] of Object.entries(factions)) {
    const d = v.data || v;
    if (d.playerReputation > 0) rep[k] = Math.round(d.playerReputation);
  }
  const bb = p.bladeburner && (p.bladeburner.data || p.bladeburner);
  return {
    file: path.basename(file),
    bitNodeN: p.bitNodeN,
    hInNode: +(p.playtimeSinceLastBitnode / 3.6e6).toFixed(3),
    hSinceAug: +(p.playtimeSinceLastAug / 3.6e6).toFixed(3),
    karma: +p.karma.toFixed(3),
    kills: p.numPeopleKilled,
    money: p.money,
    moneySourceA: p.moneySourceA && (p.moneySourceA.data || p.moneySourceA),
    skills: p.skills,
    factionRepMult: p.mults.faction_rep,
    crimeSuccessMult: p.mults.crime_success,
    rep,
    bbRank: bb ? bb.rank : null,
    augs: (p.augmentations || []).map((a) => a.name + (a.level > 1 ? "x" + a.level : "")),
    queued: (p.queuedAugmentations || []).map((a) => a.name),
    sleeves: (p.sleeves || []).map((s) => {
      const d = s.data;
      const w = d.currentWork;
      return {
        shock: +d.shock.toFixed(2), sync: +d.sync.toFixed(2),
        work: w ? w.ctor + (w.data && (w.data.crimeType || (w.data.actionId && w.data.actionId.name) || w.data.factionName) ? ":" + (w.data.crimeType || (w.data.actionId && w.data.actionId.name) || w.data.factionName) : "") : null,
        str: d.skills.strength, agi: d.skills.agility, dex: d.skills.dexterity, def: d.skills.defense,
      };
    }),
    gang: p.gang,
    allGangsSave: save.data.AllGangsSave ? save.data.AllGangsSave.length : 0,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (isMain) {
  const filter = process.argv[2] || "_BN2L";
  const files = fs.readdirSync(BACKUPS).filter((f) => f.endsWith(".json.gz") && f.includes(filter)).sort();
  for (const f of files) {
    const s = summary(path.join(BACKUPS, f));
    console.log(JSON.stringify(s));
  }
}
