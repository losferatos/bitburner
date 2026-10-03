// Audit 03.10.2026, Bereich PLAYER: Verbrechen des Spielers nachgebaut und geeicht.
//
// Formeln (Spiel 3.0.2, nur gelesen):
//   Crime/Crimes.ts:5-261           Tabelle (Zeit, Geld, Schwierigkeit, Karma, Gewichte, Exp, Int-Exp, Kills)
//   Crime/Crime.ts:120-136          successRate: (Summe w*skill + 0,025*int)/975/difficulty
//                                   * mults.crime_success * CrimeSuccessRate * intBonus(int,1), min 1
//   Work/Formulas.ts:58-79          calculateCrimeWorkStats: Geld * mults.crime_money * CrimeMoney,
//                                   Exp * mults.x_exp, alles * CrimeExpGain (Geld nicht)
//   Work/CrimeWork.ts:56-86         commit: focusBonus (1 fokussiert, sonst 0,8), Erfolg -> Geld+Kills+Int,
//                                   Fehlschlag -> Exp/4, Karma/4; Karma * focusBonus
//   PersonObjects/formulas/intelligence.ts:1-3   intBonus = 1 + w*int^0,8/600
//   Constants.ts:16,50              MaxSkillLevel 975, IntelligenceCrimeWeight 0,025
//
// EICHUNG: moneySourceA.crime im BN2.1-Stand (17:16) = 2.031.923,9247235279 $.
// Der Spieler hat in BN2.1 nur vor dem Divisionsbeitritt (23 min) Verbrechen
// begangen, bn4life startet bei Kampfwert < 40 Shoplift (src/bn4life.js:537).
// Ist der Betrag ein ganzzahliges Vielfaches des fokussierten Shoplift-Ertrags,
// stimmt die Geldformel samt CrimeMoney 3 und mults.crime_money.
//
// Aufruf: node tools/audit/player-crime.mjs [--file <muster>]
// Nur lesen.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSave, latestFile } from "./player-save.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BN = JSON.parse(fs.readFileSync(path.join(root, "src", "lib", "bitnodes.json"), "utf8"));
export const bnMult = (n, key) => {
  const k = BN.knoten[String(n)] || {};
  return key in k ? k[key] : BN.standard[key];
};

// Crime/Crimes.ts (Zeit ms, Geld, difficulty, karma, Gewichte, Exp, intExp-Faktor x 0,05, kills)
const I = 0.05; // CONSTANTS.IntelligenceCrimeBaseExpGain
export const CRIMES = {
  Shoplift: { t: 2e3, money: 15e3, diff: 1 / 20, karma: 0.1, w: { dex: 1, agi: 1 }, exp: { dex: 2, agi: 2 }, int: 0, kills: 0 },
  "Rob Store": { t: 60e3, money: 400e3, diff: 1 / 5, karma: 0.5, w: { hack: 0.5, dex: 2, agi: 1 }, exp: { hack: 30, dex: 45, agi: 45 }, int: 7.5 * I, kills: 0 },
  Mug: { t: 4e3, money: 36e3, diff: 1 / 5, karma: 0.25, w: { str: 1.5, def: 0.5, dex: 1.5, agi: 0.5 }, exp: { str: 3, def: 3, dex: 3, agi: 3 }, int: 0, kills: 0 },
  Larceny: { t: 90e3, money: 800e3, diff: 1 / 3, karma: 1.5, w: { hack: 0.5, dex: 1, agi: 1 }, exp: { hack: 45, dex: 60, agi: 60 }, int: 15 * I, kills: 0 },
  "Deal Drugs": { t: 10e3, money: 120e3, diff: 1, karma: 0.5, w: { cha: 3, dex: 2, agi: 1 }, exp: { dex: 5, agi: 5, cha: 10 }, int: 0, kills: 0 },
  "Bond Forgery": { t: 300e3, money: 4.5e6, diff: 1 / 2, karma: 0.1, w: { hack: 0.05, dex: 1.25 }, exp: { hack: 100, dex: 150, cha: 15 }, int: 60 * I, kills: 0 },
  "Traffick Arms": { t: 40e3, money: 600e3, diff: 2, karma: 1, w: { cha: 1, str: 1, def: 1, dex: 1, agi: 1 }, exp: { str: 20, def: 20, dex: 20, agi: 20, cha: 40 }, int: 0, kills: 0 },
  Homicide: { t: 3e3, money: 45e3, diff: 1, karma: 3, w: { str: 2, def: 2, dex: 0.5, agi: 0.5 }, exp: { str: 2, def: 2, dex: 2, agi: 2 }, int: 0, kills: 1 },
  "Grand Theft Auto": { t: 80e3, money: 1.6e6, diff: 8, karma: 5, w: { hack: 1, str: 1, dex: 4, agi: 2, cha: 2 }, exp: { str: 20, def: 20, dex: 20, agi: 80, cha: 40 }, int: 16 * I, kills: 0 },
  Kidnap: { t: 120e3, money: 3.6e6, diff: 5, karma: 6, w: { cha: 1, str: 1, dex: 1, agi: 1 }, exp: { str: 80, def: 80, dex: 80, agi: 80, cha: 80 }, int: 26 * I, kills: 0 },
  Assassination: { t: 300e3, money: 12e6, diff: 8, karma: 10, w: { str: 1, dex: 2, agi: 1 }, exp: { str: 300, def: 300, dex: 300, agi: 300 }, int: 65 * I, kills: 1 },
  Heist: { t: 600e3, money: 120e6, diff: 18, karma: 15, w: { hack: 1, str: 1, def: 1, dex: 1, agi: 1, cha: 1 }, exp: { hack: 450, str: 450, def: 450, dex: 450, agi: 450, cha: 450 }, int: 130 * I, kills: 0 },
};

export const intBonus = (int, w = 1) => 1 + (w * Math.pow(int, 0.8)) / 600;

// p: {hack,str,def,dex,agi,cha,int} Skills, m: mults (crime_success, crime_money, *_exp), n: BitNode
export function successRate(c, p, m, n) {
  let ch = 0;
  for (const [k, w] of Object.entries(c.w)) ch += w * p[k];
  ch += 0.025 * p.int;
  ch /= 975;
  ch /= c.diff;
  ch *= m.crime_success;
  ch *= bnMult(n, "CrimeSuccessRate");
  ch *= intBonus(p.int, 1);
  return Math.min(ch, 1);
}

export function perSuccessMoney(c, m, n, focus = true) {
  const fb = focus ? 1 : 0.8; // Constants.ts BaseFocusBonus 0,8 ohne NMI
  return c.money * m.crime_money * bnMult(n, "CrimeMoney") * fb;
}

// Erwartung je Sekunde Spielerzeit
export function rates(c, p, m, n, focus = true) {
  const s = successRate(c, p, m, n);
  const fb = focus ? 1 : 0.8;
  const sec = c.t / 1000;
  const money = (s * perSuccessMoney(c, m, n, focus)) / sec;
  const expMult = bnMult(n, "CrimeExpGain") * fb * (s + (1 - s) / 4);
  const combatExp = ["str", "def", "dex", "agi"].reduce((a, k) => a + (c.exp[k] || 0) * (m[k + "_exp"] || 1), 0) * expMult / sec;
  const hackExp = (c.exp.hack || 0) * (m.hack_exp || 1) * expMult / sec;
  const intExp = (s * c.int * bnMult(n, "CrimeExpGain") * fb) / sec; // Int nur bei Erfolg
  const karma = (c.karma * fb * (s + (1 - s) / 4)) / sec;
  return { s, money, combatExp, hackExp, intExp, karma, killsPerS: (s * c.kills) / sec };
}

function playerState(file) {
  const { player: pl } = loadSave(file);
  const k = pl.skills;
  return {
    bn: pl.bitNodeN,
    p: { hack: k.hacking, str: k.strength, def: k.defense, dex: k.dexterity, agi: k.agility, cha: k.charisma, int: k.intelligence },
    m: {
      crime_success: pl.mults.crime_success, crime_money: pl.mults.crime_money,
      str_exp: pl.mults.strength_exp, def_exp: pl.mults.defense_exp, dex_exp: pl.mults.dexterity_exp,
      agi_exp: pl.mults.agility_exp, hack_exp: pl.mults.hacking_exp, cha_exp: pl.mults.charisma_exp,
    },
    crimeMoney: (pl.moneySourceA.data || pl.moneySourceA).crime,
    hackMoney: (pl.moneySourceA.data || pl.moneySourceA).hacking,
    hAug: pl.playtimeSinceLastAug / 3.6e6,
  };
}

const isMain = process.argv[1] && process.argv[1].endsWith("player-crime.mjs");
if (isMain) {
  const args = process.argv.slice(2);
  const i = args.indexOf("--file");
  const dir = path.join(root, "backups");
  const file = i >= 0
    ? path.join(dir, fs.readdirSync(dir).filter((d) => d.includes(args[i + 1])).sort().pop())
    : latestFile();
  const st = playerState(file);
  const fmt = (x, d = 0) => Number(x).toLocaleString("de-DE", { maximumFractionDigits: d, minimumFractionDigits: d });

  console.log("# Stand", path.basename(file), "BN" + st.bn);
  console.log("# Skills", JSON.stringify(st.p));
  console.log("# mults crime_money", st.m.crime_money, "crime_success", st.m.crime_success);

  // --- Eichung ------------------------------------------------------------
  const shop = perSuccessMoney(CRIMES.Shoplift, st.m, st.bn, true);
  const shopU = perSuccessMoney(CRIMES.Shoplift, st.m, st.bn, false);
  const nF = st.crimeMoney / shop;
  console.log("\n## Eichung moneySourceA.crime");
  console.log("Ist (Spielstand)            ", st.crimeMoney);
  console.log("Shoplift je Erfolg fokussiert", shop, " unfokussiert", shopU);
  console.log("Ist / fokussiert             ", nF);
  // ganzzahlige Zerlegung a*fokussiert + b*unfokussiert suchen
  let best = null;
  for (let a = 0; a <= Math.ceil(nF) + 1; a++) {
    const rest = st.crimeMoney - a * shop;
    const b = Math.round(rest / shopU);
    if (b < 0) continue;
    const err = Math.abs(rest - b * shopU);
    if (!best || err < best.err) best = { a, b, err };
  }
  console.log("beste Zerlegung: " + best.a + " x fokussiert + " + best.b + " x unfokussiert, Rest " + best.err.toExponential(3) + " $");

  // --- Tabelle aller Verbrechen am aktuellen Stand ----------------------------
  console.log("\n## Alle Verbrechen am aktuellen Stand (fokussiert / unfokussiert), BN" + st.bn);
  console.log("Verbrechen".padEnd(18), "Chance", "  $/s fok", "  $/h unfok", "Kampf-Exp/s", "Int-Exp/h", "Karma/h", "Kills/h");
  const rows = [];
  for (const [name, c] of Object.entries(CRIMES)) {
    const r = rates(c, st.p, st.m, st.bn, true);
    const u = rates(c, st.p, st.m, st.bn, false);
    rows.push({ name, r, u });
  }
  rows.sort((a, b) => b.r.money - a.r.money);
  for (const { name, r, u } of rows) {
    console.log(name.padEnd(18), r.s.toFixed(3).padStart(6), fmt(r.money).padStart(9), fmt(u.money * 3600 / 1e6, 1).padStart(9) + " Mio",
      r.combatExp.toFixed(2).padStart(10), (r.intExp * 3600).toFixed(1).padStart(9), (r.karma * 3600).toFixed(0).padStart(7), (r.killsPerS * 3600).toFixed(0).padStart(7));
  }

  // --- Vergleich mit Hacking-Einkommen -------------------------------------
  const hackPerH = st.hackMoney / st.hAug;
  const best1 = rows[0];
  console.log("\n## Vergleich (BN" + st.bn + ")");
  console.log("Hacking-Einkommen gemessen  ", fmt(hackPerH / 1e9, 2), "Mrd $/h (moneySourceA.hacking / playtimeSinceLastAug)");
  console.log("bestes Verbrechen " + best1.name + " fok ", fmt(best1.r.money * 3600 / 1e9, 3), "Mrd $/h =", (100 * best1.r.money * 3600 / hackPerH).toFixed(1), "% des Hackings");
  console.log("                     unfok ", fmt(best1.u.money * 3600 / 1e9, 3), "Mrd $/h");

  // --- Leiter in bn4life.js:537 gegen das Optimum ---------------------------
  console.log("\n## bn4life-Leiter (Kampfwert <40 Shoplift, <117 Mug, sonst Homicide) gegen Optimum, gleiche Kampfwerte, int/mults wie Stand");
  console.log("Kampf", "Leiter".padEnd(10), " $/s Leiter", " bestes".padEnd(20), "$/s best", "Verlust");
  for (const s of [5, 20, 40, 60, 80, 100, 117, 150, 200, 300]) {
    const p = { ...st.p, str: s, def: s, dex: s, agi: s };
    const leiter = s < 40 ? "Shoplift" : s < 117 ? "Mug" : "Homicide";
    const rl = rates(CRIMES[leiter], p, st.m, st.bn, true).money;
    let bn = null, bv = -1;
    for (const [name, c] of Object.entries(CRIMES)) { const v = rates(c, p, st.m, st.bn, true).money; if (v > bv) { bv = v; bn = name; } }
    console.log(String(s).padStart(5), leiter.padEnd(10), fmt(rl).padStart(10), (" " + bn).padEnd(20), fmt(bv).padStart(8), ((1 - rl / bv) * 100).toFixed(0).padStart(5) + " %");
  }

  // --- Geld-Knoten der Restroute -------------------------------------------
  console.log("\n## Restroute: Verbrechen (bestes, fokussiert, Stand-Skills) gegen grob skaliertes Hacking-Einkommen");
  console.log("(Hacking skaliert mit ServerMaxMoney*ScriptHackMoney relativ zu BN2 - GESCHAETZT, ohne Wachstum/Mults)");
  const base = bnMult(2, "ServerMaxMoney") * bnMult(2, "ScriptHackMoney");
  for (const n of [2, 3, 11, 6, 7, 14, 13, 15, 8]) {
    const f = bnMult(n, "ServerMaxMoney") * bnMult(n, "ScriptHackMoney") * bnMult(n, "ScriptHackMoneyGain") / base;
    let bv = 0, bn = "";
    for (const [name, c] of Object.entries(CRIMES)) { const v = rates(c, st.p, st.m, n, true).money; if (v > bv) { bv = v; bn = name; } }
    const hack = hackPerH * f;
    console.log("BN" + String(n).padEnd(3), "CrimeMoney", String(bnMult(n, "CrimeMoney")).padEnd(5), "CrimeSucc", String(bnMult(n, "CrimeSuccessRate")).padEnd(4),
      "bestes", bn.padEnd(16), fmt(bv * 3600 / 1e9, 3).padStart(7), "Mrd/h  Hacking~", fmt(hack / 1e9, 2).padStart(6), "Mrd/h  Anteil", hack > 0 ? (100 * bv * 3600 / hack).toFixed(0) + " %" : "inf");
  }
}
