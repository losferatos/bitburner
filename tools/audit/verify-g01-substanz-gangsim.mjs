// Gegenpruefung G01 (Substanz): eigene Gang-Simulation BN2, unabhaengig vom
// Rechner des Erstpruefers (gang-sim.mjs / gang-formulas.mjs nicht benutzt).
//
// Quellen (reference/bitburner-src/src/):
//   Gang/Gang.ts:99-169        process / processGains (Reihenfolge: Gewinne mit alten
//                              Werten, dann Erfahrung), Wanted-Formel mit justice*0.001
//   Gang/Gang.ts:315-323       respectForNextRecruit: 3 frei, dann 5^(n-2)
//   Gang/Gang.ts:390-404       ascendMember: Respekt -= earnedRespect des Mitglieds
//   Gang/formulas/formulas.ts  Respekt, Wanted, Geld, Aufstiegspunkte/-mult
//   Gang/GangMember.ts:70-232  Fertigkeit (534.5), Erfahrung (Gewicht/1500 * diff^0.9 * asc)
//   Gang/data/tasks.ts         Aufgaben (abgeschrieben unten)
//   Gang/data/Constants.ts     minCyclesToProcess 10, maxCyclesToProcess 25
//   Gang/AllGangs.ts           Territorium 1/7; ohne Warfare bleibt es fest (Gang.ts:232-234)
//
// Keine Ausruestung, kein Territoriumskampf (konservativ wie beim Erstpruefer).
// Regler: Rekrutieren sobald moeglich; je Mitglied Training (gierig die Trainingsart
// mit dem groessten Zuwachs am Terrorism-Gewicht) bis Zielstufe, Aufstieg ab Faktor,
// danach Respektaufgabe; Vigilante, wenn der Wanted-Abzug unter eine Schwelle faellt.
//
// Aufruf: node tools/audit/verify-g01-substanz-gangsim.mjs [--grid] [--softcap 1] [--facrep 1.3]

const T = (o) => ({ baseRespect: 0, baseWanted: 0, baseMoney: 0, hack: 0, str: 0, def: 0, dex: 0, agi: 0, cha: 0,
  difficulty: 1, terr: { money: 1, respect: 1, wanted: 1 }, ...o });
export const TASKS = {
  "Mug People": T({ baseRespect: 0.00005, baseWanted: 0.00005, baseMoney: 3.6, str: 25, def: 25, dex: 25, agi: 10, cha: 15, difficulty: 1 }),
  "Deal Drugs": T({ baseRespect: 0.00006, baseWanted: 0.002, baseMoney: 15, agi: 20, dex: 20, cha: 60, difficulty: 3.5, terr: { money: 1.2, respect: 1, wanted: 1.15 } }),
  "Strongarm Civilians": T({ baseRespect: 0.00004, baseWanted: 0.02, baseMoney: 7.5, hack: 10, str: 25, def: 25, dex: 20, agi: 10, cha: 10, difficulty: 5, terr: { money: 1.6, respect: 1.1, wanted: 1.5 } }),
  "Run a Con": T({ baseRespect: 0.00012, baseWanted: 0.05, baseMoney: 45, str: 5, def: 5, agi: 25, dex: 25, cha: 40, difficulty: 14 }),
  "Armed Robbery": T({ baseRespect: 0.00014, baseWanted: 0.1, baseMoney: 114, hack: 20, str: 15, def: 15, agi: 10, dex: 20, cha: 20, difficulty: 20 }),
  "Traffick Illegal Arms": T({ baseRespect: 0.0002, baseWanted: 0.24, baseMoney: 174, hack: 15, str: 20, def: 20, dex: 20, cha: 25, difficulty: 32, terr: { money: 1.4, respect: 1.3, wanted: 1.25 } }),
  "Threaten & Blackmail": T({ baseRespect: 0.0002, baseWanted: 0.125, baseMoney: 72, hack: 25, str: 25, dex: 25, cha: 25, difficulty: 28 }),
  "Human Trafficking": T({ baseRespect: 0.004, baseWanted: 1.25, baseMoney: 360, hack: 30, str: 5, def: 5, dex: 30, cha: 30, difficulty: 36, terr: { money: 1.5, respect: 1.5, wanted: 1.6 } }),
  "Terrorism": T({ baseRespect: 0.01, baseWanted: 6, hack: 20, str: 20, def: 20, dex: 20, cha: 20, difficulty: 36, terr: { money: 1, respect: 2, wanted: 2 } }),
  "Vigilante Justice": T({ baseWanted: -0.001, hack: 20, str: 20, def: 20, dex: 20, agi: 20, difficulty: 1, terr: { money: 1, respect: 1, wanted: 0.9 } }),
  "Train Combat": T({ str: 25, def: 25, dex: 25, agi: 25, difficulty: 100 }),
  "Train Hacking": T({ hack: 100, difficulty: 45 }),
  "Train Charisma": T({ cha: 100, difficulty: 8 }),
};
const STATS = ["hack", "str", "def", "dex", "agi", "cha"];
const RESPECT_TASKS = ["Terrorism", "Human Trafficking", "Traffick Illegal Arms", "Threaten & Blackmail", "Armed Robbery", "Run a Con", "Mug People"];

const skill = (exp, mult) => Math.max(Math.floor(mult * (32 * Math.log(exp + 534.5) - 200)), 1);
const ascMult = (pts) => Math.max(Math.sqrt(pts / 2000), 1);
const weighted = (t, m, sub) => {
  let w = 0;
  for (const s of STATS) w += (t[s] / 100) * m.lvl[s];
  return w - sub * t.difficulty;
};

function respectGain(g, m, t, softcap) {
  if (t.baseRespect === 0) return 0;
  const w = weighted(t, m, 4);
  if (w <= 0) return 0;
  const terrMult = Math.max(0.005, Math.pow(g.territory * 100, t.terr.respect) / 100);
  const terrPen = (0.2 * g.territory + 0.8) * softcap;
  const pen = g.respect / (g.respect + g.wanted);
  return Math.pow(11 * t.baseRespect * w * terrMult * pen, terrPen);
}
function wantedGain(g, m, t) {
  if (t.baseWanted === 0) return 0;
  const w = weighted(t, m, 3.5);
  if (w <= 0) return 0;
  const terrMult = Math.max(0.005, Math.pow(g.territory * 100, t.terr.wanted) / 100);
  if (t.baseWanted < 0) return 0.4 * t.baseWanted * w * terrMult;
  return Math.min(100, (7 * t.baseWanted) / Math.pow(3 * w * terrMult, 0.8));
}
function moneyGain(g, m, t, softcap) {
  if (t.baseMoney === 0) return 0;
  const w = weighted(t, m, 3.2);
  if (w <= 0) return 0;
  const terrMult = Math.max(0.005, Math.pow(g.territory * 100, t.terr.money) / 100);
  const pen = g.respect / (g.respect + g.wanted);
  const terrPen = (0.2 * g.territory + 0.8) * softcap;
  return Math.pow(5 * t.baseMoney * w * terrMult * pen, terrPen);
}

function newMember() {
  const m = { task: "Train Combat", earned: 0, exp: {}, pts: {}, lvl: {} };
  for (const s of STATS) { m.exp[s] = 0; m.pts[s] = 0; m.lvl[s] = 1; }
  return m;
}
function updateLvl(m) { for (const s of STATS) m.lvl[s] = skill(m.exp[s], ascMult(m.pts[s])); }
function gainExp(m, n) {
  const t = TASKS[m.task];
  const dm = Math.pow(t.difficulty, 0.9) * n;
  for (const s of STATS) m.exp[s] += (t[s] / 1500) * dm * ascMult(m.pts[s]); // ohne Ausruestung: expMult 1
}
// Aufstiegsfaktor fuer die Terrorism-relevanten Werte (Mittel ueber hack,str,def,dex,cha)
function ascFactor(m, stats) {
  let f = 0;
  for (const s of stats) f += ascMult(m.pts[s] + Math.max(m.exp[s] - 1000, 0)) / ascMult(m.pts[s]);
  return f / stats.length;
}
function ascend(g, m) {
  for (const s of STATS) { m.pts[s] += Math.max(m.exp[s] - 1000, 0); m.exp[s] = 0; }
  updateLvl(m);
  g.respect = Math.max(1, g.respect - m.earned);
  m.earned = 0;
  g.ascensions++;
}

// Gierige Trainingswahl: groesster Zuwachs des Terrorism-Gewichts je Zyklus
function bestTraining(m, workTask) {
  const wt = TASKS[workTask];
  let best = null;
  for (const tn of ["Train Combat", "Train Hacking", "Train Charisma"]) {
    const t = TASKS[tn];
    const dm = Math.pow(t.difficulty, 0.9);
    let d = 0;
    for (const s of STATS) {
      if (!t[s] || !wt[s]) continue;
      const am = ascMult(m.pts[s]);
      const expRate = (t[s] / 1500) * dm * am;
      d += (wt[s] / 100) * am * 32 * expRate / (m.exp[s] + 534.5);
    }
    if (!best || d > best.d) best = { tn, d };
  }
  return best.tn;
}

export function simulate(opt = {}) {
  const o = { hours: 30, softcap: 1, facRep: 1.3, favor: 0, trainTarget: 400, ascTrain: 1.4, ascWork: 2.0,
    wantedPen: 0.95, workTask: "Terrorism", stepCycles: 10, marks: [1e5, 4.375e5, 7.5e5, 1.25e6, 1.625e6, 2.5e6],
    moneyMode: false, ...opt };
  const g = { members: [], respect: 1, wanted: 1, territory: 1 / 7, rep: 0, money: 0, ascensions: 0 };
  const hitAt = {};
  const N = Math.round((o.hours * 3600 * 5) / o.stepCycles);
  const trace = [];
  const work = (m) => !m.task.startsWith("Train");
  for (let step = 0; step < N; step++) {
    const n = o.stepCycles;
    // --- Regler (vor dem Takt, wie ein Skript mit nextUpdate) ---
    while (g.members.length < 12 && g.respect >= (g.members.length < 3 ? 0 : Math.pow(5, g.members.length - 2))) g.members.push(newMember());
    const pen = g.respect / (g.respect + g.wanted);
    const target = g.members.length < 12 ? (o.earlyTarget ?? o.trainTarget) : o.trainTarget;
    for (const m of g.members) {
      const relevant = STATS.filter((s) => TASKS[o.workTask][s] > 0);
      const avg = relevant.reduce((a, s) => a + m.lvl[s], 0) / relevant.length;
      const f = ascFactor(m, relevant);
      if (!work(m)) {
        if (f >= o.ascTrain) ascend(g, m);
        if (avg < target) { m.task = bestTraining(m, o.workTask); continue; }
      } else if (f >= o.ascWork) {
        ascend(g, m);
        m.task = bestTraining(m, o.workTask);
        continue;
      }
      // Arbeit: beste Respektaufgabe fuer dieses Mitglied (oder fest die workTask)
      if (o.bestTask) {
        let bt = o.workTask, br = -1;
        for (const tn of RESPECT_TASKS) {
          const r = respectGain(g, m, TASKS[tn], o.softcap);
          if (r > br) { br = r; bt = tn; }
        }
        m.task = br > 0 ? bt : bestTraining(m, o.workTask);
      } else m.task = o.workTask;
    }
    // Wanted-Regelung: so viele Arbeiter auf Vigilante, bis der Wanted-Zuwachs <= 0, wenn der Abzug zu gross
    // (nur wenn wanted wirklich ueber 1 liegt - bei respect 1 / wanted 1 ist der Abzug 0,5 und nicht behebbar)
    if (pen < o.wantedPen && g.wanted > 1.05) {
      const workers = g.members.filter(work).sort((a, b) => weighted(TASKS["Vigilante Justice"], b, 3.5) - weighted(TASKS["Vigilante Justice"], a, 3.5));
      let wsum = workers.reduce((a, m) => a + wantedGain(g, m, TASKS[m.task]), 0);
      for (const m of workers) {
        if (wsum <= 0) break;
        wsum -= wantedGain(g, m, TASKS[m.task]);
        m.task = "Vigilante Justice";
        wsum += wantedGain(g, m, TASKS[m.task]);
      }
    }
    // --- Takt: processGains (alte Werte) ---
    let resp = 0, money = 0, wgain = 0, justice = 0;
    for (const m of g.members) {
      const t = TASKS[m.task];
      const r = respectGain(g, m, t, o.softcap) * n;
      m.earned += r; resp += r;
      money += moneyGain(g, m, t, o.softcap);
      wgain += wantedGain(g, m, t);
      if (t.baseWanted < 0) justice++;
    }
    g.respect += resp;
    g.rep += (o.facRep * resp * (1 + o.favor / 100)) / 75;
    if (g.wanted !== 1 || wgain >= 0) {
      const old = g.wanted;
      g.wanted = (old + wgain * n) * (1 - justice * 0.001);
      if (g.wanted < 1 || (wgain <= 0 && g.wanted > old)) g.wanted = 1;
    }
    g.money += money * n;
    // --- processExperienceGains ---
    for (const m of g.members) { gainExp(m, n); updateLvl(m); }
    const h = ((step + 1) * n) / 5 / 3600;
    for (const mk of o.marks) if (hitAt[mk] === undefined && g.rep >= mk) hitAt[mk] = h;
    if ((step + 1) % Math.round(3600 * 5 / n) === 0) trace.push({ h: Math.round(h), rep: g.rep, members: g.members.length, respect: g.respect, wanted: g.wanted });
  }
  return { hitAt, rep: g.rep, respect: g.respect, members: g.members.length, ascensions: g.ascensions, money: g.money, trace, g };
}

function fmt(x) { return x === undefined ? "  -  " : x.toFixed(1).padStart(5); }
function main() {
  const args = process.argv.slice(2);
  const val = (k, d) => { const i = args.indexOf(k); return i >= 0 ? Number(args[i + 1]) : d; };
  const softcap = val("--softcap", 1), facRep = val("--facrep", 1.3), hours = val("--hours", 30);
  const marks = [1e5, 4.375e5, 7.5e5, 1.25e6, 1.625e6, 2.5e6];
  console.log(`softcap ${softcap}, faction_rep ${facRep}, ${hours} h, Takt 10 Zyklen`);
  console.log("Regler (Ziel/AufTrain/AufArbeit/Wanted) | h bis 100k 437k 750k 1.25M 1.625M 2.5M | Rep nach " + hours + " h | Aufstiege");
  const rows = [];
  const grid = args.includes("--grid");
  const targets = grid ? [150, 200, 250, 300, 400, 500, 700] : [300, 500];
  const at = grid ? [1.2, 1.3, 1.5, 2.0] : [1.3, 1.6];
  const aw = grid ? [1.5, 2.0, 3.0, 99] : [2.0, 99];
  const early = grid ? [null, 100, 200] : [null];
  const bests = grid ? [false, true] : [false, true];
  for (const trainTarget of targets) for (const ascTrain of at) for (const ascWork of aw) for (const earlyTarget of early) for (const bestTask of bests) {
    const r = simulate({ softcap, facRep, hours, trainTarget, ascTrain, ascWork, marks, earlyTarget: earlyTarget ?? undefined, bestTask });
    rows.push({ trainTarget: trainTarget + (earlyTarget ? "(" + earlyTarget + ")" : "") + (bestTask ? "B" : "T"), ascTrain, ascWork, r });
  }
  rows.sort((a, b) => (a.r.hitAt[1.25e6] ?? 1e9) - (b.r.hitAt[1.25e6] ?? 1e9));
  for (const { trainTarget, ascTrain, ascWork, r } of rows.slice(0, grid ? 15 : rows.length)) {
    console.log(`${String(trainTarget).padStart(4)}/${ascTrain}/${ascWork}/0.95`.padEnd(40), "|",
      marks.map((mk) => fmt(r.hitAt[mk])).join(" "), "|", (r.rep / 1e6).toFixed(2), "Mio |", r.ascensions);
  }
  if (grid) {
    const worst = rows[rows.length - 1];
    console.log("schlechtester Regler:", worst.trainTarget, worst.ascTrain, worst.ascWork, marks.map((mk) => fmt(worst.r.hitAt[mk])).join(" "));
  }
}
import { fileURLToPath } from "node:url";
import path from "node:path";
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
