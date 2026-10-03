// Audit 03.10.2026, Gruppe BN6-7: Rangkurven aller V2-Laeufe aus den
// Spielstaenden (backups/*.json.gz). Nur lesen.
//
// Je Spielstand: Knoten, Lauf, Spielzeit im Knoten, Rang, maxRank, Black Ops,
// Skillpunkte gesamt (totalSkillPoints), Summe der Skillstufen, Geld,
// eingebaute Augs, Kampfwerte, bladeburner_*-Mults, Simulacrum ja/nein.
//
// Aufruf: node tools/audit/bn67-kurven.mjs [--lauf BN9L1] [--csv]
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = path.join(root, "backups");
const args = process.argv.slice(2);
const nurLauf = (() => { const i = args.indexOf("--lauf"); return i >= 0 ? args[i + 1] : null; })();

const flach = (x) => {
  if (Array.isArray(x)) return x.map(flach);
  if (x && typeof x === "object") {
    if ("ctor" in x && "data" in x && Object.keys(x).length === 2) return flach(x.data);
    const o = {};
    for (const [k, v] of Object.entries(x)) o[k] = flach(v);
    return o;
  }
  return x;
};

export function zeile(datei) {
  const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(datei)).toString("utf8"));
  const p = JSON.parse(save.data.PlayerSave).data;
  const bb = p.bladeburner ? flach(p.bladeburner) : null;
  const augs = (p.augmentations || []).map((a) => a.name || a);
  const skills = bb ? bb.skills || {} : {};
  const summeStufen = Object.values(skills).reduce((s, v) => s + Number(v || 0), 0);
  return {
    datei: path.basename(datei),
    bn: p.bitNodeN,
    t_h: p.playtimeSinceLastBitnode / 3.6e6,
    tAug_h: p.playtimeSinceLastAug / 3.6e6,
    rank: bb ? bb.rank : null,
    maxRank: bb ? bb.maxRank : null,
    bo: bb ? bb.numBlackOpsComplete : null,
    tsp: bb ? bb.totalSkillPoints : null,
    sp: bb ? bb.skillPoints : null,
    stufen: summeStufen,
    skills,
    money: p.money,
    augs: augs.length,
    simulacrum: augs.includes("The Blade's Simulacrum"),
    str: p.skills.strength, def: p.skills.defense, dex: p.skills.dexterity, agi: p.skills.agility,
    cha: p.skills.charisma,
    bbChance: p.mults.bladeburner_success_chance,
    sf: Object.fromEntries((p.sourceFiles?.data || [])),
  };
}

function laeufe() {
  const idx = fs.readFileSync(path.join(dir, "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1);
  const out = [];
  for (const l of idx) {
    const t = l.split("\t");
    const bn = Number(t[4]); const lauf = Number(t[5]);
    if (!Number.isFinite(bn)) continue;
    const key = "BN" + bn + "L" + lauf;
    if (nurLauf && key !== nurLauf) continue;
    const f = path.join(dir, t[1]);
    if (!fs.existsSync(f)) continue;
    out.push({ key, ts: t[0], f });
  }
  return out;
}

if (import.meta.url.endsWith(path.basename(process.argv[1] || ""))) {
  const rows = [];
  for (const { key, ts, f } of laeufe()) {
    try { rows.push({ key, ts, ...zeile(f) }); } catch (e) { rows.push({ key, ts, fehler: String(e).slice(0, 80) }); }
  }
  if (args.includes("--json")) { console.log(JSON.stringify(rows)); process.exit(0); }
  for (const r of rows) {
    if (r.fehler) { console.log(r.key, r.ts, "FEHLER", r.fehler); continue; }
    console.log([r.key, r.ts.slice(0, 16), "t=" + r.t_h.toFixed(2), "rank=" + (r.rank == null ? "-" : Math.round(r.rank)),
      "max=" + (r.maxRank == null ? "-" : Math.round(r.maxRank)), "bo=" + r.bo, "tsp=" + r.tsp, "stufen=" + r.stufen,
      "augs=" + r.augs, "sim=" + (r.simulacrum ? 1 : 0), "kampf=" + [r.str, r.def, r.dex, r.agi].join("/"),
      "money=" + Number(r.money).toExponential(2), "bbC=" + Number(r.bbChance).toFixed(3)].join("  "));
  }
}
