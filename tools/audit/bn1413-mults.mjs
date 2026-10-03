// Audit 03.10.2026, Gruppe BN14-13.
//
// Baut die BitNode-Multiplikatoren aus dem Spielquellcode 3.0.2 nach
// (reference/bitburner-src/src/BitNode/BitNode.tsx, Funktion
// getBitNodeMultipliers, switch je Knoten) und vergleicht sie mit der
// Bot-Tabelle src/lib/bitnodes.json. Ausgabe: Abweichungen je Knoten und eine
// Vergleichstabelle der V2-relevanten Groessen fuer alle V2-Knoten der Route.
//
// Eichung: die gelesenen Werte werden gegen die Werte im Spielstand geprueft,
// wo das Spiel sie selbst speichert (es speichert sie nicht - deshalb ist die
// Eichung hier der Abgleich mit der Stufe-12-Formel und dem BN2-Hacking-LM,
// den stgo-blade.mjs am echten Spielstand geeicht hat: Stufe 372 bei LM 0,8).
//
// Aufruf: node tools/audit/bn1413-mults.mjs [--alle]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = path.join(root, "reference", "bitburner-src", "src", "BitNode", "BitNode.tsx");
const DEF = path.join(root, "reference", "bitburner-src", "src", "BitNode", "BitNodeMultipliers.ts");
const BOT = path.join(root, "src", "lib", "bitnodes.json");

// Vorgabewerte aus BitNodeMultipliers.ts ("  Name = 1;")
export function defaults() {
  const t = fs.readFileSync(DEF, "utf8");
  const o = {};
  for (const m of t.matchAll(/^\s+([A-Za-z0-9]+)\s*=\s*(-?[\d.]+);/gm)) o[m[1]] = Number(m[2]);
  return o;
}

// Werte je Knoten aus dem switch. inc/dec (nur BN12) werden mit der Stufe
// ausgewertet: inc = 1,02^lvl, dec = 1/inc (BitNode.tsx case 12).
export function nodeMults(n, lvl = 1) {
  const t = fs.readFileSync(SRC, "utf8");
  const start = t.indexOf("export function getBitNodeMultipliers");
  const body = t.slice(start);
  // Block von "case n: {" bis zum naechsten "case " oder "default:" - BN1 hat
  // "return new BitNodeMultipliers();" ohne Felder (BitNode.tsx:566-568).
  const a = body.indexOf("case " + n + ": {");
  if (a < 0) throw new Error("case " + n + " nicht gefunden");
  const rest = body.slice(a + 6);
  const ende = rest.search(/\n\s+(case \d+: \{|default: \{)/);
  const block = ende >= 0 ? rest.slice(0, ende) : rest;
  const inc = Math.pow(1.02, lvl);
  const dec = 1 / inc;
  const defaultMultipliers = defaults();
  const o = {};
  for (const mm of block.matchAll(/^\s+([A-Za-z0-9]+):\s*(.+),\s*$/gm)) {
    const expr = mm[2].trim();
    // nur Zahlen, inc/dec, Math.floor/min und defaultMultipliers.X, sonst Fehler
    if (!/^[-\d.\s*/+(),]*(?:(?:inc|dec|Math\.floor|Math\.min|defaultMultipliers\.[A-Za-z]+)[-\d.\s*/+(),]*)*$/.test(expr)) {
      throw new Error("Ausdruck " + expr);
    }
    // eslint-disable-next-line no-new-func
    o[mm[1]] = Function("inc", "dec", "defaultMultipliers", "return (" + expr + ");")(inc, dec, defaultMultipliers);
  }
  return o;
}

export function full(n, lvl = 1) {
  return { ...defaults(), ...nodeMults(n, lvl) };
}

if (process.argv[1] && process.argv[1].endsWith("bn1413-mults.mjs")) {
  const d = defaults();
  const bot = JSON.parse(fs.readFileSync(BOT, "utf8"));
  const knoten = process.argv.includes("--alle") ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15] : [13, 14];
  let abw = 0;
  for (const n of knoten) {
    const q = nodeMults(n, 1);
    const b = bot.knoten[String(n)] || {};
    const keys = new Set([...Object.keys(q), ...Object.keys(b)]);
    const diffs = [];
    for (const k of keys) {
      const qv = q[k] ?? d[k];
      const bv = b[k] ?? bot.standard?.[k] ?? d[k];
      if (Math.abs(qv - bv) > 1e-12) diffs.push(k + " Quelle " + qv + " Bot " + bv);
    }
    abw += diffs.length;
    console.log("BN" + n + ": " + Object.keys(q).length + " Felder im Quellcode, " + Object.keys(b).length
      + " in bitnodes.json, Abweichungen " + diffs.length + (diffs.length ? " -> " + diffs.join("; ") : ""));
  }
  // Eichung gegen den geeichten BN2-Wert und die BN12-Formel
  const bn2 = nodeMults(2, 1).HackingLevelMultiplier;
  console.log("Eichung BN2 HackingLevelMultiplier: Quelle " + bn2 + " / Spielstand-geeicht 0.8 (stgo-blade.mjs: Stufe 372) "
    + (Math.abs(bn2 - 0.8) < 1e-12 ? "OK" : "FEHLER"));
  const bn12 = nodeMults(12, 3).WorldDaemonDifficulty;
  console.log("Eichung BN12.3 WorldDaemonDifficulty: Quelle " + bn12.toFixed(6) + " / 1,02^3 = " + Math.pow(1.02, 3).toFixed(6)
    + " (1-bitnode-regeln.md: 3183,6 = 3000 x 1,0612) " + (Math.abs(bn12 * 3000 - 3183.6) < 0.1 ? "OK" : "FEHLER"));

  // Vergleichstabelle V2-Groessen
  const felder = ["BladeburnerRank", "BladeburnerSkillCost", "StrengthLevelMultiplier", "DexterityLevelMultiplier",
    "HackingLevelMultiplier", "HackExpGain", "ScriptHackMoney", "ServerMaxMoney", "ServerStartingSecurity", "CrimeMoney",
    "CrimeSuccessRate", "CrimeExpGain", "FactionWorkRepGain", "AugmentationMoneyCost", "AugmentationRepCost",
    "HacknetNodeMoney", "GoPower", "StaneksGiftPowerMultiplier", "StaneksGiftExtraSize", "WorldDaemonDifficulty",
    "DaedalusAugsRequirement", "GangUniqueAugs"];
  const v2 = [2, 3, 4, 6, 7, 9, 10, 11, 13, 14, 15];
  console.log("\nFeld".padEnd(28) + v2.map((n) => ("BN" + n).padStart(7)).join(""));
  for (const f of felder) {
    console.log(f.padEnd(27) + v2.map((n) => {
      const v = full(n, 1)[f];
      return String(Number(v.toFixed(4))).padStart(7);
    }).join(""));
  }
  // Effektive Ausgangsschwelle V1 (Hacking-Stufe / LevelMultiplier = noetiger Mult-Rohwert)
  console.log("\nV1-Schwelle 3000*WDD und noetige 'Rohstufe' (Stufe / HackingLevelMultiplier):");
  for (const n of [13, 14]) {
    const m = full(n, 1);
    const req = 3000 * m.WorldDaemonDifficulty;
    // skill.ts:7-20: exp = e^((stufe/mult + 200)/32) - 534,6; mult = Aug-Mult x HackingLevelMultiplier
    const exp = (mult) => Math.exp((req / (mult * m.HackingLevelMultiplier) + 200) / 32) - 534.6;
    console.log("  BN" + n + ": Stufe " + req + ", Rohstufe " + (req / m.HackingLevelMultiplier).toFixed(0)
      + "; Hacking-Exp bei Aug-Mult 5 / 10 / 20: " + [5, 10, 20].map((x) => exp(x).toExponential(1)).join(" / ")
      + "  (HackExpGain " + m.HackExpGain + ")");
  }
  console.log("  Vergleich BN5.2 (gemessen, 1-bitnode-regeln.md:54-61): 4500 bei Mult 9,04 = Exp "
    + (Math.exp((4500 / 9.04 + 200) / 32) - 534.6).toExponential(2));
  process.exitCode = abw ? 1 : 0;
}
