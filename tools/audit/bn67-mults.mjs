// Audit 03.10.2026, Gruppe BN6-7. Nur lesen.
//
// 1. BitNode-Multiplikatoren BN6 und BN7 direkt aus dem Spielquellcode 3.0.2
//    (BitNode/BitNode.tsx, getBitNodeMultipliers) lesen und gegen die
//    Bot-Tabelle src/lib/bitnodes.json pruefen (Soll = Quellcode, Ist = Bot).
//    Fehlende Felder gelten als Standard aus BitNodeMultipliers.ts.
// 2. SF6/SF7-Effekt je Stufe aus SourceFile/applySourceFile.ts:93-122
//    nachgebaut (mult = Summe 8/2^i, i < Stufe).
// 3. Hacking-Ausgang (V1) in BN6/7: calculateSkill aus
//    PersonObjects/formulas/skill.ts:7-15, geeicht gegen echte Spielstaende
//    (BN10 hat dieselbe HackingLevelMultiplier 0,35 wie BN6/7), dann die
//    Erfahrung fuer w0r1d_d43m0n = 3000 x WorldDaemonDifficulty
//    (Server/data/servers.ts:1553, Server/ServerHelpers.ts:422-424).
//
// Aufruf: node tools/audit/bn67-mults.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSave } from "./player-save.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = path.join(root, "reference", "bitburner-src", "src");
const backups = path.join(root, "backups");

// --- 1. Multiplikatoren aus dem Quellcode -----------------------------------
export function multsAusQuelle(n) {
  const text = fs.readFileSync(path.join(SRC, "BitNode", "BitNode.tsx"), "utf8");
  const start = text.indexOf("export function getBitNodeMultipliers");
  const ab = text.slice(start);
  const i = ab.indexOf("case " + n + ": {");
  if (i < 0) throw new Error("case " + n + " nicht gefunden");
  const block = ab.slice(i, ab.indexOf("});", i));
  const out = {};
  for (const m of block.matchAll(/^\s*(\w+):\s*([-\d.e]+),?\s*$/gm)) out[m[1]] = Number(m[2]);
  // Zeilennummer fuer den Beleg
  const zeile = text.slice(0, start + i).split("\n").length;
  return { mults: out, zeile };
}

export function standardAusQuelle() {
  const text = fs.readFileSync(path.join(SRC, "BitNode", "BitNodeMultipliers.ts"), "utf8");
  const out = {};
  for (const m of text.matchAll(/^\s{2}(\w+)\s*=\s*([-\d.e]+);/gm)) out[m[1]] = Number(m[2]);
  return out;
}

// --- 2. SF6/SF7 je Stufe (applySourceFile.ts:93-122) -------------------------
export function sfMult(lvl) {
  let mult = 0;
  for (let i = 0; i < lvl; ++i) mult += 8 / Math.pow(2, i);
  return 1 + mult / 100;
}

// --- 3. Skill-Formel (skill.ts:7-15) ----------------------------------------
export function calculateSkill(exp, mult = 1) {
  if (mult === 0) return 1;
  return Math.max(1, Math.floor(mult * (32 * Math.log(exp + 534.6) - 200)));
}
export function calculateExp(skill, mult = 1) {
  return Math.max(0, Math.exp((skill / mult + 200) / 32) - 534.6);
}

if (process.argv[1] && process.argv[1].endsWith("bn67-mults.mjs")) {
  const bot = JSON.parse(fs.readFileSync(path.join(root, "src", "lib", "bitnodes.json"), "utf8"));
  const std = standardAusQuelle();
  console.log("=== 1. BitNode-Multiplikatoren: Quellcode 3.0.2 (Soll) gegen src/lib/bitnodes.json (Ist) ===");
  console.log("Standardfelder im Quellcode: " + Object.keys(std).length + ", in bitnodes.json.standard: "
    + Object.keys(bot.standard).length);
  let stdAbw = 0;
  for (const [k, v] of Object.entries(std)) if (bot.standard[k] !== v) { stdAbw++; console.log("  Standard abweichend: " + k + " Soll " + v + " Ist " + bot.standard[k]); }
  console.log("  Standard-Abweichungen: " + stdAbw);
  for (const n of [6, 7]) {
    const { mults, zeile } = multsAusQuelle(n);
    const ist = bot.knoten[String(n)] || {};
    let abw = 0;
    console.log("\n-- BN" + n + " (BitNode.tsx:" + zeile + ", " + Object.keys(mults).length + " gesetzte Felder)");
    const alle = new Set([...Object.keys(std), ...Object.keys(mults), ...Object.keys(ist)]);
    for (const k of [...alle].sort()) {
      const soll = k in mults ? mults[k] : std[k];
      const istWert = k in ist ? ist[k] : bot.standard[k];
      const gesetzt = k in mults;
      if (soll !== istWert) { abw++; console.log("  ABWEICHUNG " + k + " Soll " + soll + " Ist " + istWert); }
      else if (gesetzt) console.log("  " + k.padEnd(28) + String(soll).padStart(6) + "  ok");
    }
    console.log("  Abweichungen BN" + n + ": " + abw);
  }

  console.log("\n=== 2. SF6/SF7 je Stufe (applySourceFile.ts:93-122) ===");
  for (const l of [1, 2, 3]) console.log("  Stufe " + l + ": x" + sfMult(l).toFixed(4));

  console.log("\n=== 3. Eichung calculateSkill gegen Spielstaende ===");
  const proben = [
    { f: "LIVE_197f4d61481686_BN10L3_2026-09-10T08-17_pre-install.json.gz", hackLM: 0.35, kampfLM: 0.4 },
    { f: "LIVE_197f4d61481686_BN2L1_2026-10-03T17-17_hourly.json.gz", hackLM: 0.8, kampfLM: 1 },
    { f: "LIVE_197f4d61481686_BN5L3_2026-09-28T19-21_pre-jump.json.gz", hackLM: 1, kampfLM: 1 },
  ];
  const gemessen = {};
  for (const pr of proben) {
    const { player: p } = loadSave(path.join(backups, pr.f));
    const hIst = p.skills.hacking;
    const hSoll = calculateSkill(p.exp.hacking, p.mults.hacking * pr.hackLM);
    const sIst = p.skills.strength;
    const sSoll = calculateSkill(p.exp.strength, p.mults.strength * pr.kampfLM);
    console.log("  " + pr.f.slice(20, 45) + "  hacking Spielstand " + hIst + " / Formel " + hSoll
      + "   strength Spielstand " + sIst + " / Formel " + sSoll
      + "   (mults.hacking " + p.mults.hacking.toFixed(4) + ", exp " + p.exp.hacking.toExponential(3) + ")");
    gemessen[pr.f.slice(20, 26)] = p.mults.hacking;
  }

  console.log("\n=== 4. V1 in BN6/7: Erfahrung fuer w0r1d_d43m0n ===");
  const ziel = 3000 * 2; // WorldDaemonDifficulty 2 in BN6 und BN7
  console.log("  Ziel-Level: 3000 x 2 = " + ziel);
  // mults.hacking-Annahmen: heutiger V2-Spieler (BN2L1), V1-Spitzenwert (BN5L3 pre-jump)
  const fuerMult = [["BN2L1 heute (V2)", gemessen["BN2L1_"] ?? 3], ["BN5L3 Ende (V1-Ausbau)", gemessen["BN5L3_"] ?? 10], ["x20 (hypothetisch)", 20]];
  // Spitzenrate gemessen in BN5L2 (25 x 64 TB, foodnstuff-grow): 3,27e7 exp/s
  // bei HackExpGain 0,5 (BN5) -> in BN6/7 (HackExpGain 0,25) halbiert.
  const rateBN5 = 3.27e7;
  const rate67 = rateBN5 * 0.25 / 0.5;
  for (const [name, mh] of fuerMult) {
    const exp67 = calculateExp(ziel, mh * 0.35);
    const exp5 = calculateExp(4500, mh * 1);
    console.log("  " + name.padEnd(24) + " mults.hacking " + mh.toFixed(3)
      + "  BN6/7: exp " + exp67.toExponential(3) + " = " + (exp67 / rate67 / 3600).toExponential(2) + " h"
      + "   (BN5 4500 zum Vergleich: exp " + exp5.toExponential(3) + ")");
  }
  console.log("  Rate angesetzt: " + rate67.toExponential(3) + " exp/s (BN5L2-Spitze 3,27e7 x 0,25/0,5)");
}
