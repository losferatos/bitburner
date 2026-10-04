// P2b: Gang-Strategie-Rechner (Audit 04.10.2026, BN2.1, Slum Snakes live).
//
// Baut die Gang-Dynamik aus der Spielquelle 3.0.2 nach und eicht sie an der ECHTEN Gang
// (Backups 01:17..07:17 + Live-Spielstand). Aufbauend auf gang-formulas.mjs (Einzelformeln,
// 86.360-fach gegen den Originalquelltext geprueft, gang-check.mjs).
//
// Quellen (reference/bitburner-src/src/Gang):
//   Gang.ts:99-169    process / processGains (Respekt, Wanted, Geld, Faktionsruf mit Favor)
//   Gang.ts:171-270   processTerritoryAndPowerGains (Macht der NPC-Gangs, Clashes, Territorium)
//   Gang.ts:281-303   clash (Tod nur bei Aufgabe "Territory Warfare")
//   Gang.ts:371-388   killMember (5 % Gesamtrespekt + eigener Respekt)
//   Gang.ts:390-416   ascendMember (zieht den verdienten Respekt des Mitglieds ab), getDiscount
//   GangMember.ts     calculateSkill, calculateExpGain, ascend (Ausruestung weg, Augs bleiben), buyUpgrade
//   Gang/data/*       Aufgaben, Ausruestung (upgrades.ts wird hier GEPARST, nicht abgetippt), Power-Faktoren
//   Faction/formulas/favor.ts + Faction.ts:77-86  Favor beim Einbau
//   Prestige.ts:130-143                           Aufstiegspunkte x0,95 beim Einbau
//
// Der Regler S0 ist der ECHTE Regler: src/gang.js wird gelesen, der Import-Kopf ersetzt und per
// data-URL geladen (planTasks, phaseOf, shouldAscend). Die lokale Nachbildung fuer die Varianten
// wird gegen die echte Funktion getestet (tools/audit/gang-p2b-calib.mjs, Abschnitt F: 0 Abweichungen).
// Die Torrunde ist ebenfalls der ECHTE Planer: waehleTorRunde aus src/lib/einbau.js (Gegenprobe gegen den
// Live-Plan des Bots in verify-p2b-gang.md: n, Kosten und Competence identisch).
//
// Aufruf: node tools/audit/gang-p2b-sim.mjs <befehl> [--snap datei.json] [--blade datei.json] [...]
//   scen    Strategien (--strats S0,S1,S3,...) ueber 24 h: Tor 1 und Tor 2, Black-Op-Chancen (G noetig)
//   round   Torrunden-Planer ueber Budgets, Planer-Gewichte und Rufdeckel R
//   grid    Reglerwerte (--base S1|S3, --tu 300,..., --pairs 1.3/2,...)
//   war     Territoriumsphase (S2) per Monte Carlo (--n 16 --k 12,6 --engage 0.5 --target 0.3 --base S1|S3)
//   Eichung: node tools/audit/gang-p2b-calib.mjs (--livefile / --log).
//   Schnappschuss: node tools/audit/gang-p2b-live.mjs --out datei.json (Live ueber die Bruecke oder --file backup).
//   Ohne --snap/--blade wird live ueber die Bruecke gelesen (getSaveFile / getFile, nur lesen).
//
// Zeit: alles in SPIELZEIT (Zyklen zu 200 ms); die Gang laeuft 1:1 mit der Wanduhr, solange das Spiel
// ungedrosselt tickt (gemessen, siehe Eichung E). Tor 1 = 12 h Spielzeit nach Ende des Wiederaufbaus
// (lib/endspurt.js KAMPF_EINBAU_MIN_MS), Tor 2 = Tor 1 + 12 h + Wiederaufbau.
//
// Nur lesen. Schreibt nichts ausser auf stdout (und mit --json ein JSON).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as F from "./gang-formulas.mjs";
import { parseAugs, exactGangOffer } from "./gang-augs.mjs";
import { waehleTorRunde, bladeEffFactors, effectiveLevels, gatePriceStep, gateMultsProduct } from "../../src/lib/einbau.js";
import { COMBAT_AUGS } from "../../src/lib/hackaugs.js";
import { snapshot, loadLive } from "./gang-p2b-live.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const SRC = path.join(ROOT, "reference", "bitburner-src", "src");

// ============================================================================
// 0. KONSTANTEN
// ============================================================================
export const STEP_CYCLES = 10;                 // Gang.process arbeitet in Bloecken >= 10 Zyklen (Constants.ts:29)
export const STEP_S = STEP_CYCLES * 0.2;       // 2 s Spielzeit je Block
export const TICKS_PER_H = 3600 / STEP_S;      // 1800
const NAMES = ["Slum Snakes", "Tetrads", "The Syndicate", "The Dark Army", "Speakers for the Dead", "NiteSec", "The Black Hand"]; // Constants.ts:18-26
const POWER_MULT = { "Slum Snakes": 1, "Tetrads": 2, "The Syndicate": 2, "The Dark Army": 2, "Speakers for the Dead": 5, "NiteSec": 2, "The Black Hand": 5 }; // power.ts
const MAX_FAVOR = 35331;                        // favor.ts:8
const LOG1P02 = 0.019802627296179712;           // favor.ts:10
export const favorToRep = (f) => Math.max(0, 25000 * Math.expm1(LOG1P02 * f));
export const repToFavor = (r) => Math.min(MAX_FAVOR, Math.max(0, Math.log1p(r / 25000) / LOG1P02));

// ============================================================================
// 1. DER ECHTE REGLER (src/gang.js per data-URL)
// ============================================================================
let REAL = null;
export async function loadRealController() {
  if (REAL) return REAL;
  const text = fs.readFileSync(path.join(ROOT, "src", "gang.js"), "utf8");
  const head = /^import \{ liesVonHome, haengeAnHome \} from "lib\/hostdatei\.js";\s*$/m;
  if (!head.test(text)) throw new Error("gang.js: Import-Kopf nicht gefunden - Loader anpassen");
  const patched = text.replace(head, "const liesVonHome = () => null; const haengeAnHome = () => true;");
  REAL = await import("data:text/javascript;base64," + Buffer.from(patched, "utf8").toString("base64"));
  return REAL;
}

// ============================================================================
// 2. AUSRUESTUNG (upgrades.ts geparst)
// ============================================================================
export function parseUpgrades() {
  const t = fs.readFileSync(path.join(SRC, "Gang", "data", "upgrades.ts"), "utf8");
  const out = [];
  const re = /\{\s*cost:\s*([0-9.e+]+),\s*mults:\s*\{([^}]*)\},\s*name:\s*"([^"]+)",\s*upgType:\s*UpgradeType\.(\w+),?\s*\}/g;
  let m;
  while ((m = re.exec(t))) {
    const mults = {};
    for (const mm of m[2].matchAll(/(\w+):\s*([0-9.]+)/g)) mults[mm[1]] = Number(mm[2]);
    out.push({ name: m[3], cost: Number(m[1]), mults, type: m[4] });
  }
  return out;
}
export const UPGRADES = parseUpgrades();
const UPG_BY_NAME = Object.fromEntries(UPGRADES.map((u) => [u.name, u]));

// ============================================================================
// 3. WELT AUS EINEM SCHNAPPSCHUSS (gang-p2b-live.mjs)
// ============================================================================
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeWorld(snap, o = {}) {
  const gm = snap.gang;
  const members = snap.members.map((sm) => ({
    name: sm.name, task: sm.task, earnedRespect: sm.earnedRespect,
    lvl: { ...sm.lvl }, exp: { ...sm.exp }, mult: { ...sm.mult }, ascPoints: { ...sm.ascPoints },
    upgrades: [...(sm.upgrades || [])], augs: [...(sm.augmentations || [])],
  }));
  const all = {};
  const src = snap.allGangs || {};
  for (const n of NAMES) all[n] = { power: (src[n] && src[n].power) || 1, territory: src[n] ? src[n].territory : 1 / 7 };
  const w = {
    snapPlaytime: snap.totalPlaytime, tTicks: 0,
    respect: gm.respect, wanted: gm.wanted, members, warfare: !!gm.territoryWarfareEngaged,
    clashChance: gm.territoryClashChance || 0, tpCycles: gm.storedTerritoryAndPowerCycles || 0,
    all, fac: "Slum Snakes",
    rep: snap.slumSnakes ? snap.slumSnakes.playerReputation : 0,
    favor: snap.slumSnakes ? (snap.slumSnakes.favor ?? 0) : 0,
    frm: snap.factionRepMult, softcap: 1,
    cash: o.cash0 ?? snap.money ?? 0, gangMoney: 0, spent: 0,
    rng: mulberry32(o.seed ?? 1), simTerritory: !!o.simTerritory,
    ascensions: 0, deaths: 0, recruits: 0, deathLog: [], twSet: new Set(),
    botPerH: o.botPerH ?? 0, repHit: {}, tag: {},
  };
  return w;
}

export const clone = (x) => JSON.parse(JSON.stringify(x));

// ============================================================================
// 4. MOTOR
// ============================================================================
const TERROR = F.TASKS["Terrorism"], TRAIN = F.TASKS["Train Combat"], TW = F.TASKS["Territory Warfare"];
const COMBAT_TASKS = F.tasksFor(false);
const MONEY_TASKS = COMBAT_TASKS.filter((t) => t.baseMoney > 0);

const taskOf = (m) => F.TASKS[m.task] || F.TASKS["Unassigned"];
export const gangView = (w) => ({ respect: w.respect, wantedLevel: w.wanted, territory: w.all[w.fac].territory });

function processGains(w, cycles) {
  const g = gangView(w);
  let moneyPC = 0, wantedPC = 0, respTot = 0, justice = 0;
  for (const m of w.members) {
    const t = taskOf(m);
    const er = F.respectGain(g, m.lvl, t, w.softcap) * cycles; // GangMember.earnRespect
    m.earnedRespect += er; respTot += er;
    moneyPC += F.moneyGain(g, m.lvl, t, w.softcap);
    wantedPC += F.wantedGain(g, m.lvl, t);
    if (t.baseWanted < 0) justice++;
  }
  w.lastRespPC = respTot / cycles; w.lastMoneyPC = moneyPC; w.lastWantedPC = wantedPC;
  w.respect += respTot;
  // Gang.ts:154-155: Spieler-faction_rep x Respekt x (1 + favor/100) / 75 (favor VOR dem Einbau-Update)
  w.rep += (w.frm * respTot * (1 + w.favor / 100)) / F.GC.GangRespectToReputationRatio;
  if (w.wanted !== 1 || wantedPC >= 0) {              // Gang.ts:157-167
    const old = w.wanted;
    w.wanted = (old + wantedPC * cycles) * (1 - justice * 0.001);
    if (w.wanted < 1 || (wantedPC <= 0 && w.wanted > old)) w.wanted = 1;
  }
  const mg = moneyPC * cycles;
  w.gangMoney += mg; w.cash += mg;
}

function processExperience(w, cycles) {
  for (const m of w.members) {
    const ge = F.expGain(m, taskOf(m), cycles);
    if (ge) for (const s of F.STATS) m.exp[s] += ge[s];
    F.updateSkills(m);
  }
}

const calcPower = (w) => {
  let tot = 0;
  for (const m of w.members) if (m.task === "Territory Warfare") tot += (m.lvl.hack + m.lvl.str + m.lvl.def + m.lvl.dex + m.lvl.agi + m.lvl.cha) / 95;
  return 0.015 * Math.max(0.002, w.all[w.fac].territory) * tot;       // Gang.ts:362-369
};

export function killMember(w, m) {
  const lost = 0.05 * w.respect + m.earnedRespect;                      // Gang.ts:371-388
  w.respect = Math.max(1, w.respect - lost);
  const i = w.members.indexOf(m);
  if (i >= 0) w.members.splice(i, 1);
  w.deaths++; w.deathLog.push({ tH: w.tTicks / TICKS_PER_H, name: m.name, lost });
  w.twSet.delete(m.name);
}

function clash(w, won) {                                                // Gang.ts:281-303
  let base = 0.01;
  if (won) base /= 2; else w.all[w.fac].power *= 1 / 1.008;
  if (w.rng() < 0.65) return;
  for (let i = w.members.length - 1; i >= 0; --i) {
    const m = w.members[i];
    if (m.task !== "Territory Warfare") continue;
    if (w.rng() < base / Math.pow(m.lvl.def, 0.6)) killMember(w, m);
  }
}

function territoryAndPower(w, cycles) {                                 // Gang.ts:173-270
  w.tpCycles += cycles;
  if (w.tpCycles < 100) return;
  w.tpCycles -= 100;
  const me = w.fac, all = w.all;
  const terrGain = (win, lose) => {
    const pb = Math.max(1, 1 + Math.log(all[win].power / all[lose].power) / Math.log(50));
    return Math.min(all[lose].territory, pb * 0.0001 * (w.rng() + 0.5));
  };
  for (const name of NAMES) {
    if (name === me) all[name].power += calcPower(w);
    else {
      const roll = w.rng();
      if (roll < 0.5) all[name].power += Math.min(0.85, all[name].power * 0.005);
      else all[name].power += 0.75 * roll * all[name].territory * POWER_MULT[name];
    }
  }
  if (w.warfare) w.clashChance = 1;
  else if (w.clashChance > 0) w.clashChance = Math.max(0, w.clashChance - 0.01);
  const gangs = NAMES.filter((g) => all[g].territory > 0 || g === me);
  if (gangs.length > 1) {
    for (let i = 0; i < gangs.length; ++i) {
      const others = gangs.filter((e) => e !== gangs[i]);
      const other = Math.floor(w.rng() * others.length);
      const a = gangs[i], b = others[other];
      if (a === me || b === me) { if (!(w.rng() < w.clashChance)) continue; }
      if (w.rng() < all[a].power / (all[a].power + all[b].power)) {
        if (all[b].territory <= 0) return;
        const tg = terrGain(a, b);
        all[a].territory += tg; all[b].territory -= tg;
        if (a === me) { clash(w, true); all[b].power *= 1 / 1.01; }
        else if (b === me) clash(w, false);
        else all[b].power *= 1 / 1.01;
      } else {
        if (all[a].territory <= 0) return;
        const tg = terrGain(b, a);
        all[a].territory -= tg; all[b].territory += tg;
        if (a === me) clash(w, false);
        else if (b === me) { clash(w, true); all[a].power *= 1 / 1.01; }
        else all[a].power *= 1 / 1.01;
      }
      const total = NAMES.reduce((p, n) => p + all[n].territory, 0);
      for (const n of NAMES) all[n].territory /= total;
    }
  }
}

export function winChanceMin(w) {
  let mn = 1;
  for (const n of NAMES) {
    if (n === w.fac || w.all[n].territory <= 0) continue;
    mn = Math.min(mn, w.all[w.fac].power / (w.all[w.fac].power + w.all[n].power));
  }
  return mn;
}

export function tick(w, ctrl) {
  if (ctrl) ctrl.decide(w);
  processGains(w, STEP_CYCLES);
  processExperience(w, STEP_CYCLES);
  if (w.simTerritory) territoryAndPower(w, STEP_CYCLES);
  w.tTicks++;
}

// Gang-Aktionen ---------------------------------------------------------------
export const discountOf = (w) => F.discount(w.respect, w.all[w.fac].power);
export function recruitThreshold(w) { return F.respectForNextRecruit(w.members.length); }
function freeName(w) {
  const t = new Set(w.members.map((m) => m.name));
  for (let i = 1; i <= 24; i++) { const n = "G" + String(i).padStart(2, "0"); if (!t.has(n)) return n; }
  return "X" + w.members.length;
}
export function recruit(w) {
  while (w.members.length < F.GC.MaximumGangMembers && w.respect >= recruitThreshold(w)) {
    const m = F.newMember(freeName(w));
    m.upgrades = []; m.augs = [];
    w.members.push(m); w.recruits++;
  }
}
function recomputeMult(m) {
  for (const s of F.STATS) m.mult[s] = 1;
  for (const n of m.augs) for (const [k, v] of Object.entries(UPG_BY_NAME[n].mults)) m.mult[k] *= v;
}
export function ascendMember(w, m) {
  for (const s of F.STATS) m.ascPoints[s] += F.ascPointsGain(m.exp[s]);
  m.upgrades = [];                       // GangMember.ts:308-319: Ausruestung weg, Augmentierungen bleiben
  recomputeMult(m);
  for (const s of F.STATS) m.exp[s] = 0;
  F.updateSkills(m);
  const res = m.earnedRespect;
  m.earnedRespect = 0;
  w.respect = Math.max(1, w.respect - res);   // Gang.ts:392-393
  w.ascensions++;
}
export const canAscend = (m) => F.STATS.some((s) => m.exp[s] > 1000);
export function buyUpgrade(w, m, upg) {
  const cost = upg.cost / discountOf(w);
  if (w.cash < cost) return false;
  if (m.augs.includes(upg.name) || m.upgrades.includes(upg.name)) return false;
  w.cash -= cost; w.spent += cost;
  (upg.type === "Augmentation" ? m.augs : m.upgrades).push(upg.name);
  for (const [k, v] of Object.entries(upg.mults)) m.mult[k] *= v;
  F.updateSkills(m);
  return true;
}
export function applyInstall(w) {                                       // Prestige.ts:129-143 + Faction.ts:77-86
  w.favor = repToFavor(favorToRep(w.favor) + w.rep);
  w.rep = 0;
  for (const m of w.members) { for (const s of F.STATS) m.ascPoints[s] *= F.GC.InstallAscensionPenalty; F.updateSkills(m); }
}

// ============================================================================
// 5. REGLER
// ============================================================================
// cfg: impl 'real'|'local', trainUntil, ascTrain, ascWork, wantedFloor,
//      workMode 'respect'|'switch'|'money', repTarget, equip, war, trainSet
export const BASE_CFG = { impl: "real", trainUntil: 500, ascTrain: 1.3, ascWork: 2, wantedFloor: 0.95,
  workMode: "respect", repTarget: 1.66e6, equip: null, war: null };

const wl = (task, lvl) => F.STATS.reduce((a, s) => a + (task.w[s] / 100) * (lvl[s] || 0), 0);
const phaseLocal = (lvl, trainUntil, basis = TERROR) => (wl(basis, lvl) >= trainUntil ? "work" : "train");

function ascensionFactorLocal(res, basis = TERROR) {            // gang.js ascensionFactor: gewichtetes geom. Mittel ueber die Gewichte der Basisaufgabe (gebaut: Terrorism)
  let ls = 0, ws = 0;
  for (const s of F.STATS) { const wgt = basis.w[s]; if (!(wgt > 0)) continue; ls += wgt * Math.log(res[s]); ws += wgt; }
  return Math.exp(ls / ws);
}

export function bestMoneyTask(g, lvl, softcap = 1) {
  let best = null, bv = 0;
  for (const t of MONEY_TASKS) { const v = F.moneyGain(g, lvl, t, softcap); if (v > bv) { bv = v; best = t; } }
  return best || TRAIN;
}

const TRAINS = [F.TASKS["Train Combat"], F.TASKS["Train Hacking"], F.TASKS["Train Charisma"]];
const contLevel = (exp, mult) => mult * (32 * Math.log(exp + 534.5) - 200);
// Training mit dem groessten Zuwachs an gewichteter Stufe der Basisaufgabe ueber einen Horizont (wie die erste Sim)
export function trainTaskAdaptive(m, basis, horizonCycles = 9000) {
  let best = TRAIN, bd = -1;
  for (const t of TRAINS) {
    const ge = F.expGain(m, t, horizonCycles);
    let d = 0;
    for (const s of F.STATS) {
      if (!basis.w[s]) continue;
      const mu = m.mult[s] * F.ascMult(m.ascPoints[s]);
      d += (basis.w[s] / 100) * (contLevel(m.exp[s] + ge[s], mu) - contLevel(m.exp[s], mu));
    }
    if (d > bd) { bd = d; best = t; }
  }
  return best;
}

function workTaskFor(w, cfg, g, m) {
  const target = cfg.repTargetFn ? cfg.repTargetFn(w) : cfg.repTarget;
  const money = cfg.workMode === "money" || (cfg.workMode === "switch" && w.rep >= target);
  return money ? bestMoneyTask(g, m.lvl, w.softcap) : TERROR;
}

// lokale Nachbildung von gang.js planTasks (+ Geldmodus). members: {name, lvl, ascended}
export function planLocal(w, cfg, g, mem) {
  const assign = {};
  const wt = {};
  const full = cfg.trainBasis === "adaptive" ? Object.fromEntries(w.members.map((x) => [x.name, x])) : null;
  for (const m of mem) {
    const t = workTaskFor(w, cfg, g, m);
    const basis = cfg.ascBasis === "task" ? t : TERROR;
    const phase = m.ascended ? "train" : phaseLocal(m.lvl, cfg.trainUntil, basis);
    wt[m.name] = t;
    assign[m.name] = phase === "train" ? (full ? trainTaskAdaptive(full[m.name], basis).name : TRAIN.name) : t.name;
  }
  if (g.wantedLevel > 1 && g.wantedPenalty < cfg.wantedFloor) {
    const working = mem.filter((m) => assign[m.name] === wt[m.name].name && wt[m.name] !== TRAIN);
    const vig = F.TASKS["Vigilante Justice"];
    let wsum = 0;
    for (const m of working) wsum += F.wantedGain(g, m.lvl, wt[m.name]);
    working.sort((a, b) => {
      const d = F.respectGain(g, a.lvl, wt[a.name]) - F.respectGain(g, b.lvl, wt[b.name]);
      return d !== 0 ? d : (a.name < b.name ? -1 : 1);
    });
    for (const m of working) {
      if (!(wsum > 0)) break;
      wsum -= F.wantedGain(g, m.lvl, wt[m.name]);
      wsum += F.wantedGain(g, m.lvl, vig);
      assign[m.name] = vig.name;
    }
  }
  return assign;
}

const memView = (w) => w.members.map((m) => ({ name: m.name, task: m.task, lvl: { ...m.lvl }, ascended: false }));

// Wert einer Ausruestung fuer ein Mitglied auf seiner aktuellen Geldaufgabe: Geld je Stunde
function upgradeBenefitPerH(w, g, m, upg) {
  const t = taskOf(m);
  if (!(t.baseMoney > 0)) return 0;
  const before = F.moneyGain(g, m.lvl, t, w.softcap);
  const lvl2 = { ...m.lvl };
  for (const s of F.STATS) {
    const f = upg.mults[s];
    if (f) lvl2[s] = F.calculateSkill(m.exp[s], m.mult[s] * f * F.ascMult(m.ascPoints[s]));
  }
  const after = F.moneyGain(g, lvl2, t, w.softcap);
  return (after - before) * 5 * 3600;                 // 5 Zyklen/s
}

function equipRound(w, cfg) {
  const eq = cfg.equip;
  const g = gangView(w);
  const remainH = Math.max(0, (eq.horizonH ?? 24) - w.tTicks / TICKS_PER_H);
  for (let guard = 0; guard < 400; guard++) {
    let best = null;
    for (const m of w.members) {
      if (!(taskOf(m).baseMoney > 0)) continue;
      for (const u of UPGRADES) {
        if (!eq.types.includes(u.type)) continue;
        if (m.augs.includes(u.name) || m.upgrades.includes(u.name)) continue;
        const cost = u.cost / discountOf(w);
        const hold = Math.min(remainH, u.type === "Augmentation" ? (eq.augHoldH ?? remainH) : (eq.holdH ?? 3));
        const ben = upgradeBenefitPerH(w, g, m, u) * hold;
        const ratio = ben / cost;
        if (ratio > (eq.minRatio ?? 1.5) && (!best || ratio > best.ratio)) best = { m, u, ratio, cost };
      }
    }
    if (!best || w.cash < best.cost) break;
    if (w.cash - best.cost < (eq.keepCash ?? 0)) break;
    buyUpgrade(w, best.m, best.u);
  }
}

function warRound(w, cfg) {
  const wr = cfg.war;
  const tH = w.tTicks / TICKS_PER_H;
  const active = tH >= (wr.startH ?? 0) && tH < (wr.stopH ?? 1e9) && w.all[w.fac].territory < (wr.target ?? 1);
  if (!active) {
    if (w.warfare) w.warfare = false;
    w.twSet.clear();
    return;
  }
  // die k staerksten ausgebildeten Mitglieder bilden die Kriegsabteilung
  const ready = w.members.filter((m) => wl(TERROR, m.lvl) >= (wr.minLevel ?? 300))
    .sort((a, b) => (b.lvl.str + b.lvl.def + b.lvl.dex + b.lvl.agi) - (a.lvl.str + a.lvl.def + a.lvl.dex + a.lvl.agi));
  const pick = new Set(ready.slice(0, wr.k).map((m) => m.name));
  w.twSet = pick;
  const wc = winChanceMin(w);
  if (!w.warfare && wc >= wr.engageAt) w.warfare = true;
  else if (w.warfare && wc < (wr.disengageAt ?? wr.engageAt - 0.1)) w.warfare = false;
}

export function makeController(cfg0, real) {
  const cfg = { ...BASE_CFG, ...cfg0 };
  return {
    cfg,
    decide(w) {
      recruit(w);
      // Aufstieg (gang.js:manageGang) - Phase aus den Stufen VOR dem Aufstieg
      const ascended = new Set();
      const gStart = gangView(w);
      for (const m of w.members) {
        if (!canAscend(m)) continue;
        const basis = cfg.ascBasis === "task" ? workTaskFor(w, cfg, gStart, m) : TERROR;
        const phase = cfg.impl === "real" ? (real.phaseOf(m.lvl)) : phaseLocal(m.lvl, cfg.trainUntil, basis);
        const res = F.ascensionResult(m);
        const ok = cfg.impl === "real"
          ? real.shouldAscend(phase, res)
          : ascensionFactorLocal(res, basis) >= (phase === "train" ? cfg.ascTrain : cfg.ascWork);
        if (!ok) continue;
        ascendMember(w, m); ascended.add(m.name);
      }
      if (cfg.war) warRound(w, cfg);
      const g0 = gangView(w);
      const g = { ...g0, wantedPenalty: w.respect / (w.respect + w.wanted) };
      const mem = memView(w).map((x) => ({ ...x, ascended: ascended.has(x.name) }));
      let assign;
      if (cfg.impl === "real" && cfg.workMode === "respect" && !cfg.war) assign = real.planTasks(g, mem).assign;
      else assign = planLocal(w, cfg, g, mem);
      for (const m of w.members) {
        let t = assign[m.name];
        if (cfg.war && w.twSet.has(m.name) && !ascended.has(m.name)) t = "Territory Warfare";
        m.task = t;
      }
      if (cfg.equip && w.tTicks % 15 === 0) equipRound(w, cfg);
    },
  };
}

// ============================================================================
// 6. TORRUNDE
// ============================================================================
let AUGS = null;
const OFFER_CACHE = {};
const TARGET_CACHE = new Map();
function augDb() { return AUGS || (AUGS = Object.fromEntries(parseAugs().map((a) => [a.name, a]))); }

// Kandidaten der Gang-Faktion (BN2: GangUniqueAugs 1 -> alles Nicht-Spezielle) ohne Besitz.
export function gangCandidates(ownedSet, rep, o = {}) {
  const db = augDb();
  const priceMult = o.priceMult ?? 1;   // AugmentationMoneyCost des Knotens (BN2: 1)
  const repMult = o.repMult ?? 1;       // AugmentationRepCost (BN2: 1)
  const okey = (o.bitNode ?? 2) + "." + (o.sfLevel ?? 0);
  const offer = OFFER_CACHE[okey] || (OFFER_CACHE[okey] = exactGangOffer(o.bitNode ?? 2, o.sfLevel ?? 0, 1));
  const out = [];
  for (const n of offer) {
    if (ownedSet.has(n) || !COMBAT_AUGS[n] || n === "The Red Pill") continue;
    const a = db[n];
    if (!a) continue;
    out.push({ aug: n, faktion: "Slum Snakes", rep, repReq: a.repCost * repMult, preis: a.moneyCost * priceMult,
      prereq: a.prereqs || [], mults: COMBAT_AUGS[n] });
  }
  return out;
}

let BLACKOPS = null;
export function opWeights(name = "OperationRedDragon") {
  if (!BLACKOPS) BLACKOPS = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "lib", "blackops.json"), "utf8"));
  return BLACKOPS.ops.find((o) => o.name === name);
}

export function torRound(budget, rep, ownedSet, skills, o = {}) {
  const bo = opWeights(o.op ?? "OperationRedDragon");
  const eff = bladeEffFactors(o.reaper ?? 51, o.evasive ?? 52);
  const cands = gangCandidates(ownedSet, rep, o);
  const plan = waehleTorRunde(cands, budget, ownedSet, {
    skills: effectiveLevels(skills, eff), weights: bo.weights, decays: bo.decays, startMults: {}, priceStep: gatePriceStep(o.sf11 ?? 0),
  });
  const db = augDb();
  return { ...plan, maxRep: Math.max(0, ...plan.seq.map((n) => db[n].repCost)), candidatesAll: cands.length };
}

// Faktoren einer Menge von Augs auf die Spielerstufen (Stufe = floor(mult*f(exp)), Erfahrung gleich)
export function applyAugMults(skills, seq) {
  const out = { ...skills };
  const map = { hacking: "hacking", strength: "strength", defense: "defense", dexterity: "dexterity", agility: "agility" };
  for (const n of seq) for (const [k, key] of Object.entries(map)) { const f = COMBAT_AUGS[n] && COMBAT_AUGS[n][k]; if (f) out[key] *= f; }
  return out;
}

// ============================================================================
// 6b. BLACK-OP-CHANCEN (der eigentliche Engpass: Action.ts:157-195, chance = min(1, Competence / Schwierigkeit))
// ============================================================================
// Unterhalb der Kappung ist die Chance LINEAR in jedem Faktor von Competence. Eine Runde aendert nur
// Stufen (Spielerstufe = floor(mult*f(exp)), Erfahrung gleich -> Stufe * Aug-Faktor) und den
// Erfolgschance-Faktor; alles andere (Chaos, Bevoelkerung, Ausdauer, Intelligenz) kuerzt sich im Verhaeltnis.
const normOp = (s) => String(s).replace(/[^A-Za-z0-9]/g, "").toLowerCase();
const OP_KEYS = ["hacking", "strength", "defense", "dexterity", "agility"];
export function opRatios(skills, seq, o = {}) {
  if (!BLACKOPS) opWeights();
  const eff = bladeEffFactors(o.reaper ?? 51, o.evasive ?? 52);
  const lv = effectiveLevels(skills, eff);
  const extra = gateMultsProduct(seq.map((n) => COMBAT_AUGS[n]).filter(Boolean));
  const out = {};
  for (const op of BLACKOPS.ops) {
    let c0 = 0, c1 = 0;
    for (const s of Object.keys(op.weights)) {
      const wgt = op.weights[s];
      if (!(wgt > 0)) continue;
      const d = op.decays[s] ?? 1;
      const L = Number(lv[s]) || 0;
      c0 += wgt * Math.pow(L, d);
      c1 += wgt * Math.pow(L * (OP_KEYS.includes(s) ? (extra[s] || 1) : 1), d);
    }
    out[normOp(op.name)] = (c1 / c0) * (extra.bladeburner_success_chance || 1);
  }
  return out;
}

// Zustand der noch offenen Black Ops nach einer Menge gekaufter Stuecke und einem Wachstumsfaktor G
// aus anderen Quellen (Erfahrung, Faehigkeiten): chance = min(1, chance_jetzt * Verhaeltnis * G).
export function opStatus(blade, skills, seq, G = 1, o = {}) {
  const ratios = opRatios(skills, seq, o);
  const thr = blade.boSchwelle ?? 0.9;
  const rows = Object.entries(blade.boChancen || {}).map(([name, c0]) => {
    const r = ratios[normOp(name)] ?? 1;
    return { name, c0, ratio: r, chance: Math.min(1, c0 * r * G), gNeed: thr / (c0 * r) };
  });
  const gNeed = Math.max(0, ...rows.map((x) => x.gNeed));
  const cleared = rows.filter((x) => x.chance >= thr).length;
  const blocked = rows.filter((x) => x.chance < thr)[0] || null;
  return { rows, gNeed, cleared, total: rows.length, blocked };
}

// ============================================================================
// 7. LAUF
// ============================================================================
// Zeit in Stunden ab Schnappschuss. Bot-Einkommen (botPerH) ist EXOGEN und fuer alle Strategien gleich.
// opt: hours, gateH (Liste), botPerH, sample (h), skills, owned (Set), torOpts, noTor, seed,
//      frmInstall (Faktor auf faction_rep je Einbau, gemessen 1,3820/1,3683), real, repTargetFn
export const FRM_INSTALL = 1.3819935450829346 / 1.3683068912068113; // Spielstaende 07:05 -> 07:17 (NeuroFlux-Stufen im Einbau)

// R = hoechster Rufbedarf der noch nicht besessenen Kampfstuecke, die der Planer realistisch kauft
// (ohne Teile ueber 100 Mrd Grundpreis, z. B. Hydroflame Left Arm 2,5 Bio), mal 1,02 Reserve.
export function targetRep(owned, o = {}) {
  const key = [...owned].sort().join("|") + JSON.stringify(o);
  if (TARGET_CACHE.has(key)) return TARGET_CACHE.get(key);
  const c = gangCandidates(owned, Infinity, o).filter((k) => k.preis <= 100e9 && k.repReq > 0);
  const r = 1.02 * Math.max(0, ...c.map((k) => k.repReq));
  TARGET_CACHE.set(key, r);
  return r;
}

export function run(snap, cfg, opt = {}) {
  const w = makeWorld(snap, { seed: opt.seed ?? 1, cash0: opt.cash0, simTerritory: !!cfg.war || opt.simTerritory });
  const owned = new Set(opt.owned || []);
  w.owned = owned;
  const ctrl = makeController({ ...cfg, repTargetFn: cfg.repTargetFn ?? (cfg.workMode === "switch" && cfg.repTarget === undefined ? (ww) => targetRep(ww.owned, opt.torOpts || {}) : undefined) }, opt.real);
  const hours = opt.hours ?? 24;
  const steps = Math.round(hours * TICKS_PER_H);
  const gates = [...(opt.gateH || [])];
  const botPerS = (opt.botPerH ?? 0) / 3600;
  const series = [], gateRec = [], cycleHits = [];
  let skills = { ...(opt.skills || {}) };
  const sampleEvery = Math.max(1, Math.round((opt.sample ?? 0.5) * TICKS_PER_H));
  const levels = [7.5e5, 1.25e6, 1.625e6];
  let hit = {}, cycleStartH = 0, moneyStartH = null, minPen = 1, maxWanted = 0;
  const frmInst = opt.frmInstall ?? FRM_INSTALL;
  for (let i = 0; i < steps; i++) {
    const tH = i / TICKS_PER_H;
    if (gates.length && tH >= gates[0]) {
      const gh = gates.shift();
      const rec = { gateH: gh, tH, rep: w.rep, favorBefore: w.favor, respect: w.respect, wanted: w.wanted,
        cash: w.cash, gangMoney: w.gangMoney, spent: w.spent, members: w.members.length,
        ascensions: w.ascensions, deaths: w.deaths, territory: w.all[w.fac].territory, power: w.all[w.fac].power,
        moneyStartH, hit: { ...hit }, cycleStartH, minPen, maxWanted };
      if (!opt.noTor) {
        const plan = torRound(w.cash, w.rep, owned, skills, opt.torOpts || {});
        rec.plan = { n: plan.seq.length, cost: plan.cost, gain: plan.gain, maxRep: plan.maxRep, seq: plan.seq };
        w.cash -= plan.cost;
        for (const n of plan.seq) owned.add(n);
        skills = applyAugMults(skills, plan.seq);
      }
      applyInstall(w);
      w.frm *= frmInst;
      rec.favorAfter = w.favor;
      gateRec.push(rec);
      cycleHits.push(hit); hit = {}; cycleStartH = tH; moneyStartH = null; minPen = 1; maxWanted = 0;
    }
    w.cash += botPerS * STEP_S;
    tick(w, ctrl);
    for (const L of levels) if (hit[L] === undefined && w.rep >= L) hit[L] = (i + 1) / TICKS_PER_H - cycleStartH;
    if (moneyStartH === null && w.members.some((m) => taskOf(m).baseMoney > 0)) moneyStartH = tH;
    const pen = w.respect / (w.respect + w.wanted);
    if (pen < minPen) minPen = pen;
    if (w.wanted > maxWanted) maxWanted = w.wanted;
    if (i % sampleEvery === 0 || i === steps - 1) {
      const avg = (s) => w.members.reduce((a, m) => a + m.lvl[s], 0) / Math.max(1, w.members.length);
      series.push({ h: +(i / TICKS_PER_H).toFixed(2), members: w.members.length, respect: w.respect, rep: w.rep, wanted: w.wanted,
        penalty: pen, gangMoney: w.gangMoney, cash: w.cash, spent: w.spent,
        moneyPerH: w.lastMoneyPC * 5 * 3600, respPerS: w.lastRespPC * 5,
        avgStr: avg("str"), avgHack: avg("hack"), avgCha: avg("cha"), asc: w.ascensions, deaths: w.deaths,
        terr: w.all[w.fac].territory, power: w.all[w.fac].power, favor: w.favor,
        tasks: w.members.reduce((o, m) => { o[m.task] = (o[m.task] || 0) + 1; return o; }, {}) });
    }
  }
  cycleHits.push(hit);
  return { w, series, gates: gateRec, cycleHits, cfg: ctrl.cfg, moneyStartH, minPen, maxWanted };
}

// ============================================================================
// 8. HILFEN FUER AUSGABE
// ============================================================================
export function loadSnap(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
export function fmt(n, d = 1) { return Number.isFinite(n) ? n.toLocaleString("de-DE", { maximumFractionDigits: d, minimumFractionDigits: d }) : String(n); }
export const pct = (a, b) => (b ? ((a / b - 1) * 100) : NaN);

// ============================================================================
// 9. SZENARIEN
// ============================================================================
export const GATE_FALLBACK_PT = 3976718800;   // fertig 3933518800 + 12 h (data/einbau-uhr.json, KAMPF_EINBAU_MIN_MS)
export const GATE_GAP_H = 12 + 486600 / 3.6e6; // Tor 2 = Einbau + Wiederaufbau (0,135 h gemessen) + 12 h
export const BOT_PER_H = 7.2e9;                // netto 07:17 06:17-Zyklus: (87,5 - 6,2) Mrd / 11,27 h (moneySourceA), exogen
const W_ALL = ["Weapon", "Armor", "Vehicle", "Rootkit"];

export const STRATS = {
  S0: { impl: "real", workMode: "respect", note: "gebaut: Terrorism/Vigilante, keine Ausruestung, kein Territorium" },
  S1: { impl: "local", workMode: "switch", note: "Terrorism bis Ruf-Ziel R (dynamisch), dann beste Geldaufgabe je Mitglied" },
  S1a: { impl: "local", workMode: "switch", repTarget: 7.65e5, note: "wie S1, R fix 750k (nur Stuecke bis 750k Ruf)" },
  S1b: { impl: "local", workMode: "switch", repTarget: 1.275e6, note: "wie S1, R fix 1,25 Mio" },
  S1m: { impl: "local", workMode: "money", note: "sofort alles Geld (nur zur Gegenprobe: R wird nur nebenbei erreicht)" },
  S3: { impl: "local", workMode: "switch", equip: { types: W_ALL, holdH: 3, minRatio: 1.5 }, note: "S1 + Ausruestung (Waffen/Ruestung/Fahrzeuge/Rootkits) mit Amortisationsregel" },
  S3g: { impl: "local", workMode: "switch", equip: { types: [...W_ALL, "Augmentation"], holdH: 3, minRatio: 1.5 }, note: "S3 + Mitglieder-Augmentierungen" },
};

export function gatePlaytime(args) {
  return Number(args.gatept) || GATE_FALLBACK_PT;
}

export async function loadBlade(args) {
  if (args.blade) return JSON.parse(fs.readFileSync(args.blade, "utf8"));
  const url = "http://localhost:8795/api/rpc?" + new URLSearchParams({ method: "getFile", instance: "LIVE", filename: "data/blade.json", server: "home" });
  const x = await (await fetch(url, { signal: AbortSignal.timeout(20000) })).json();
  return JSON.parse(x.result);
}

export function baseOpts(snap, args, real) {
  const gate1 = (gatePlaytime(args) - snap.totalPlaytime) / 3.6e6;
  const hours = Number(args.hours) || 24;
  return {
    hours, gateH: [gate1, gate1 + GATE_GAP_H], botPerH: Number(args.bot ?? BOT_PER_H), real,
    skills: snap.skills, owned: [...snap.augNames, ...snap.queuedNames], sample: 0.5,
    torOpts: { reaper: 51, evasive: 52 },
  };
}

export function summarize(r, opt = {}) {
  const g1 = r.gates[0], g2 = r.gates[1];
  let ops1 = null, ops2 = null;
  if (opt.blade && g1 && g1.plan) {
    const sk = opt.skills, to = opt.torOpts || {};
    ops1 = opStatus(opt.blade, sk, g1.plan.seq, 1, to);
    if (g2 && g2.plan) ops2 = opStatus(opt.blade, sk, [...g1.plan.seq, ...g2.plan.seq], 1, to);
  }
  const fin = r.series[r.series.length - 1];
  const hit1 = r.cycleHits[0] || {}, hit2 = r.cycleHits[1] || {};
  const moneyPhaseH = g1 && g1.moneyStartH !== null && g1.moneyStartH !== undefined ? g1.tH - g1.moneyStartH : 0;
  return {
    t_R_h: hit1[1625000], t_750k: hit1[750000], t_1250k: hit1[1250000], t_R2_h: hit2[1625000],
    gang_money_g1: g1 && g1.gangMoney, spent_g1: g1 && g1.spent, cash_g1: g1 && g1.cash,
    money_per_h: moneyPhaseH > 0 ? (g1.gangMoney - 0) / moneyPhaseH : 0, moneyPhaseH,
    rep_g1: g1 && g1.rep, favor_after_g1: g1 && g1.favorAfter, plan1: g1 && g1.plan,
    deaths_g1: g1 && g1.deaths, minPen_g1: g1 && g1.minPen,
    gang_money_g2: g2 && g2.gangMoney, cash_g2: g2 && g2.cash, plan2: g2 && g2.plan, rep_g2: g2 && g2.rep, deaths_g2: g2 && g2.deaths,
    asc_g1: g1 && g1.ascensions, asc_g2: g2 && g2.ascensions,
    gNeed1: ops1 && ops1.gNeed, gNeed2: ops2 && ops2.gNeed, ops1: ops1 && { cleared: ops1.cleared, total: ops1.total, blocked: ops1.blocked && ops1.blocked.name }, ops2: ops2 && { cleared: ops2.cleared, total: ops2.total, blocked: ops2.blocked && ops2.blocked.name },
    comp: (g1 && g1.plan ? g1.plan.gain : 1) * (g2 && g2.plan ? g2.plan.gain : 1),
    terr: fin && fin.terr, power: fin && fin.power, members_end: fin && fin.members, deaths_end: fin && fin.deaths, respect_end: fin && fin.respect,
  };
}

const M = (x, d = 1) => (x === undefined || x === null || !Number.isFinite(x) ? "-" : fmt(x / 1e9, d));
export function printSummary(label, s) {
  console.log(label.padEnd(5),
    "R", (s.t_R_h === undefined ? "-" : fmt(s.t_R_h, 2)).padStart(5), "h",
    "| GangGeld bis Tor1", M(s.gang_money_g1).padStart(6), "Mrd (Ausruestung", M(s.spent_g1, 2), ")",
    "| Geld/h Geldphase", M(s.money_per_h).padStart(5), "(", fmt(s.moneyPhaseH, 1), "h )",
    "| Kasse Tor1", M(s.cash_g1).padStart(6),
    "| Runde1 n", s.plan1 ? s.plan1.n : "-", "Kosten", s.plan1 ? M(s.plan1.cost) : "-", "Comp x" + (s.plan1 ? fmt(s.plan1.gain, 2) : "-"), "maxRep", s.plan1 ? fmt(s.plan1.maxRep / 1e3, 0) + "k" : "-",
    "| Tote", s.deaths_g1,
    "| minPen", fmt(s.minPen_g1, 4),
    "| Tor2 Kasse", M(s.cash_g2).padStart(6), "Runde2 n", s.plan2 ? s.plan2.n : "-", "Comp x" + (s.plan2 ? fmt(s.plan2.gain, 2) : "-"),
    "| kum. Comp x" + fmt(s.comp, 2),
    "| BlackOps G=1: Tor1", s.ops1 ? s.ops1.cleared + "/" + s.ops1.total : "-", "Tor2", s.ops2 ? s.ops2.cleared + "/" + s.ops2.total : "-", "| G noetig Tor1", s.gNeed1 === null || s.gNeed1 === undefined ? "-" : fmt(s.gNeed1, 2), "Tor2", s.gNeed2 === null || s.gNeed2 === undefined ? "-" : fmt(s.gNeed2, 2));
}

export async function cmdScen(args) {
  const snap = args.snap ? loadSnap(args.snap) : snapshot(await loadLive());
  if (!snap.wall) snap.wall = Date.now();
  const real = await loadRealController();
  const opt = baseOpts(snap, args, real);
  opt.blade = await loadBlade(args);
  console.log(`Schnappschuss pt ${snap.totalPlaytime} (${new Date(snap.wall).toLocaleString("de-DE")}), Tor1 in ${fmt(opt.gateH[0], 3)} h, Tor2 in ${fmt(opt.gateH[1], 3)} h, Bot ${fmt(opt.botPerH / 1e9, 1)} Mrd/h, Kasse jetzt ${M(snap.money, 2)} Mrd`);
  const want = (args.strats || "S0,S1,S3").split(",");
  const res = {};
  for (const k of want) {
    const r = run(snap, STRATS[k], opt);
    const s = summarize(r, opt);
    res[k] = s;
    printSummary(k, s);
  }
  if (args.json) fs.writeFileSync(args.json, JSON.stringify(res, null, 1));
}

// S4: Reglerwerte (Training, Aufstieg) und geldbewusste Regler
STRATS.S3s = { ...STRATS.S1, equip: { types: W_ALL, holdH: 99, minRatio: 0 }, note: "S1 + alles Kaufbare (w/a/v/r) ohne Amortisationsregel: einfache Regel fuer den Bau" };
STRATS.S4m = { ...STRATS.S1, ascBasis: "task", trainBasis: "adaptive", note: "S1 + Aufstieg/Training nach den Gewichten der Arbeitsaufgabe (Human Trafficking: hack/dex/cha) statt Terrorism/Train Combat" };
STRATS.S4m3 = { ...STRATS.S3, ascBasis: "task", trainBasis: "adaptive", note: "S3 + geldbewusster Regler" };
STRATS.S4a = { ...STRATS.S1, ascBasis: "task", note: "S1 + nur Aufstiegsfaktor nach Arbeitsaufgabe" };
STRATS.S4t = { ...STRATS.S1, trainBasis: "adaptive", note: "S1 + nur adaptives Training (Basis Terrorism)" };

export async function cmdGrid(args) {
  const snap = args.snap ? loadSnap(args.snap) : snapshot(await loadLive());
  const real = await loadRealController();
  const opt = baseOpts(snap, args, real);
  opt.blade = await loadBlade(args);
  const baseName = args.base || "S1";
  const base = STRATS[baseName];
  console.log(`Raster Regler-Werte auf Basis ${baseName} (${base.note}); Tor1 in ${fmt(opt.gateH[0], 2)} h`);
  console.log("trainUntil ascTrain ascWork | R(h) | GangGeld Tor1 Mrd | Geld/h | Kasse Tor1 | Comp1 | Aufst.(Tor1) | min Penalty | Tor2 Kasse | kum.Comp");
  const rows = [];
  const tus = (args.tu || "300,400,500,600,700").split(",").map(Number);
  const pairs = (args.pairs || "1.2/1.5,1.3/2,1.2/2,1.5/2.5,1.3/3,1.3/1.5").split(",").map((x) => x.split("/").map(Number));
  for (const tu of tus) for (const [at, aw] of pairs) {
    const r = run(snap, { ...base, trainUntil: tu, ascTrain: at, ascWork: aw }, opt);
    const s = summarize(r, opt);
    rows.push({ tu, at, aw, s });
    console.log(String(tu).padStart(10), String(at).padStart(8), String(aw).padStart(7), "|", (s.t_R_h === undefined ? "-" : fmt(s.t_R_h, 2)).padStart(5), "|", M(s.gang_money_g1).padStart(7),
      "|", M(s.money_per_h).padStart(5), "|", M(s.cash_g1).padStart(7), "|", s.plan1 ? fmt(s.plan1.gain, 2) : "-", "|", s.asc_g1, "|", fmt(s.minPen_g1, 4), "|", M(s.cash_g2).padStart(7), "|", fmt(s.comp, 2));
  }
  if (args.json) fs.writeFileSync(args.json, JSON.stringify(rows, null, 1));
}

// S2: Territoriumsphase per Monte Carlo
export async function cmdWar(args) {
  const snap = args.snap ? loadSnap(args.snap) : snapshot(await loadLive());
  const real = await loadRealController();
  const opt = baseOpts(snap, args, real);
  opt.blade = await loadBlade(args);
  const N = Number(args.n) || 12;
  const baseName = args.base || "S1";
  const base = STRATS[baseName];
  const r0 = summarize(run(snap, base, opt), opt);
  console.log(`Basis ${baseName} ohne Krieg: GangGeld Tor1 ${M(r0.gang_money_g1)} Mrd, Kasse Tor1 ${M(r0.cash_g1)}, Comp1 x${fmt(r0.plan1.gain, 2)}, Tor2 Kasse ${M(r0.cash_g2)}, kum. Comp x${fmt(r0.comp, 2)}`);
  console.log(`Monte Carlo N=${N} je Konfiguration (NPC-Zufall); Spalten: Median [P10..P90]`);
  const cfgs = [];
  const ks = (args.k || "4,8,12").split(",").map(Number);
  const eng = (args.engage || "0.5,0.6").split(",").map(Number);
  const tgt = Number(args.target || 0.3);
  const startH = Number(args.start || 1.2);
  const stopH = Number(args.stop || 9);
  for (const k of ks) for (const e of eng) cfgs.push({ k, engageAt: e });
  const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * (b.length - 1)))]; };
  const qs = (a, f = (x) => x, d = 1) => `${fmt(f(q(a, 0.5)), d)} [${fmt(f(q(a, 0.1)), d)}..${fmt(f(q(a, 0.9)), d)}]`;
  for (const c of cfgs) {
    const acc = { money: [], cash: [], terr: [], power: [], deaths: [], comp: [], terr24: [], warH: [], pen: [], g1: [], g2: [], deaths2: [] };
    for (let seed = 1; seed <= N; seed++) {
      const r = run(snap, { ...base, war: { startH, stopH, k: c.k, engageAt: c.engageAt, target: tgt, minLevel: 300 } }, { ...opt, seed });
      const s = summarize(r, opt);
      const g1 = r.gates[0];
      acc.money.push(s.gang_money_g1); acc.cash.push(s.cash_g1); acc.terr.push(g1.territory); acc.power.push(g1.power);
      acc.deaths.push(s.deaths_g1); acc.deaths2.push(s.deaths_g2); acc.g1.push(s.gNeed1); acc.g2.push(s.gNeed2); acc.comp.push(s.comp); acc.terr24.push(s.terr); acc.pen.push(s.minPen_g1);
    }
    console.log(`k=${String(c.k).padStart(2)} engage>=${c.engageAt} Start ${startH} h Stopp ${stopH} h Ziel ${tgt} | GangGeld Tor1 Mrd ${qs(acc.money, (x) => x / 1e9)} | Territorium Tor1 ${qs(acc.terr, (x) => x, 3)} | Macht ${qs(acc.power, (x) => x, 0)} | Tote bis Tor1 ${qs(acc.deaths, (x) => x, 1)} bis Tor2 ${qs(acc.deaths2, (x) => x, 1)} | G noetig Tor1 ${qs(acc.g1, (x) => x, 2)} | kum. Comp x${qs(acc.comp, (x) => x, 2)} | min Penalty ${qs(acc.pen, (x) => x, 3)}`);
  }
}

// Torrunde ueber Budgets und Rufdeckel: welches R, welche Competence, welche Black Ops am Tor 1
export async function cmdRound(args) {
  const snap = args.snap ? loadSnap(args.snap) : snapshot(await loadLive());
  const blade = await loadBlade(args);
  const owned = new Set([...snap.augNames, ...snap.queuedNames]);
  const sk = snap.skills;
  const to = { reaper: 51, evasive: 52 };
  console.log(`Kandidaten (Gang-Faktion, nicht besessen, mit Kampf-/Erfolgsfaktor): ${gangCandidates(owned, Infinity).length}; R(dyn.) = ${fmt(targetRep(owned), 0)}`);
  for (const op of ["OperationRedDragon", "OperationDaedalus"]) {
    console.log(`\n--- Planer-Gewichte ${op}; Rufdeckel unbegrenzt; G noetig = Wachstum aus anderen Quellen, das fuer ALLE offenen Black Ops (Chance >= ${blade.boSchwelle}) noch fehlt`);
    console.log("Budget Mrd | n | Kosten Mrd | Competence | maxRep | G noetig | Ops frei (G=1) | erste Sperre");
    for (const B of [10, 20, 50, 80, 100, 150, 200, 300, 400, 600, 800, 1200, 2000, 5000, 20000]) {
      const plan = torRound(B * 1e9, Infinity, owned, sk, { ...to, op });
      const st = opStatus(blade, sk, plan.seq, 1, to);
      console.log(String(B).padStart(10), "|", String(plan.seq.length).padStart(2), "|", fmt(plan.cost / 1e9, 1).padStart(9), "|", ("x" + fmt(plan.gain, 2)).padStart(9), "|", fmt(plan.maxRep / 1e3, 0).padStart(5) + "k", "|", fmt(st.gNeed, 2).padStart(5), "|", st.cleared + "/" + st.total, "|", st.blocked ? st.blocked.name + " " + fmt(st.blocked.chance, 2) : "-");
    }
  }
  console.log("\n--- Rufdeckel R bei festem Budget 400 Mrd (Planer RedDragon): wie viel Ruf braucht die Runde wirklich?");
  console.log("R (Ruf) | n | Kosten Mrd | Competence | G noetig");
  for (const R of [1e5, 3e5, 4.4e5, 5e5, 7.5e5, 8.75e5, 1.125e6, 1.25e6, 1.5e6, 1.625e6, 2.5e6]) {
    const plan = torRound(400e9, R, owned, sk, to);
    const st = opStatus(blade, sk, plan.seq, 1, to);
    console.log(fmt(R, 0).padStart(9), "|", String(plan.seq.length).padStart(2), "|", fmt(plan.cost / 1e9, 1).padStart(9), "|", ("x" + fmt(plan.gain, 2)).padStart(8), "|", fmt(st.gNeed, 2));
  }
  console.log("\nRufanforderungen der Stuecke (nicht besessen):");
  console.log(gangCandidates(owned, Infinity).sort((a, b) => a.repReq - b.repReq).map((c) => `${c.aug} ${fmt(c.repReq / 1e3, 1)}k/${fmt(c.preis / 1e9, 2)}Mrd`).join("; "));
}

// ============================================================================
// CLI
// ============================================================================
function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) { const k = argv[i].slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; a[k] = v; }
    else a._.push(argv[i]);
  }
  return a;
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/audit/gang-p2b-sim.mjs");
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0] || "calib";
  if (cmd === "scen") await cmdScen(args);
  else if (cmd === "grid") await cmdGrid(args);
  else if (cmd === "round") await cmdRound(args);
  else if (cmd === "war") await cmdWar(args);
  else console.log("unbekannter Befehl", cmd, "- Eichung: node tools/audit/gang-p2b-calib.mjs");
}
