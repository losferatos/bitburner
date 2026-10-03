// Audit 03.10.2026, Gruppe BN15-8: Rechner fuer BitNode 15 (V2/V1b) und
// BitNode 8 (V1, Boerse). Nur lesen, nichts schreiben.
//
// Aufruf: node tools/audit/bn15-8-calc.mjs [A|B|C|D|alle] [--seeds N]
//
// A  Multiplikatoren: getBitNodeMultipliers() wird aus
//    reference/bitburner-src/src/BitNode/BitNode.tsx:563-1123 AUSGEFUEHRT
//    (Funktionsrumpf eingelesen, nicht abgeschrieben) und gegen
//    src/lib/bitnodes.json gehalten. Eichung: Soll = Quelle, Ist = Bot-Tabelle.
// B  Hacking-Stufe: calculateSkill (PersonObjects/formulas/skill.ts:7-15) mit
//    mult = mults.hacking * HackingLevelMultiplier (PersonObjects/Person.ts:62),
//    geeicht gegen skills.hacking echter Spielstaende (BN2L1, BN1L3, BN5L3,
//    BN12L1-3). Danach: was V1/V1b in BN15 (6000 = 3000 * WDD 2,
//    ServerHelpers.ts:422-424, bei HLM 0,6) und V1 in BN8 (2500 Daedalus /
//    3000 Ausgang, HLM 1) an Erfahrung kosten.
// C  BN15 auf dem Bladeburner-Weg: gemessene Rangkurven aller V2-Laeufe
//    (backups/, Leser aus bn67-kurven.mjs). Rang = BladeburnerRank x Rohrang
//    (Bladeburner/Formulas.ts:9-28); reqdRank 400.000 skaliert NICHT
//    (BlackOperations.ts:708). BN15 braucht also Rohrang 2 Mio.
// D  BN8 Boerse je Einbauzyklus: Marktmodell boerse-sim.mjs (Quelle
//    StockMarket/*.ts, Selbsttest --eich). Startkapital je Zyklus 250 Mio
//    (Prestige.ts:158-160), 4S-API bleibt ueber Einbauten
//    (PlayerObjectGeneralMethods.ts:163-166 nur in prestigeSourceFile).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { zeile } from "./bn67-kurven.mjs";
import { run, makeBotStrategy, makeOptStrategy } from "./boerse-sim.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const REF = path.join(root, "reference", "bitburner-src", "src");
const args = process.argv.slice(2);
const which = args.find((a) => /^[A-D]$|^alle$/.test(a)) ?? "alle";
const SEEDS = args.includes("--seeds") ? Number(args[args.indexOf("--seeds") + 1]) : 8;
const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toExponential(d) : String(x));

// ---------------------------------------------------------------------------
// getBitNodeMultipliers aus der Quelle ausfuehren
// ---------------------------------------------------------------------------
export function loadBnMults() {
  const src = fs.readFileSync(path.join(REF, "BitNode", "BitNode.tsx"), "utf8");
  const start = src.indexOf("export function getBitNodeMultipliers(");
  const open = src.indexOf("{", start);
  // Rumpf bis zur passenden schliessenden Klammer
  let depth = 0, end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  const body = src.slice(open + 1, end);
  const defaults = loadDefaults();
  class BitNodeMultipliers {
    constructor(a = {}) { Object.assign(this, defaults); for (const [k, v] of Object.entries(a)) this[k] = v; }
  }
  const defaultMultipliers = new BitNodeMultipliers();
  const fn = new Function("n", "lvl", "BitNodeMultipliers", "defaultMultipliers", body);
  return { get: (n, lvl) => fn(n, lvl, BitNodeMultipliers, defaultMultipliers), defaults };
}

function loadDefaults() {
  const src = fs.readFileSync(path.join(REF, "BitNode", "BitNodeMultipliers.ts"), "utf8");
  const out = {};
  for (const m of src.matchAll(/^\s{2}(\w+)\s*=\s*(-?[0-9.]+);/gm)) out[m[1]] = Number(m[2]);
  return out;
}

// ---------------------------------------------------------------------------
// Spielstaende
// ---------------------------------------------------------------------------
const dir = path.join(root, "backups");
function indexRows() {
  return fs.readFileSync(path.join(dir, "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1)
    .map((l) => l.split("\t")).filter((t) => fs.existsSync(path.join(dir, t[1])))
    .map((t) => ({ ts: t[0], f: path.join(dir, t[1]), bn: Number(t[4]), lauf: Number(t[5]), anlass: t[7] }));
}
function player(f) {
  const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString("utf8"));
  return JSON.parse(save.data.PlayerSave).data;
}
const sfMap = (p) => Object.fromEntries(p.sourceFiles?.data || []);

// skill.ts:7-15
export const calculateSkill = (exp, mult = 1) => (mult === 0 ? 1 : Math.max(1, Math.floor(mult * (32 * Math.log(exp + 534.6) - 200))));
export const calculateExp = (skill, mult = 1) => Math.exp((skill / mult + 200) / 32) - 534.6;

// ---------------------------------------------------------------------------
if (which === "A" || which === "alle") {
  console.log("=== A) Multiplikatoren BN8 / BN15: Quelle (ausgefuehrt) gegen src/lib/bitnodes.json ===");
  const { get, defaults } = loadBnMults();
  const bot = JSON.parse(fs.readFileSync(path.join(root, "src", "lib", "bitnodes.json"), "utf8"));
  for (const n of [8, 15]) {
    const q = get(n, 1);
    const b = { ...bot.standard, ...(bot.knoten[String(n)] || {}) };
    const abw = [];
    const nichtStandard = [];
    for (const k of Object.keys(defaults)) {
      if (q[k] !== defaults[k]) nichtStandard.push(k + "=" + q[k]);
      if (Math.abs((q[k] ?? 1) - (b[k] ?? 1)) > 1e-12) abw.push(k + ": Quelle " + q[k] + " / Bot " + b[k]);
    }
    console.log("BN" + n + " (Stufe 1): " + nichtStandard.length + " Felder ungleich Standard: " + nichtStandard.join(", "));
    console.log("   Abweichungen Bot-Tabelle: " + (abw.length ? abw.join("; ") : "keine (" + Object.keys(defaults).length + " Felder geprueft)"));
    // Stufen 2/3 unterscheiden sich in BN8/BN15 nicht (kein lvl im case)
    const q3 = get(n, 3);
    const diff23 = Object.keys(defaults).filter((k) => q3[k] !== q[k]);
    console.log("   Stufe 3 gegen Stufe 1: " + (diff23.length ? diff23.join(",") : "identisch"));
  }
}

// ---------------------------------------------------------------------------
if (which === "B" || which === "alle") {
  console.log("\n=== B) Hacking-Stufe: Eichung und Bedarf V1/V1b ===");
  const { get } = loadBnMults();
  const rows = indexRows();
  const pick = (bn, lauf, anlassBevorzugt) => {
    const r = rows.filter((x) => x.bn === bn && x.lauf === lauf);
    const pref = r.filter((x) => x.anlass === anlassBevorzugt);
    return (pref.length ? pref : r).slice(-1)[0];
  };
  const eich = [[2, 1], [1, 3, "pre-jump"], [5, 3, "pre-jump"], [12, 1, "pre-jump"], [12, 2, "pre-jump"], [12, 3, "pre-jump"], [5, 2]];
  const endMults = [];
  for (const [bn, lauf, an] of eich) {
    const r = pick(bn, lauf, an);
    if (!r) { console.log("BN" + bn + "L" + lauf + ": kein Spielstand"); continue; }
    const p = player(r.f);
    const lvl = Math.min((sfMap(p)[bn] || 0) + 1, bn === 12 ? Infinity : 3);
    const hlm = get(bn, lvl).HackingLevelMultiplier;
    const ist = calculateSkill(p.exp.hacking, p.mults.hacking * hlm);
    console.log("BN" + bn + "L" + lauf + " " + path.basename(r.f).slice(27, 50) + ": exp " + fmt(p.exp.hacking, 4)
      + " mults.hacking " + p.mults.hacking.toFixed(4) + " HLM " + hlm.toFixed(4)
      + " -> Nachbau " + ist + " | Spielstand " + p.skills.hacking + (ist === p.skills.hacking ? "  OK" : "  ABWEICHUNG"));
    if (bn !== 2) endMults.push({ key: "BN" + bn + "L" + lauf, m: p.mults.hacking, augs: (p.augmentations || []).length });
  }
  // Erfahrungsrate der V1-Laeufe am Laufende: zwei aufeinanderfolgende Staende
  // ohne Einbau dazwischen (playtimeSinceLastAug waechst)
  console.log("\nErfahrungsrate am Ende der V1-Laeufe (zwei Staende ohne Einbau dazwischen):");
  const raten = [];
  for (const key of ["BN1L3", "BN5L2", "BN5L3", "BN12L1", "BN12L2", "BN12L3"]) {
    const [bn, lauf] = key.slice(2).split("L").map(Number);
    const r = rows.filter((x) => x.bn === bn && x.lauf === lauf);
    let best = null;
    for (let i = r.length - 1; i > 0 && !best; i--) {
      const a = player(r[i - 1].f), b = player(r[i].f);
      const dt = (b.playtimeSinceLastAug - a.playtimeSinceLastAug) / 1000;
      if (dt > 300 && b.playtimeSinceLastAug > a.playtimeSinceLastAug && b.exp.hacking > a.exp.hacking) {
        best = { key, rate: (b.exp.hacking - a.exp.hacking) / dt, dt, m: b.mults.hacking };
      }
    }
    if (best) { raten.push(best); console.log("   " + key + ": " + fmt(best.rate, 3) + " exp/s ueber " + (best.dt / 60).toFixed(0) + " min, mults.hacking " + best.m.toFixed(3)); }
  }
  const rMax = Math.max(...raten.map((x) => x.rate));
  console.log("\nBedarf (Erfahrung) und Zeit bei der hoechsten gemessenen Rate " + fmt(rMax, 2) + " exp/s; BN15 x0,6 (HackingSpeedMultiplier, BitNode.tsx:1088):");
  console.log("mults.hacking | BN15 6000 (HLM 0,6) exp | h        | BN8 2500 exp | BN8 3000 exp | h (3000)");
  for (const m of [4, 6, 8, 10, 12, 15, 20, 25]) {
    const e15 = calculateExp(6000, m * 0.6), e8a = calculateExp(2500, m), e8 = calculateExp(3000, m);
    console.log(String(m).padStart(13) + " | " + fmt(e15).padStart(23) + " | " + (e15 / (rMax * 0.6) / 3600).toExponential(1).padStart(8)
      + " | " + fmt(e8a).padStart(12) + " | " + fmt(e8).padStart(12) + " | " + (e8 / rMax / 3600).toExponential(1));
  }
  console.log("Gemessene mults.hacking am Ende der V1-Laeufe: " + endMults.map((x) => x.key + " " + x.m.toFixed(2) + " (" + x.augs + " Augs)").join(", "));
  // Dieselben Endstaende (exp, mults.hacking) nach BN15 versetzt: HLM 0,6
  console.log("\nV1-Endstaende nach BN15 versetzt (gleiche exp und mults.hacking, HLM 0,6; Ziel 6000):");
  for (const [bn, lauf, an] of eich) {
    if (bn === 2) continue;
    const r = pick(bn, lauf, an); if (!r) continue;
    const p = player(r.f);
    console.log("   BN" + bn + "L" + lauf + ": Stufe dort " + p.skills.hacking + " -> in BN15 " + calculateSkill(p.exp.hacking, p.mults.hacking * 0.6));
  }
  // Schwelle: welches mults.hacking braucht 6000 in BN15 binnen X h bei der besten Rate x 0,6?
  for (const h of [1, 5, 24]) {
    const eMax = rMax * 0.6 * h * 3600;
    let lo = 1, hi = 50;
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (calculateExp(6000, mid * 0.6) <= eMax) hi = mid; else lo = mid; }
    console.log("   BN15 6000 binnen " + h + " h bei " + fmt(rMax * 0.6, 2) + " exp/s braucht mults.hacking >= " + hi.toFixed(2));
  }
}

// ---------------------------------------------------------------------------
if (which === "C" || which === "alle") {
  console.log("\n=== C) BN15 V2 aus gemessenen Rangkurven (Rohrang-Verschiebung) ===");
  const { get } = loadBnMults();
  const rows = indexRows();
  const runs = new Map();
  for (const r of rows) {
    const key = "BN" + r.bn + "L" + r.lauf;
    if (![4, 9, 10, 6, 7].includes(r.bn)) continue;
    if (!runs.has(key)) runs.set(key, []);
    try { const z = zeile(r.f); if (z.maxRank != null) runs.get(key).push(z); } catch { /* defekt */ }
  }
  const BBR15 = get(15, 1).BladeburnerRank, SC15 = get(15, 1).BladeburnerSkillCost, LM15 = get(15, 1).StrengthLevelMultiplier;
  console.log("BN15: BladeburnerRank " + BBR15 + ", SkillCost " + SC15 + ", Kampf-LM " + LM15 + "; Rohrang-Bedarf 400.000 / " + BBR15 + " = " + (4e5 / BBR15).toExponential(2));
  console.log("Lauf    | BBR  SC   LM   | t(Rang 400k) | Abheben (Rang>=10k) -> Ende | Rate Abheben | Rate letzter Abschnitt | Zusatz-h BN15 (Abheb./letzt.) | Skillstufen-Faktor | Kampf-Faktor");
  for (const [key, zs] of runs) {
    zs.sort((a, b) => a.t_h - b.t_h);
    const bn = zs[0].bn; const lvl = Math.min((zs[0].sf[bn] || 0) + 1, 3);
    const m = get(bn, lvl);
    const bbr = m.BladeburnerRank, sc = m.BladeburnerSkillCost, lm = m.StrengthLevelMultiplier;
    const last = zs[zs.length - 1];
    // t bei Rang 400k (log-interpoliert zwischen den einschliessenden Staenden)
    let t400 = null;
    for (let i = 1; i < zs.length; i++) {
      const a = zs[i - 1], b = zs[i];
      if (a.maxRank < 4e5 && b.maxRank >= 4e5 && a.maxRank > 0) {
        t400 = a.t_h + (b.t_h - a.t_h) * Math.log(4e5 / a.maxRank) / Math.log(b.maxRank / a.maxRank);
      }
    }
    const ab = zs.find((z) => z.maxRank >= 1e4);
    // letzter Abschnitt mit Rangzuwachs (vor einem Einbau, der den Rang nicht aendert)
    let segRate = null;
    for (let i = zs.length - 1; i > 0; i--) {
      const a = zs[i - 1], b = zs[i];
      if (b.maxRank > a.maxRank && b.t_h > a.t_h + 0.05) { segRate = (b.maxRank - a.maxRank) / (b.t_h - a.t_h); break; }
    }
    if (!ab || last.maxRank < 1e5) { console.log(key.padEnd(7) + " | unvollstaendig (max " + Math.round(last.maxRank) + " bei " + last.t_h.toFixed(1) + " h)"); continue; }
    const abRate = (last.maxRank - ab.maxRank) / (last.t_h - ab.t_h);
    // Rang im Referenzknoten, der Rohrang 2 Mio entspricht
    const rEq = (4e5 / BBR15) * bbr;
    const extraAb = (rEq - 4e5) / abRate, extraSeg = segRate ? (rEq - 4e5) / segRate : NaN;
    const skillF = Math.sqrt(sc / SC15); // Stufen ~ sqrt(SP/SC) bei linearem costInc (Skill.ts:70-80), gleicher Rang
    const kampfF = LM15 / lm;            // Stufe linear im LevelMultiplier (skill.ts:13)
    console.log(key.padEnd(7) + " | " + bbr.toFixed(2) + " " + sc.toFixed(1) + "  " + lm.toFixed(2) + " | "
      + (t400 ? t400.toFixed(1) + " h" : "(Ende " + last.t_h.toFixed(1) + " h, max " + Math.round(last.maxRank) + ")").padEnd(12) + " | "
      + (ab.t_h.toFixed(1) + " -> " + last.t_h.toFixed(1) + " h").padEnd(27) + " | " + (abRate / 1e3).toFixed(1).padStart(6) + "k/h"
      + "     | " + (segRate ? (segRate / 1e3).toFixed(1) + "k/h" : "-").padStart(10) + "             | "
      + (extraAb.toFixed(1) + " / " + extraSeg.toFixed(1)).padStart(12) + "                | " + skillF.toFixed(2).padStart(6)
      + "             | " + kampfF.toFixed(2));
  }
  console.log("Lesart: Zusatz-h = Zeit, die der Referenzlauf mit seiner gemessenen Rate fuer den Rohrang");
  console.log("zwischen 400k/BBR_ref und 2 Mio gebraucht haette. Untere Schranke fuer den BN15-Aufschlag,");
  console.log("weil die Rate in BN15 durch weniger Skillstufen (Faktor oben) niedriger liegt; der hoehere");
  console.log("Kampf-LM (0,7 statt 0,4/0,45) gleicht einen Teil davon wieder aus.");
}

// ---------------------------------------------------------------------------
if (which === "D" || which === "alle") {
  console.log("\n=== D) BN8 je Einbauzyklus (4S-API vorhanden, frischer Markt, " + SEEDS + " Seeds) ===");
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  const targets = [26e9, 100e9, 1e12, 5e12];
  const strategien = [
    ["boerse.js-Regel 4S", () => makeBotStrategy({ fourS: true, buy4S: false })],
    ["opt 4S Long+Short e=0,05", () => makeOptStrategy({ entry: 0.05, shorts: true })],
  ];
  for (const start of [250e6, 39e6]) {
    for (const [lab, mk] of strategien) {
      const hits = targets.map(() => []);
      for (let s = 1; s <= SEEDS; s++) {
        const got = targets.map(() => null);
        run({ seed: 3000 + s, cash: start, ticks: 30 * 600, strategy: mk(), sampleEvery: 600, onTick: (m, acc, t) => {
          if (t % 30) return;
          const w = acc.wealth(m);
          targets.forEach((x, i) => { if (got[i] === null && w >= x) got[i] = t / 600; });
        } });
        got.forEach((g, i) => hits[i].push(g === null ? Infinity : g));
      }
      console.log(("Start " + (start / 1e6).toFixed(0) + " Mio, " + lab).padEnd(42) + " h bis "
        + targets.map((x, i) => (x / 1e9) + " Mrd: " + med(hits[i]).toFixed(1)).join("  "));
    }
  }
}
