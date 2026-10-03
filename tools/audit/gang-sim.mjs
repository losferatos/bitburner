// Gang-Simulation fuer das Audit 03.10.2026 (BN2.1).
//
// Motor: Gang.ts:99-169 (process -> processGains -> processExperienceGains),
// Formeln aus gang-formulas.mjs (Abschreibpruefung gang-check.mjs: 0
// Abweichungen gegen den Originalquelltext). Territorium bleibt 1/7, weil ohne
// Territory Warfare keine Clashes mit der eigenen Gang stattfinden
// (Gang.ts:210-233, clashChance 0) - das ist die konservative Annahme, ein
// Kampfgang-Territorium > 1/7 hebt Terrorism (Exponent 2) weiter.
// Keine Ausruestung (kostet Geld, das in BN2 die Augs brauchen) - ebenfalls
// konservativ.
//
// Steuerung (Politik) ist NICHT aus dem Spiel, sondern ein einfacher
// gieriger Regler; das Raster ueber seine Parameter zeigt die Spanne.
//
// Aufruf: node tools/audit/gang-sim.mjs [--hours 60] [--type combat|hacking] [--grid]
import * as F from "./gang-formulas.mjs";

const NUM_CYCLES = F.GC.minCyclesToProcess; // 10 Zyklen = 2 s je Schritt (online)
const STEP_S = NUM_CYCLES * F.GC.MilliPerCycle / 1000;

function contLevel(exp, mult) { return mult * (32 * Math.log(exp + 534.5) - 200); }

export function simulate(opts) {
  const o = {
    hours: 60, type: "combat", trainUntil: 300, ascThr: 1.6, ascWorkThr: 0, wantedFloor: 0.95,
    factionRepMult: 1.3280548527604765, // Spielstand BN2.1 09:59 mults.faction_rep
    gangSoftcap: 1, // BN2: BitNodeMultipliers.ts:91 Default
    mode: "respect", moneyFrom: Infinity, log: false, trainHorizonSteps: 900,
    // 03.10.2026 (Paket P2, gang.js): trainSet = erlaubte Trainingsaufgaben (Vorgabe: alle drei,
    // gierig); combatOnly = Aufstiegsfaktor nur ueber str/def/dex/agi statt ueber die Gewichte der
    // Respektaufgabe. Beides war nur lokal gemessen - jetzt nachlaufbar (--trainset, --combatonly).
    trainSet: null, combatOnly: false, ...opts,
  };
  const target = F.TASKS[o.type === "combat" ? "Terrorism" : "Cyberterrorism"];
  const tasks = F.tasksFor(o.type === "hacking");
  const respectTasks = tasks.filter((t) => t.baseRespect > 0);
  const moneyTasks = tasks.filter((t) => t.baseMoney > 0);
  const vigil = F.TASKS[o.type === "combat" ? "Vigilante Justice" : "Ethical Hacking"];
  const trains = (o.trainSet || ["Train Combat", "Train Hacking", "Train Charisma"]).map((n) => F.TASKS[n]);

  const gang = { respect: 1, wanted: 1, territory: 1 / 7, members: [] }; // Gang.ts:64-88
  let rep = 0, money = 0, nameCtr = 0, ascensions = 0;
  const steps = Math.round(o.hours * 3600 / STEP_S);
  const marks = [];
  const repTargets = [1e5, 4.375e5, 7.5e5, 8.75e5, 1.125e6, 1.25e6, 1.625e6, 2.5e6];
  const repHit = {};
  const g = () => ({ respect: gang.respect, territory: gang.territory, wantedLevel: gang.wanted });
  const wl = (m, t) => F.STATS.reduce((a, s) => a + (t.w[s] / 100) * m.lvl[s], 0);

  for (let step = 0; step < steps; step++) {
    const tH = step * STEP_S / 3600;
    // 1) Rekrutieren (Gang.ts:305-354)
    while (gang.members.length < F.GC.MaximumGangMembers && gang.respect >= F.respectForNextRecruit(gang.members.length)) {
      gang.members.push(F.newMember("m" + (nameCtr++)));
    }
    // 2) Aufstieg und Aufgabenwahl
    const G = g();
    for (const m of gang.members) {
      const r = F.ascensionResult(m);
      let lw = 0, ww = 0;
      if (o.combatOnly) { for (const s of ["str", "def", "dex", "agi"]) { lw += Math.log(r[s]); ww += 1; } }
      else for (const s of F.STATS) if (target.w[s] > 0) { lw += target.w[s] * Math.log(r[s]); ww += target.w[s]; }
      const gainF = Math.exp(lw / ww);
      if (m.phase === "train" && gainF >= o.ascThr) { F.ascend(gang, m); ascensions++; }
      else if (m.phase === "work" && o.ascWorkThr > 0 && gainF >= o.ascWorkThr) { F.ascend(gang, m); ascensions++; m.phase = "train"; }
      if (m.phase === "train" && wl(m, target) >= o.trainUntil) m.phase = "work";
      if (m.phase === "train") {
        // gierig: Training mit dem groessten Zuwachs an gewichteter Stufe
        let best = null, bestD = -1;
        for (const t of trains) {
          // Horizont statt Einzelschritt, sonst wird Charisma (Stufe ~ log exp,
          // 0,43 exp/Zyklus) nie gewaehlt
          const ge = F.expGain(m, t, NUM_CYCLES * o.trainHorizonSteps);
          let d = 0;
          for (const s of F.STATS) {
            if (!target.w[s]) continue;
            const mu = m.mult[s] * F.ascMult(m.ascPoints[s]);
            d += (target.w[s] / 100) * (contLevel(m.exp[s] + ge[s], mu) - contLevel(m.exp[s], mu));
          }
          if (d > bestD) { bestD = d; best = t; }
        }
        m.task = best.name;
      } else {
        const useMoney = o.mode === "money" || (o.mode === "mixed" && gang.members.length >= o.moneyFrom);
        const pool = useMoney ? moneyTasks : respectTasks;
        let best = null, bv = 0;
        for (const t of pool) {
          const v = useMoney ? F.moneyGain(G, m.lvl, t, o.gangSoftcap) : F.respectGain(G, m.lvl, t, o.gangSoftcap);
          if (v > bv) { bv = v; best = t; }
        }
        m.task = best ? best.name : trains[0].name;
      }
    }
    // 3) Wanted-Regler: Arbeitende mit kleinstem Respekt auf Vigilante
    // Nur wenn wanted ueber dem Boden 1 liegt - bei wanted = 1 senkt
    // Vigilante nichts (Gang.ts:157-166), und respect = 1 ergibt Penalty 0,5.
    if (gang.wanted > 1 && F.wantedPenalty(G) < o.wantedFloor) {
      let wsum = gang.members.reduce((a, m) => a + F.wantedGain(G, m.lvl, F.TASKS[m.task]), 0);
      const working = gang.members.filter((m) => m.phase === "work")
        .sort((a, b) => F.respectGain(G, a.lvl, F.TASKS[a.task], o.gangSoftcap) - F.respectGain(G, b.lvl, F.TASKS[b.task], o.gangSoftcap));
      for (const m of working) {
        if (wsum <= 0) break;
        wsum -= F.wantedGain(G, m.lvl, F.TASKS[m.task]);
        m.task = vigil.name;
        wsum += F.wantedGain(G, m.lvl, vigil);
      }
    }
    // 4) processGains (Gang.ts:125-169) - alle Mitglieder sehen denselben Gang-Zustand
    let respTot = 0, moneyPC = 0, wantedPC = 0, justice = 0;
    for (const m of gang.members) {
      const t = F.TASKS[m.task];
      const er = F.respectGain(G, m.lvl, t, o.gangSoftcap) * NUM_CYCLES;
      m.earnedRespect += er; respTot += er;
      moneyPC += F.moneyGain(G, m.lvl, t, o.gangSoftcap);
      wantedPC += F.wantedGain(G, m.lvl, t);
      if (t.baseWanted < 0) justice++;
    }
    gang.respect += respTot;
    rep += (o.factionRepMult * respTot * 1) / F.GC.GangRespectToReputationRatio; // favor 0 -> favorMult 1
    if (gang.wanted !== 1 || wantedPC >= 0) {
      const old = gang.wanted;
      gang.wanted = (old + wantedPC * NUM_CYCLES) * (1 - justice * 0.001);
      if (gang.wanted < 1 || (wantedPC <= 0 && gang.wanted > old)) gang.wanted = 1;
    }
    money += moneyPC * NUM_CYCLES;
    // 5) processExperienceGains (Gang.ts:274-279)
    for (const m of gang.members) {
      const ge = F.expGain(m, F.TASKS[m.task], NUM_CYCLES);
      if (ge) for (const s of F.STATS) m.exp[s] += ge[s];
      F.updateSkills(m);
    }
    for (const rt of repTargets) if (repHit[rt] === undefined && rep >= rt) repHit[rt] = tH;
    if (o.log && (step % Math.round(3600 / STEP_S) === 0 || step === steps - 1)) {
      const avg = (s) => gang.members.reduce((a, m) => a + m.lvl[s], 0) / gang.members.length;
      marks.push({ h: +tH.toFixed(1), members: gang.members.length, respect: +gang.respect.toFixed(0), rep: +rep.toFixed(0),
        moneyB: +(money / 1e9).toFixed(2), penalty: +F.wantedPenalty(g()).toFixed(3),
        respPerS: +(respTot / STEP_S).toFixed(1), moneyPerS: +(moneyPC * NUM_CYCLES / STEP_S).toFixed(0),
        avgStr: Math.round(avg("str")), avgHack: Math.round(avg("hack")), avgCha: Math.round(avg("cha")),
        working: gang.members.filter((m) => m.phase === "work").length, asc: ascensions });
    }
  }
  return { opts: o, rep, money, respect: gang.respect, repHit, marks, ascensions, members: gang.members.length, gang };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/audit/gang-sim.mjs");
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const hours = Number(arg("--hours", 60));
  const type = arg("--type", "combat");
  if (process.argv.includes("--grid")) {
    const rows = [];
    for (const trainUntil of [100, 200, 300, 500, 800])
      for (const ascThr of [1.3, 1.6, 2.0, 3.0])
        for (const ascWorkThr of [0, 2, 4]) {
          const r = simulate({ hours, type, trainUntil, ascThr, ascWorkThr });
          rows.push({ trainUntil, ascThr, ascWorkThr, rep: r.rep, hit: r.repHit, members: r.members });
        }
    rows.sort((a, b) => (a.hit[1.25e6] ?? 1e9) - (b.hit[1.25e6] ?? 1e9) || b.rep - a.rep);
    console.log(`Raster ${type}, ${hours} h, sortiert nach Zeit bis 1,25 Mio Rep (kumuliert, ohne Einbau-Nullung):`);
    console.log("trainUntil ascThr ascWork | h bis 100k 437k 750k 1.25M 2.5M | Rep@Ende   Mitglieder");
    for (const r of rows.slice(0, 12).concat(rows.slice(-3))) {
      const h = (x) => (r.hit[x] === undefined ? "  -  " : r.hit[x].toFixed(1).padStart(5));
      console.log(String(r.trainUntil).padStart(10), String(r.ascThr).padStart(6), String(r.ascWorkThr).padStart(7), "|",
        h(1e5), h(4.375e5), h(7.5e5), h(1.25e6), h(2.5e6), "|", (r.rep / 1e6).toFixed(2).padStart(7) + "M", r.members);
    }
  } else {
    const r = simulate({ hours, type, trainUntil: Number(arg("--train", 300)), ascThr: Number(arg("--asc", 1.6)),
      trainSet: arg("--trainset", null) ? arg("--trainset", "").split(",") : null, combatOnly: process.argv.includes("--combatonly"),
      ascWorkThr: Number(arg("--ascwork", 0)), mode: arg("--mode", "respect"), moneyFrom: Number(arg("--moneyfrom", Infinity)), log: true });
    for (const m of r.marks) console.log(JSON.stringify(m));
    console.log("repHit (h):", JSON.stringify(r.repHit), "ascensions", r.ascensions);
  }
}
