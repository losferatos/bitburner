// Kaufplan-Rechnung V1b BN15: erreicht der Bot Hacking 6.000 (3.000 x WorldDaemonDifficulty 2)
// bei HackingLevelMultiplier 0,6, und wann? Fortsetzung von rechnung.mjs (gleicher Ordner).
// Formeln aus bitburner-src 3.0.2 nachgebaut, geeicht gegen Spielstaende aus backups/.
//   node nodes/labyrinth-machbarkeit-2026-10/kaufplan.mjs
// Liest nur. Schreibt nichts.
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";

const ROOT = "C:/Users/erche/Desktop/claude_projecto/bitburner";
const REF = ROOT + "/reference/bitburner-src/src";
const BACKUPS = ROOT + "/backups";
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const fx = (x, d = 2) => x.toExponential(d);
const fh = (h) => (Number.isFinite(h) ? h.toFixed(1) + " h" : "kein Abschluss in 400 h");

// ---------------------------------------------------------------------------
// 0. Konstanten und Knoten-Multiplikatoren aus dem Quellcode lesen (nicht abschreiben)
// ---------------------------------------------------------------------------
const constTs = fs.readFileSync(REF + "/Constants.ts", "utf8");
const C = (k) => Number(constTs.match(new RegExp(k + ":\\s*([\\d.e]+)"))[1]);
const MULTI_AUG = C("MultipleAugMultiplier"); // 1.9
const NFG_LVL = C("NeuroFluxGovernorLevelMult"); // 1.14
const DONATE_DIV = C("DonateMoneyToRepDivisor"); // 1e6
const helpers = fs.readFileSync(REF + "/Augmentation/AugmentationHelpers.ts", "utf8");
const SF11_DISCOUNT = JSON.parse(helpers.match(/MultipleAugMultiplier \* (\[[\d., ]+\])\[Player\.activeSourceFileLvl\(11\)\]/)[1]);

function readBitNodeMults() {
  const t = fs.readFileSync(REF + "/BitNode/BitNode.tsx", "utf8");
  const out = {};
  const re = /case (\d+): \{([\s\S]*?)\n    \}/g;
  let m;
  while ((m = re.exec(t))) {
    const body = m[2];
    const get = (k) => { const x = body.match(new RegExp("\\b" + k + ":\\s*([\\d.]+)")); return x ? Number(x[1]) : 1; };
    out[m[1]] = Object.fromEntries(["AugmentationMoneyCost", "AugmentationRepCost", "HackingLevelMultiplier",
      "HackingSpeedMultiplier", "ServerMaxMoney", "ScriptHackMoney", "HackExpGain", "WorldDaemonDifficulty",
      "FactionWorkRepGain"].map((k) => [k, get(k)]));
  }
  return out;
}
const BNM = readBitNodeMults();
// BN12 ist stufenabhaengig (BitNode.tsx case 12: inc = 1.02^lvl, dec = 1/inc)
function bnMults(bn, lvl) {
  if (bn !== 12) return BNM[bn];
  const inc = 1.02 ** lvl, dec = 1 / inc;
  return { AugmentationMoneyCost: inc, AugmentationRepCost: inc, HackingLevelMultiplier: dec, HackingSpeedMultiplier: 1,
    ServerMaxMoney: dec * dec, ScriptHackMoney: dec, HackExpGain: dec, WorldDaemonDifficulty: inc, FactionWorkRepGain: dec };
}

// ---------------------------------------------------------------------------
// 1. Formeln (Nachbau)
// ---------------------------------------------------------------------------
const augs = JSON.parse(fs.readFileSync(path.join(here, "augs-3.0.2.json"), "utf8"));
const byName = Object.fromEntries(Object.values(augs).map((a) => [a.name, a]));
const NFG = "NeuroFlux Governor";
const SOA = new Set(Object.values(augs).filter((a) => a.factions.includes("Shadows of Anarchy")).map((a) => a.name));
const nfgMultHack = byName[NFG].mults.hacking; // 1.01 + donationBonus

// AugmentationHelpers.ts:29-37 und 129-160
const chainBase = (sf11) => MULTI_AUG * SF11_DISCOUNT[Math.min(sf11, 3)];
function augPrice(name, queuedNonSoA, nfgLevel, am, sf11) {
  const g = chainBase(sf11) ** queuedNonSoA;
  if (name === NFG) return byName[NFG].moneyCost * NFG_LVL ** nfgLevel * am * g;
  return byName[name].moneyCost * g * am;
}
// Ruf fuer NFG-Stufe L (Kaufbedingung, wird nicht verbraucht, faellt beim Einbau weg) und Spende dafuer
const nfgRep = (L, arc) => byName[NFG].repCost * NFG_LVL ** L * arc;
const donation = (rep, frep, fwr) => (rep * DONATE_DIV) / frep / fwr; // Faction/formulas/donation.ts:12-14
// skill.ts:7-15
const calcSkill = (exp, mult) => Math.max(1, Math.floor(mult * (32 * Math.log(exp + 534.6) - 200)));
const expFor = (level, mult) => Math.max(0, Math.exp((level / mult + 200) / 32) - 534.6);
// applySourceFile.ts: SF1 16/8/4 %, SF5 8/4/2 % auf mults.hacking; applyExploits.ts: 1.001 je Exploit
const sfHack = (sf) => {
  const s = (lvl, b) => { let m = 0; for (let i = 0; i < lvl; i++) m += b / 2 ** i; return 1 + m / 100; };
  return s(sf[1] || 0, 16) * s(sf[5] || 0, 8);
};

// ---------------------------------------------------------------------------
// 2. Spielstaende laden
// ---------------------------------------------------------------------------
function load(f) {
  const s = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(BACKUPS, f))).toString()).data;
  return JSON.parse(s.PlayerSave).data;
}
const saveFiles = fs.readdirSync(BACKUPS).filter((f) => /_BN\d+L\d_.*(pre-install|pre-jump)\.json\.gz$/.test(f)).sort();
const saves = saveFiles.map((f) => {
  const [, bn, lvl] = f.match(/_BN(\d+)L(\d)_/);
  return { f, bn: +bn, lvl: +lvl, ts: f.split("_")[3], pd: load(f) };
});
const nfgOf = (list) => (list.find((a) => a.name === NFG) || { level: 0 }).level;

// ---------------------------------------------------------------------------
// 3. Eichung A: Preiskette (x1,9 je Kauf, NFG x1,14 je Stufe, AugMoney des Knotens)
//    unabhaengiger Wert: moneySourceA.augmentations (vom Spiel verbuchte Ausgaben seit dem letzten Einbau)
// ---------------------------------------------------------------------------
console.log("== A. Eichung Preiskette gegen moneySourceA.augmentations (AugmentationHelpers.ts:29-160) ==");
let nA = 0, okA = 0, worstA = 0, maxQ = 0;
for (const s of saves) {
  const q = s.pd.queuedAugmentations;
  if (!q.length) continue;
  const sf11 = (s.pd.sourceFiles.data.find((x) => x[0] === 11) || [0, 0])[1];
  const am = bnMults(s.bn, s.lvl).AugmentationMoneyCost;
  let qi = 0, L = nfgOf(s.pd.augmentations), sum = 0;
  for (const e of q) {
    sum += augPrice(e.name, qi, L, am, sf11);
    if (e.name === NFG) L++;
    if (!SOA.has(e.name)) qi++;
  }
  const real = -s.pd.moneySourceA.data.augmentations;
  const rel = Math.abs(sum / real - 1);
  nA++; if (rel < 1e-9) okA++; worstA = Math.max(worstA, rel); maxQ = Math.max(maxQ, q.length);
}
console.log(`   ${okA}/${nA} Spielstaende exakt (rel. < 1e-9), groesste Abweichung ${worstA.toExponential(1)}, laengste Kette ${maxQ} Kaeufe`);
console.log(`   Kettenbasis ohne SF11 ${MULTI_AUG}; mit SF11.3 ${chainBase(3).toFixed(3)} (Rabatt ${SF11_DISCOUNT.join("/")}, nur Quelle - kein Spielstand mit SF11)`);

// ---------------------------------------------------------------------------
// 4. Eichung B: Hacking-Mult = SF-Basis x Augs x NFG^L x 1.001^Exploits
// ---------------------------------------------------------------------------
console.log("\n== B. Eichung Hacking-Mult gegen pd.mults.hacking (pre-jump, V1-Laeufe) ==");
function hackMultModel(pd) {
  const sf = Object.fromEntries(pd.sourceFiles.data);
  let p = sfHack(sf) * 1.001 ** (pd.exploits?.length || 0);
  for (const a of pd.augmentations) {
    if (a.name === NFG) continue;
    p *= byName[a.name]?.mults.hacking || 1;
  }
  return p * nfgMultHack ** nfgOf(pd.augmentations);
}
let worstB = 0;
for (const s of saves.filter((x) => /pre-install|pre-jump/.test(x.f) && [1, 5, 12].includes(x.bn))) {
  worstB = Math.max(worstB, Math.abs(hackMultModel(s.pd) / s.pd.mults.hacking - 1));
}
console.log(`   ${saves.filter((x) => [1, 5, 12].includes(x.bn)).length} Spielstaende BN1/5/12, groesste rel. Abweichung ${worstB.toExponential(1)}`);

// ---------------------------------------------------------------------------
// 5. Was der Bot in V1-Laeufen tat: Zyklen, Einkommen, EXP
// ---------------------------------------------------------------------------
const V1 = ["BN1.2", "BN1.3", "BN5.2", "BN5.3", "BN12.1", "BN12.2", "BN12.3"];
const runs = {};
for (const s of saves) {
  const k = "BN" + s.bn + "." + s.lvl;
  if (!V1.includes(k)) continue;
  const pd = s.pd, A = pd.moneySourceA.data;
  (runs[k] ??= []).push({
    ts: s.ts, tA: pd.playtimeSinceLastAug / 3.6e6, tB: pd.playtimeSinceLastBitnode / 3.6e6,
    gross: A.total - A.augmentations, money: pd.money, hM: pd.mults.hacking, hxM: pd.mults.hacking_exp,
    exp: pd.exp.hacking, lvl: pd.skills.hacking, frep: pd.mults.faction_rep, nfg: nfgOf(pd.augmentations),
    inst: pd.augmentations.map((a) => a.name), bn: s.bn, slvl: s.lvl,
  });
}
// Online-Stunden laut AUDIT-ROADMAP-PRUEFUNG-2026-10.md Abschnitt 4.1
const ONLINE = { "BN1.2": 13.1, "BN1.3": 12.7, "BN5.2": 19.9, "BN5.3": 29.6, "BN12.1": 40.2, "BN12.2": 21.8, "BN12.3": 24.1 };

console.log("\n== C. V1-Laeufe: Endstand und Zeit bis zur Geldexplosion ==");
console.log("   Lauf    Knoten-h online-h  End-Mult  NFG  Zeit bis Mult>=4,4 (Knoten-h)  Einkommen letzter langer Zyklus");
const pts = []; // (Level am Zyklusende, Brutto/h) fuer Zyklen >= 0,4 h
const expPts = []; // (Mult, EXP/h)
for (const k of V1) {
  const r = runs[k]; if (!r) continue;
  const end = r[r.length - 1];
  const first = r.find((x) => x.hM >= 4.4);
  const long = [...r].reverse().find((x) => x.tA >= 0.4);
  for (const x of r) {
    if (x.tA >= 0.4 && x.gross > 0) pts.push([x.lvl / bnMults(x.bn, x.slvl).HackingLevelMultiplier * bnMults(x.bn, x.slvl).HackingLevelMultiplier, x.gross / x.tA, k]);
    if (x.tA >= 0.25) expPts.push([x.hM, x.exp / x.tA, k]);
  }
  console.log(`   ${k.padEnd(7)} ${end.tB.toFixed(1).padStart(7)} ${String(ONLINE[k]).padStart(8)} ${end.hM.toFixed(2).padStart(9)} ${String(end.nfg).padStart(4)}  ${(first ? first.tB - first.tA : NaN).toFixed(1).padStart(10)}                   ${fx(long.gross / long.tA, 1)}/h bei Level ${long.lvl}`);
}

// Einkommenskurve r(Level): isotone Regression (PAV) auf log10(Brutto/h) - monoton steigend im Level
function isotonic(xy) {
  const s = [...xy].sort((a, b) => a[0] - b[0]);
  const blocks = s.map(([x, y]) => ({ x0: x, x1: x, y, n: 1 }));
  for (let i = 0; i < blocks.length - 1;) {
    if (blocks[i].y > blocks[i + 1].y) {
      const a = blocks[i], b = blocks[i + 1];
      blocks.splice(i, 2, { x0: a.x0, x1: b.x1, y: (a.y * a.n + b.y * b.n) / (a.n + b.n), n: a.n + b.n });
      if (i > 0) i--;
    } else i++;
  }
  return blocks.map((b) => [(b.x0 + b.x1) / 2, b.y]);
}
const curve = isotonic(pts.map(([l, r]) => [l, Math.log10(r)]));
function r12(level) { // Brutto/h eines voll laufenden Zyklus bei diesem Hacking-Level (Bot-Generation BN1-12)
  if (level <= curve[0][0]) return 10 ** curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    if (level <= curve[i][0]) {
      const [x0, y0] = curve[i - 1], [x1, y1] = curve[i];
      return 10 ** (y0 + ((y1 - y0) * (level - x0)) / (x1 - x0));
    }
  }
  return 10 ** curve[curve.length - 1][1];
}
console.log(`\n   Einkommenskurve aus ${pts.length} Zyklen >= 0,4 h (isoton in log10): ` + curve.map(([l, y]) => `L${Math.round(l)}:${(10 ** y).toExponential(0)}`).join(" "));

// EXP-Rate seit Einbau (EXP/h) gegen den Hacking-Mult: isoton in log10, ausserhalb des Messbereichs flach
const ecurve = isotonic(expPts.map(([m, e]) => [m, Math.log10(e)]));
function e12(M) {
  if (M <= ecurve[0][0]) return 10 ** ecurve[0][1];
  for (let i = 1; i < ecurve.length; i++) {
    if (M <= ecurve[i][0]) {
      const [x0, y0] = ecurve[i - 1], [x1, y1] = ecurve[i];
      return 10 ** (y0 + ((y1 - y0) * (M - x0)) / (x1 - x0));
    }
  }
  return 10 ** ecurve[ecurve.length - 1][1];
}
console.log(`   EXP-Kurve aus ${expPts.length} Zyklen >= 0,25 h (isoton): ` + ecurve.map(([m, y]) => `M${m.toFixed(1)}:${(10 ** y).toExponential(0)}`).join(" "));

// ---------------------------------------------------------------------------
// 6. Kaufliste: was der Bot in BN12.2 tatsaechlich eingebaut hat, in Einbau-Reihenfolge
// ---------------------------------------------------------------------------
const order = [];
for (const x of runs["BN12.2"]) for (const n of x.inst) if (n !== NFG && !order.includes(n)) order.push(n);
const lastPd = saves.filter((s) => s.bn === 12 && s.lvl === 2).pop().pd;
for (const a of lastPd.queuedAugmentations) if (a.name !== NFG && !order.includes(a.name)) order.push(a.name);
const hackProd = order.reduce((p, n) => p * (byName[n]?.mults.hacking || 1), 1);
console.log(`\n== D. Kaufliste = BN12.2-Einbauten (${order.length} Augs ohne NFG, Hacking-Produkt x${hackProd.toFixed(2)}, Listenpreis-Summe ${fx(order.reduce((a, n) => a + byName[n].moneyCost, 0))}) ==`);

// ---------------------------------------------------------------------------
// 7. Simulation: Einbau-Zyklen fester Laenge T, gierig kaufen (Liste, dann NFG), Mult -> Level -> Einkommen
// ---------------------------------------------------------------------------
// Parameter je Knoten:
//   am, sf11, lm (HackingLevelMultiplier), f (Geldfaktor gegen die Kurve), k (EXP-Faktor), wall (Level),
//   nfg0 (geschenkte NFG-Stufen aus SF12), base (SF-Hacking-Basis x Exploits), dead (h ohne Einkommen je Zyklus)
function simulate(p, T) {
  let t = 0, L = p.nfg0, bought = 0, best = { t: Infinity };
  const inst = [];
  for (let cyc = 0; cyc < 400 && t < 400; cyc++) {
    const M = p.base * inst.reduce((a, n) => a * (byName[n].mults.hacking || 1), 1) * nfgMultHack ** L;
    // Abschluss jetzt: nur noch EXP farmen bis zur Wand
    const eRate = e12(M) * p.k;
    const need = expFor(p.wall, M * p.lm);
    const finish = t + need / eRate;
    if (finish < best.t) best = { t: finish, M, L, cyc, farm: need / eRate, items: inst.length };
    if (need / eRate < 0.05) break; // Wand faellt sofort - weiter kaufen bringt nichts
    // Zyklus: Einkommen bei Level zur Zyklusmitte
    const lvlMid = calcSkill(eRate * T / 2, M * p.lm);
    const money = r12(lvlMid / p.lmRef) * p.f * Math.max(0, T - p.dead);
    // Kaufen: naechste Listen-Augs (absteigend teuer, so viele wie bezahlbar), dann NFG
    let cash = money, qi = 0;
    for (let k = order.length - bought; k > 0; k--) {
      const next = order.slice(bought, bought + k).map((n) => byName[n].moneyCost).sort((a, b) => b - a);
      const cost = next.reduce((a, c, i) => a + c * p.am * chainBase(p.sf11) ** i, 0);
      if (cost <= cash) { cash -= cost; qi = k; inst.push(...order.slice(bought, bought + k)); bought += k; break; }
    }
    let Lc = L;
    for (;;) {
      const c = augPrice(NFG, qi, Lc, p.am, p.sf11) + 0; // Ruf per Spende: Zuwachs gegen die hoechste Stufe
      const don = donation(nfgRep(Lc + 1, p.arc), p.frep, p.fwr) - (Lc > L ? donation(nfgRep(Lc, p.arc), p.frep, p.fwr) : 0);
      if (c + don > cash) break;
      cash -= c + don; qi++; Lc++;
    }
    L = Lc;
    t += T;
  }
  if (best.t > 400) best.t = Infinity; // kommt in 400 h nicht an der Wand an
  return best;
}
function bestOverT(p) {
  let b = { t: Infinity };
  for (const T of [0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12]) {
    const r = simulate(p, T);
    if (r.t < b.t) b = { ...r, T };
  }
  return b;
}

// 7a. Rueckrechnung der V1-Laeufe (f = 1): reine Geldzeit gegen die echte Laufzeit -> Rest = Nicht-Geld-Anteil
console.log("\n== E. Rueckrechnung V1-Laeufe: Modell-Geldzeit bis zur Wand des jeweiligen Knotens gegen echte Laufzeit ==");
const overhead = [];
for (const k of ["BN1.2", "BN1.3", "BN12.1", "BN12.2", "BN12.3"]) {
  const r = runs[k], [bn, lvl] = k.slice(2).split(".").map(Number), m = bnMults(bn, lvl);
  const pd0 = saves.find((s) => s.bn === bn && s.lvl === lvl).pd;
  const sf = Object.fromEntries(pd0.sourceFiles.data);
  const p = { am: m.AugmentationMoneyCost, arc: m.AugmentationRepCost, sf11: 0, lm: m.HackingLevelMultiplier, lmRef: 1,
    f: 1, k: 1, wall: 3000 * m.WorldDaemonDifficulty, nfg0: (sf[12] || 0), base: sfHack(sf) * 1.001 ** (pd0.exploits?.length || 0),
    dead: 0.2, frep: 2.5, fwr: m.FactionWorkRepGain };
  const s = bestOverT(p);
  const real = ONLINE[k];
  overhead.push(real - s.t);
  console.log(`   ${k.padEnd(7)} Wand ${p.wall.toFixed(0).padStart(5)}: Modell ${s.t.toFixed(1).padStart(5)} h (Zyklus ${s.T} h, Ende Mult ${s.M.toFixed(1)}, NFG ${s.L}), echt online ${real} h, Rest ${(real - s.t).toFixed(1)} h`);
}
const ohLo = Math.min(...overhead), ohHi = Math.max(...overhead);
console.log(`   -> Nicht-Geld-Anteil (Ruf, Einladungen, Daedalus-Schwelle, Leerlauf) ${ohLo.toFixed(1)}-${ohHi.toFixed(1)} h je Lauf`);

// 7b. BN15
const m15 = bnMults(15, 1);
const SF_BN15 = { 1: 3, 5: 3, 12: 3, 11: 3 }; // route.json: BN1/5/12/11 je x3 vor BN15
const base15 = sfHack(SF_BN15) * 1.001 ** (lastPd.exploits?.length || 0);
const wall15 = 3000 * m15.WorldDaemonDifficulty;
// Geldfaktor gegen die Kurve (Kurve ist ueber das Level schon level-bereinigt):
//   ServerMaxMoney 0,8 statt ~0,92-1 (BN12/BN1) und HackingSpeed 0,6: zeitgebunden x0,6, RAM-/Takt-gebunden x1
const fLo = m15.ServerMaxMoney / 0.96 * m15.HackingSpeedMultiplier, fHi = m15.ServerMaxMoney / 0.96;
// EXP: HackingSpeed 0,6 bremst die Operationen; HackExpGain 1 (BN12 ~0,96)
const kLo = m15.HackingSpeedMultiplier * 0.7, kHi = m15.HackingSpeedMultiplier * m15.HackExpGain;
console.log(`\n== F. BN15: Wand ${wall15} bei Level-Mult ${m15.HackingLevelMultiplier}, AugMoney ${m15.AugmentationMoneyCost}, Kettenbasis ${chainBase(3).toFixed(3)} (SF11.3), Start-Mult ${base15.toFixed(3)} + ${SF_BN15[12]} NFG ==`);
console.log(`   Geldfaktor f ${fLo.toFixed(2)}-${fHi.toFixed(2)}, EXP-Faktor ${kLo.toFixed(2)}-${kHi.toFixed(2)}, Einkommenskurve x0,5-x2`);
const res = [];
for (const [fl, f] of [["f tief", fLo], ["f hoch", fHi]]) {
  for (const [kl, k] of [["EXP tief", kLo], ["EXP hoch", kHi]]) {
    for (const cs of [0.5, 1, 2]) {
      for (const sf11 of [3, 0]) {
        const p = { am: m15.AugmentationMoneyCost, arc: m15.AugmentationRepCost, sf11, lm: m15.HackingLevelMultiplier, lmRef: 1,
          f: f * cs, k, wall: wall15, nfg0: SF_BN15[12], base: base15, dead: 0.2 / m15.HackingSpeedMultiplier, frep: 2.5, fwr: m15.FactionWorkRepGain };
        const s = bestOverT(p);
        res.push({ fl, kl, cs, sf11, ...s });
      }
    }
  }
}
for (const r of res.filter((x) => x.sf11 === 3)) {
  console.log(`   ${r.fl}, ${r.kl}, Kurve x${r.cs}: Geldzeit ${fh(r.t).padStart(7)}` + (Number.isFinite(r.t) ? ` (Zyklus ${r.T} h, ${r.cyc} Einbauten, End-Mult ${r.M.toFixed(1)}, NFG ${r.L}, davon EXP-Farm ${r.farm.toFixed(1)} h)` : ""));
}
const t3 = res.filter((x) => x.sf11 === 3).map((x) => x.t), t0 = res.filter((x) => x.sf11 === 0).map((x) => x.t);
const gLo = Math.min(...t3), gHi = Math.max(...t3), gMid = t3.sort((a, b) => a - b)[Math.floor(t3.length / 2)];
const nInf = t3.filter((x) => !Number.isFinite(x)).length, gHiF = Math.max(...t3.filter(Number.isFinite));
console.log(`   Geldzeit BN15 mit SF11.3: ${gLo.toFixed(1)}-${gHiF.toFixed(1)} h, Median ${gMid.toFixed(1)} h, ${nInf} von ${t3.length} Ecken ohne Abschluss; ohne SF11-Rabatt kuerzeste ${Math.min(...t0).toFixed(1)} h, Median ${t0.sort((a, b) => a - b)[Math.floor(t0.length / 2)].toFixed(1)} h`);

// Vergleich gleiche Annahmen in BN12.2: wie viel teurer ist BN15 rein rechnerisch?
{
  const m = bnMults(12, 2);
  const p = { am: m.AugmentationMoneyCost, arc: m.AugmentationRepCost, sf11: 0, lm: m.HackingLevelMultiplier, lmRef: 1, f: 1, k: 1,
    wall: wall15, nfg0: 1, base: base15, dead: 0.2, frep: 2.5, fwr: m.FactionWorkRepGain };
  const s = bestOverT(p);
  console.log(`   Gegenprobe: BN12.2-Bedingungen mit BN15-Wand 6.000 bei Level-Mult 0,96 -> ${s.t.toFixed(1)} h (Mult ${s.M.toFixed(1)})`);
}

// ---------------------------------------------------------------------------
// 8. Gesamtband V1b je Lauf
// ---------------------------------------------------------------------------
// Nicht-Geld-Anteil: aus 7a; in BN15 Ruf aus Hacking-Arbeit ~Level (x0,6/0,96) -> Faktor 1,0-1,6
const ohRepLo = 1.0, ohRepHi = 0.96 / m15.HackingLevelMultiplier;
const darkLo = 1.8, darkHi = 10.8; // LABYRINTH-MACHBARKEIT-2026-10.md Abschnitt 5 (ungeeicht)
const lo = gLo + ohLo * ohRepLo; // Rest darf negativ sein (Modell zu langsam, BN1); Darknet parallel (beste Annahme)
const hi = gHiF + ohHi * ohRepHi + darkHi; // Darknet seriell (schlechteste Annahme); Ecken ohne Abschluss nicht enthalten
const mid = gMid + ((ohLo + ohHi) / 2) * ((ohRepLo + ohRepHi) / 2) + (darkLo + darkHi) / 2;
console.log(`\n== G. V1b je BN15-Lauf: Geldzeit + Nicht-Geld-Anteil x${ohRepLo}-${ohRepHi.toFixed(1)} + Darknet ${darkLo}-${darkHi} h ==`);
console.log(`   Band ${lo.toFixed(0)}-${hi.toFixed(0)} h (ohne ${nInf} Ecken ohne Abschluss), Mitte ${mid.toFixed(0)} h; V2 105-178 h (AUDIT-ROADMAP-PRUEFUNG-2026-10.md 4.2)`);
console.log(`   Schwelle "klar schneller" < 60 h: ${hi < 60 ? "ganzes Band darunter" : mid < 60 ? "Mitte darunter, Obergrenze nicht" : "nicht erreicht"}`);

// ---------------------------------------------------------------------------
// 9. Kaufplan Endphase: was fehlt fuer Mult 15/16/17, und was kostet ein NFG-Zyklus in BN15 gegen BN12.2?
// ---------------------------------------------------------------------------
console.log("\n== H. Kaufplan Endphase (Kaufliste D komplett eingebaut, dann nur NFG) ==");
{
  const m12 = bnMults(12, 2);
  const withList = base15 * hackProd;
  console.log(`   Mult mit Kaufliste und 0 NFG: ${withList.toFixed(2)}; je NFG-Stufe x${nfgMultHack}`);
  for (const M of [15, 16, 17]) {
    const L = Math.ceil(Math.log(M / withList) / Math.log(nfgMultHack));
    const eNeed = expFor(wall15, M * m15.HackingLevelMultiplier);
    console.log(`   Mult ${M}: NFG-Stufe ${L}, dann ${fx(eNeed, 1)} Hacking-EXP nach dem letzten Einbau (${(eNeed / (e12(M) * kHi)).toFixed(1)}-${(eNeed / (e12(M) * kLo)).toFixed(1)} h Farm)`);
  }
  console.log("   Ein Zyklus, der 10 NFG-Stufen ab Stufe L kauft (Kette ab 0, plus Spende fuer den Ruf, frep 2,5):");
  for (const L0 of [60, 75, 85, 90]) {
    const cyc = (am, sf11, arc, fwr) => { let c = 0; for (let j = 0; j < 10; j++) c += augPrice(NFG, j, L0 + j, am, sf11); return c + donation(nfgRep(L0 + 10, arc), 2.5, fwr); };
    const c15 = cyc(m15.AugmentationMoneyCost, 3, m15.AugmentationRepCost, m15.FactionWorkRepGain);
    const c12 = cyc(m12.AugmentationMoneyCost, 0, m12.AugmentationRepCost, m12.FactionWorkRepGain);
    console.log(`     L${L0}: BN15 ${fx(c15)}  BN12.2 ${fx(c12)}  Verhaeltnis ${(c15 / c12).toFixed(2)}`);
  }
  // Geldexplosion der V1-Laeufe: Einkommen >= 1e14/h ab Level ~3.000, Saettigung ~1e15/h ab ~5.000
  for (const [lv, txt] of [[3000, ">= 1e14/h"], [5000, "~1e15/h"]]) {
    const mB = lv / (0.6 * (32 * Math.log(1e11) - 200)), m12e = lv / (0.98 * (32 * Math.log(1e11) - 200));
    console.log(`   Einkommen ${txt} ab Level ${lv}: bei 1e11 EXP braucht BN15 Mult ${mB.toFixed(1)}, BN12 Mult ${m12e.toFixed(1)}`);
  }
}
