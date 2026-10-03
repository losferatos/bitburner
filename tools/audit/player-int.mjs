// Audit 03.10.2026, Bereich PLAYER: Intelligenz - Stufe aus Erfahrung, Wirkung, Quellen.
//
// Spiel 3.0.2 (nur gelesen):
//   PersonObjects/formulas/skill.ts:7-15     calculateSkill(exp, 1) = floor(32*ln(exp+534,6) - 200)
//   PersonObjects/formulas/intelligence.ts:1-3  Bonus = 1 + w*int^0,8/600
//   PersonObjects/Person.ts:176-190          gainIntelligenceExp nur mit SF5 oder in BN5, persistent
//   Wirkung (w): Hacking.ts:22,77 (Chance/Zeit, 1), NetworkShare/Share.ts:24 (share, 2),
//     reputation.ts:16-51 (Faktionsarbeit, 1 + int/3 bzw. int im Zaehler), Action.ts:175 (Bladeburner, 0,75),
//     Crime.ts:128-133 (1 + 0,025*int), GraftingHelpers.ts:24 (1), CreateProgramWork.ts:62 (3),
//     Sleeve.ts:271 / SleeveRecoveryWork.ts:15 (Schockabbau des Sleeves, Sleeve-Int), SleeveSynchroWork.ts:16 (Spieler-Int, 0,5)
//   Quellen: Singularity.ts:182 (Aug kaufen 15), :207 (Einbau 15), :766 (Beitritt 7,5), :587/:621 (home RAM/Kerne 3),
//     :412 (TOR 0,003), :452 (Programm 0,0003), :232/:390 (Ort/Reise 3e-5), Prestige.ts:353-356 (BN-Abschluss 300),
//     CrimeWork.ts:73 (Verbrechen), Bladeburner.ts:705-733 (BaseIntGain 0,003 x Zeit x diffMult x Gewicht),
//     CreateProgramWork.ts:79-81 (0,1 je Sekunde), GraftingWork.tsx:86-89 (0,005 je Sekunde), ClassWork (0,01/Zyklus Uni).
//
// EICHUNG: calculateSkill(exp.intelligence) gegen skills.intelligence in allen Spielstaenden.
// Aufruf: node tools/audit/player-int.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSave } from "./player-save.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = path.join(root, "backups");

export const calculateSkill = (exp, mult = 1) => Math.max(Math.floor(mult * (32 * Math.log(exp + 534.6) - 200)), 1);
export const calculateExp = (skill, mult = 1) => Math.exp((skill / mult + 200) / 32) - 534.6;
export const intBonus = (int, w = 1) => 1 + (w * Math.pow(int, 0.8)) / 600;

const isMain = process.argv[1] && process.argv[1].endsWith("player-int.mjs");
if (isMain) {
  const idx = fs.readFileSync(path.join(dir, "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((l) => l.split("\t"));
  // Eichung ueber alle vorhandenen Staende, ausgeduennt auf einen je Lauf und Stunde
  let n = 0, ok = 0;
  const runs = new Map();
  const seen = new Set();
  for (const c of idx) {
    const f = path.join(dir, c[1]);
    if (!fs.existsSync(f)) continue;
    const key = c[1].replace(/_\d\d-\d\d_[a-z-]+\.json\.gz$/, "") + c[0].slice(0, 13);
    if (seen.has(key)) continue;
    seen.add(key);
    let p;
    try { p = loadSave(f).player; } catch { continue; }
    n++;
    const calc = calculateSkill(p.exp.intelligence, 1);
    if (calc === p.skills.intelligence) ok++;
    else console.log("ABWEICHUNG", c[1], p.exp.intelligence, p.skills.intelligence, calc);
    const run = "BN" + p.bitNodeN + "L" + c[5];
    const r = runs.get(run) || { first: null, last: null };
    const pt = { file: c[1], h: p.playtimeSinceLastBitnode / 3.6e6, total: p.totalPlaytime / 3.6e6, exp: p.exp.intelligence, lvl: p.skills.intelligence,
      augs: (p.augmentations || []).length, bb: !!p.bladeburner };
    if (!r.first || pt.total < r.first.total) r.first = pt;
    if (!r.last || pt.total > r.last.total) r.last = pt;
    runs.set(run, r);
  }
  console.log("## Eichung calculateSkill(exp.intelligence) gegen skills.intelligence");
  console.log("Staende geprueft:", n, " exakt gleich:", ok);

  console.log("\n## Int-Erfahrung je Lauf (erster bis letzter Stand im Lauf, Spielzeit)");
  console.log("Lauf".padEnd(8), "Stunden", " Int-Exp", " exp/h", "Stufe von->bis", "BB");
  for (const [run, r] of [...runs.entries()].sort((a, b) => a[1].first.total - b[1].first.total)) {
    const dh = r.last.total - r.first.total;
    const dx = r.last.exp - r.first.exp;
    if (dh < 0.5) continue;
    console.log(run.padEnd(8), dh.toFixed(1).padStart(7), dx.toFixed(0).padStart(8), (dx / dh).toFixed(0).padStart(6), (r.first.lvl + "->" + r.last.lvl).padStart(14), r.last.bb ? "ja" : "-");
  }

  // Wert einer Stufe am heutigen Stand
  const latest = [...runs.values()].sort((a, b) => b.last.total - a.last.total)[0].last;
  const L = latest.lvl, X = latest.exp;
  console.log("\n## Wert am heutigen Stand: Int", L, "Exp", X.toFixed(0));
  const need1 = calculateExp(L + 1) - X;
  const need10 = calculateExp(L + 10) - X;
  console.log("Exp bis Stufe", L + 1, ":", need1.toFixed(0), "  bis", L + 10, ":", need10.toFixed(0), "(", (100 * need10 / X).toFixed(1), "% des Bestands )");
  for (const [name, w] of [["Hacking-Chance/-Zeit, Faktionsruf", 1], ["Bladeburner-Erfolg", 0.75], ["share", 2], ["Programm bauen", 3]]) {
    const b0 = intBonus(L, w), b1 = intBonus(L + 1, w), b10 = intBonus(L + 10, w);
    console.log(name.padEnd(36), "Bonus", b0.toFixed(4), " +1 Stufe", ((b1 / b0 - 1) * 100).toFixed(3) + " %", " +10 Stufen", ((b10 / b0 - 1) * 100).toFixed(2) + " %");
  }
  console.log("\n## Quellen: Stunden Spielerzeit fuer +1 Stufe (", need1.toFixed(0), "Exp )");
  const src = [
    ["createProgram (0,1 exp/s)", 0.1 * 3600],
    ["Heist BN2 fokussiert (Chance 0,10, player-crime.mjs)", 4.0],
    ["Bond Forgery BN2 (Chance 0,76)", 27.5],
    ["Larceny BN2 (Chance 1)", 30.0],
    ["Universitaet (0,01/Zyklus = 0,05/s)", 0.05 * 3600],
    ["Grafting (0,005/s)", 0.005 * 3600],
  ];
  for (const [name, perH] of src) console.log(name.padEnd(52), perH.toFixed(1).padStart(7), "exp/h ->", (need1 / perH).toFixed(1).padStart(7), "h");
  console.log("Einmalige Quellen: BN-Abschluss 300, Aug-Kauf je 15, Einbau 15, Beitritt 7,5, home RAM/Kern je 3");
}
