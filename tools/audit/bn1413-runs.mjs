// Audit 03.10.2026, Gruppe BN14-13.
//
// Liest alle V2-Laeufe aus backups/ (nur lesen) und zieht je Spielstand die
// Kennwerte, mit denen BN13/BN14 gegen echte Laeufe geeicht werden:
// Spielzeit im Knoten, Rang, Kampfwerte, Kampf-Exp, Kampf-Mults, Geld,
// Beitritt (bladeburner != null), Black Ops, BitNode-Multiplikatoren des
// Knotens (aus BitNode.tsx nachgebaut in bn1413-mults.mjs).
//
// Aufruf: node tools/audit/bn1413-runs.mjs [--csv]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSave, jsonMap } from "./player-save.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = path.join(root, "backups");

export function readIndex() {
  const lines = fs.readFileSync(path.join(dir, "INDEX.tsv"), "utf8").trim().split(/\r?\n/);
  const head = lines.shift().split("\t");
  return lines.map((l) => {
    const c = l.split("\t");
    const o = {};
    head.forEach((h, i) => (o[h] = c[i]));
    return o;
  });
}

// Bladeburner-Objekt im PlayerSave: {ctor:"Bladeburner", data:{...}}
function blade(p) {
  const b = p.bladeburner;
  if (!b) return null;
  const d = b.data || b;
  // Abgeschlossene Black Ops stehen als Zaehler im Objekt (Bladeburner.ts,
  // numBlackOpsComplete) - das alte Feld "blackops" gibt es in 3.0.2 nicht
  // (die erste Fassung zaehlte deshalb immer 0). Ueberholt durch bn1413-eta.mjs.
  const bo = Number.isFinite(d.numBlackOpsComplete) ? d.numBlackOpsComplete : 0;
  return { rank: d.rank, maxRank: d.maxRank, skillPoints: d.skillPoints, totalSkillPoints: d.totalSkillPoints, blackops: bo,
    stamina: d.stamina, maxStamina: d.maxStamina, city: d.city };
}

export function row(file) {
  const { player: p } = loadSave(path.join(dir, file));
  const b = blade(p);
  const sk = p.skills || {};
  const ex = p.exp || {};
  const m = p.mults || {};
  return {
    file,
    bn: p.bitNodeN,
    tNode_h: p.playtimeSinceLastBitnode / 3.6e6,
    tAug_h: p.playtimeSinceLastAug / 3.6e6,
    money: p.money,
    str: sk.strength, def: sk.defense, dex: sk.dexterity, agi: sk.agility,
    strExp: ex.strength, defExp: ex.defense, dexExp: ex.dexterity, agiExp: ex.agility,
    mStr: m.strength, mStrExp: m.strength_exp, mBbChance: m.bladeburner_success_chance,
    augs: (p.augmentations || []).length,
    joined: !!b,
    rank: b ? b.rank : 0,
    maxRank: b ? b.maxRank : 0,
    blackops: b ? b.blackops : 0,
    sf: jsonMap(p.sourceFiles),
  };
}

if (process.argv[1] && process.argv[1].endsWith("bn1413-runs.mjs")) {
  const idx = readIndex();
  const v2 = new Set(["10L2", "10L3", "4L2", "4L3", "9L1", "9L2", "9L3", "2L1"]);
  const byRun = {};
  for (const r of idx) {
    const k = r.bitNode + "L" + r.lauf;
    if (!v2.has(k)) continue;
    if (!fs.existsSync(path.join(dir, r.datei))) continue;
    (byRun[k] ||= []).push(r);
  }
  const csv = process.argv.includes("--csv");
  for (const [k, rs] of Object.entries(byRun)) {
    rs.sort((a, b) => Number(a.totalPlaytime) - Number(b.totalPlaytime));
    console.log("== " + k + " (" + rs.length + " Staende)");
    for (const r of rs) {
      let x;
      try { x = row(r.datei); } catch (e) { console.log("  FEHLER " + r.datei + " " + e.message); continue; }
      const f = (v, d = 1) => (v === undefined || v === null ? "-" : Number(v).toFixed(d));
      console.log(csv ? [k, x.file, f(x.tNode_h, 2), f(x.tAug_h, 2), x.money, x.str, x.def, x.dex, x.agi, x.joined, f(x.rank, 0), x.blackops, x.augs].join(";")
        : "  " + f(x.tNode_h, 2).padStart(6) + " h  aug " + f(x.tAug_h, 2).padStart(6) + " h  $" + Number(x.money).toExponential(2)
        + "  kampf " + [x.str, x.def, x.dex, x.agi].join("/") + "  mStr " + f(x.mStr, 3) + " mStrExp " + f(x.mStrExp, 3)
        + "  " + (x.joined ? "BB rang " + f(x.rank, 0) + " bo " + x.blackops : "kein BB") + "  augs " + x.augs + "  " + r.anlass);
    }
  }
}
