// Sleeve-Rechner fuer Bladeburner-Knoten (V2). Nur lesen, nichts schreiben.
// Formeln aus reference/bitburner-src/src (3.0.2), jede mit Fundstelle.
// Geeicht gegen die BN2L1-Spielstaende vom 03.10.2026 (backups/*.json.gz).
// Aufruf: node tools/audit/sleeve-bb.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSave } from "./sleeve-save.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const B = (n) => path.join(root, "backups", "LIVE_197f4d61481686_BN2L1_2026-10-03T" + n + ".json.gz");

// ---------------------------------------------------------------------------
// Konstanten (Bladeburner/data/Constants.ts)
const C = {
  BaseStaminaLoss: 0.285, DiffMultExp: 0.28, DiffMultLin: 650, DifficultyToTimeFactor: 10,
  EffAgiLin: 10e3, EffDexLin: 10e3, EffAgiExp: 0.04, EffDexExp: 0.035,
  PopulationThreshold: 1e9, PopulationExponent: 0.7, ChaosThreshold: 50, ActionCountGrowthPeriod: 480,
  StaminaGainPerSecond: 0.0085, MaxStaminaToGainFactor: 70000,
};
// Skills (Bladeburner/data/Skills.ts): Prozent je Stufe, multiplikativ je Skill (Bladeburner.ts updateSkillMultipliers)
const SKILLS = {
  "Blade's Intuition": { SuccessChanceAll: 3 }, Cloak: { SuccessChanceStealth: 5.5 },
  "Short-Circuit": { SuccessChanceKill: 5.5 }, "Digital Observer": { SuccessChanceOperation: 4 },
  Tracer: { SuccessChanceContract: 4 }, Overclock: { ActionTime: -1 },
  Reaper: { EffStr: 2, EffDef: 2, EffDex: 2, EffAgi: 2 }, "Evasive System": { EffDex: 4, EffAgi: 4 },
  Datamancer: { SuccessChanceEstimate: 5 }, "Cyber's Edge": { Stamina: 2 },
  "Hands of Midas": { Money: 10 }, Hyperdrive: { ExpGain: 10 },
};
function skillMults(levels) {
  const m = {};
  for (const [name, lvl] of Object.entries(levels || {})) {
    const def = SKILLS[name];
    if (!def || !lvl) continue;
    for (const [k, base] of Object.entries(def)) m[k] = (m[k] ?? 1) * (1 + (base * lvl) / 100);
  }
  return (k) => m[k] ?? 1;
}
// Aktionen (data/Contracts.ts, data/Operations.ts)
const W0 = { hacking: 0, strength: 0, defense: 0, dexterity: 0, agility: 0, charisma: 0, intelligence: 0 };
const ACT = {
  Tracking: { kind: "C", baseDifficulty: 125, difficultyFac: 1.02, rewardFac: 1.041, rankGain: 0.3, rankLoss: 0, hpLoss: 0.5,
    weights: { ...W0, strength: 0.05, defense: 0.05, dexterity: 0.35, agility: 0.35, charisma: 0.1, intelligence: 0.05 },
    decays: { hacking: 0, strength: 0.91, defense: 0.91, dexterity: 0.91, agility: 0.91, charisma: 0.9, intelligence: 1 },
    isStealth: true, isKill: false, growthMean: 4.0 },
  "Bounty Hunter": { kind: "C", baseDifficulty: 250, difficultyFac: 1.04, rewardFac: 1.085, rankGain: 0.9, rankLoss: 0, hpLoss: 1,
    weights: { ...W0, strength: 0.15, defense: 0.15, dexterity: 0.25, agility: 0.25, charisma: 0.1, intelligence: 0.1 },
    decays: { hacking: 0, strength: 0.91, defense: 0.91, dexterity: 0.91, agility: 0.91, charisma: 0.8, intelligence: 0.9 },
    isStealth: false, isKill: true, growthMean: 4.0 },
  Retirement: { kind: "C", baseDifficulty: 200, difficultyFac: 1.03, rewardFac: 1.065, rankGain: 0.6, rankLoss: 0, hpLoss: 1,
    weights: { ...W0, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2, charisma: 0.1, intelligence: 0.1 },
    decays: { hacking: 0, strength: 0.91, defense: 0.91, dexterity: 0.91, agility: 0.91, charisma: 0.8, intelligence: 0.9 },
    isStealth: false, isKill: true, growthMean: 4.0 },
  Raid: { kind: "O", baseDifficulty: 800, difficultyFac: 1.045, rewardFac: 1.1, rankGain: 55, rankLoss: 2.5, hpLoss: 50,
    weights: { ...W0, hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2, intelligence: 0.1 },
    decays: { hacking: 0.7, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, charisma: 0, intelligence: 0.9 },
    isStealth: false, isKill: true, growthMean: 2.1 },
};
const intBonus = (int, w) => 1 + (w * Math.pow(int, 0.8)) / 600; // formulas/intelligence.ts
const effSkill = (sm, person, stat) => {                          // Bladeburner.ts getEffectiveSkillLevel
  const map = { strength: "EffStr", defense: "EffDef", dexterity: "EffDex", agility: "EffAgi", charisma: "EffCha" };
  return person.skills[stat] * (map[stat] ? sm(map[stat]) : 1);
};
const difficulty = (a, level) => a.baseDifficulty * Math.pow(a.difficultyFac, level - 1); // LevelableAction.ts:58-64

// Action.ts getSuccessChance (Zeilen 169-199) - echte Bevoelkerung, est=false
function successChance(a, level, person, st, teamCount = 0) {
  let diff = difficulty(a, level);
  let comp = 0;
  for (const stat of Object.keys(W0)) {
    comp += a.weights[stat] * Math.pow(effSkill(st.sm, person, stat), a.decays[stat]);
  }
  comp *= intBonus(person.skills.intelligence, 0.75);
  comp *= Math.min(1, st.stamina / (0.5 * st.maxStamina));              // calculateStaminaPenalty (Spieler-Ausdauer!)
  if (a.kind === "O") comp *= Math.pow(teamCount + 1, 0.05);             // operationTeamSuccessBonus
  comp *= Math.pow(st.pop / C.PopulationThreshold, C.PopulationExponent);
  if (st.chaos > C.ChaosThreshold) diff *= Math.pow(1 + st.chaos - C.ChaosThreshold, 0.5);
  comp *= st.sm("SuccessChanceAll");
  comp *= a.kind === "C" ? st.sm("SuccessChanceContract") : st.sm("SuccessChanceOperation");
  if (a.isStealth) comp *= st.sm("SuccessChanceStealth");
  if (a.isKill) comp *= st.sm("SuccessChanceKill");
  comp *= person.bsc ?? 1;                                                // mults.bladeburner_success_chance
  return Math.min(1, comp / diff);
}
// Action.ts getActionTime (Zeilen 104-121)
function actionTime(a, level, person, st) {
  const base = difficulty(a, level) / C.DifficultyToTimeFactor;
  const ea = effSkill(st.sm, person, "agility"), ed = effSkill(st.sm, person, "dexterity");
  const statFac = 0.5 * (Math.pow(ea, C.EffAgiExp) + Math.pow(ed, C.EffDexExp) + ea / C.EffAgiLin + ed / C.EffDexLin);
  return Math.ceil(Math.max(1, (base * st.sm("ActionTime")) / statFac));
}
const rankGain = (a, level, bnRank = 1) => a.rankGain * Math.pow(a.rewardFac, level - 1) * bnRank; // Formulas.ts:9-25
const rankLoss = (a, level) => a.rankLoss * Math.pow(a.rewardFac, level - 1);                     // Formulas.ts:30-41
const diffMult = (d) => Math.pow(d, C.DiffMultExp) + d / C.DiffMultLin;

function stateOf(file) {
  const { player: p } = loadSave(file);
  const bb = p.bladeburner.data || p.bladeburner;
  const city = bb.cities[bb.city].data || bb.cities[bb.city];
  const lvl = (x) => (x.data || x).level;
  const cnt = (x) => (x.data || x).count;
  const sc = (x) => ({ s: (x.data || x).successes, f: (x.data || x).failures });
  return {
    play: p.totalPlaytime / 1000,
    sm: skillMults(bb.skills), skills: bb.skills,
    stamina: bb.stamina, maxStamina: bb.maxStamina, pop: city.pop, chaos: city.chaos, comms: city.comms,
    rank: bb.rank,
    player: { skills: p.skills, bsc: p.mults.bladeburner_success_chance },
    sleeves: p.sleeves.map((s) => { const d = s.data || s; return { skills: d.skills, exp: d.exp, shock: d.shock, sync: d.sync, bsc: d.mults.bladeburner_success_chance,
      work: d.currentWork ? { ctor: d.currentWork.ctor, ...(d.currentWork.data || {}) } : null }; }),
    level: { Tracking: lvl(bb.contracts.Tracking), "Bounty Hunter": lvl(bb.contracts["Bounty Hunter"]), Retirement: lvl(bb.contracts.Retirement), Raid: lvl(bb.operations.Raid) },
    count: { Tracking: cnt(bb.contracts.Tracking), "Bounty Hunter": cnt(bb.contracts["Bounty Hunter"]), Retirement: cnt(bb.contracts.Retirement), Raid: cnt(bb.operations.Raid) },
    sc: { Tracking: sc(bb.contracts.Tracking), "Bounty Hunter": sc(bb.contracts["Bounty Hunter"]), Retirement: sc(bb.contracts.Retirement), Raid: sc(bb.operations.Raid) },
  };
}
const f = (x, n = 3) => (Number.isFinite(x) ? x.toFixed(n) : String(x));
const binomSd = (n, p) => Math.sqrt(n * p * (1 - p));

export { successChance, actionTime, rankGain, rankLoss, stateOf, ACT, intBonus, diffMult };

if (process.argv[1] && process.argv[1].endsWith("sleeve-bb.mjs")) {
  const S0633 = stateOf(B("06-33_hourly")), S0733 = stateOf(B("07-33_hourly"));
  const S0833 = stateOf(B("08-33_hourly")), S0919 = stateOf(B("09-19_pre-hotswap"));
  const S0933 = stateOf(B("09-33_hourly")), S0946 = stateOf(B("09-46_connect")), S0959 = stateOf(B("09-59_pre-hotswap"));

  console.log("=== 1. Eichung Gym + Schockabbau (Sleeve.ts:263-275, SleeveClassWork, Work.ts:17-25) ===");
  // Powerhouse expMult 10 (LocationsMetadata.ts:322-327), Gym-Earnings 1 exp je Zyklus / 5 Zyklen (Work/Formulas.ts:108-121)
  // => 10 exp/s * shockBonus. Schock -= 0.0001*intBonus(int,0.75) je Zyklus, 5 Zyklen/s.
  const dt1 = S0733.play - S0633.play;
  for (let i = 0; i < 3; i++) {
    const a = S0633.sleeves[i], b = S0733.sleeves[i];
    const decay = 0.0001 * intBonus(a.skills.intelligence, 0.75) * 5 * dt1;
    const sum = (e) => e.strength + e.defense + e.dexterity + e.agility;
    const meanBonus = (100 - (a.shock + (a.shock - decay)) / 2) / 100;
    const expSoll = 10 * meanBonus * dt1;
    console.log(`Sleeve ${i}: dt ${f(dt1, 1)} s | Schockabbau Soll ${f(decay, 4)} Ist ${f(a.shock - b.shock, 4)} | Kampf-Exp Soll ${f(expSoll, 1)} Ist ${f(sum(b.exp) - sum(a.exp), 1)}`);
  }

  console.log("\n=== 2. Eichung Sleeve-Vertraege (Chance, Dauer) ===");
  // Tracking: Sleeve 2, 09:19 -> 09:33 (Stufe 10->11); Bounty Hunter: Sleeve 0, 09:33 -> 09:59 (Stufe 6->7)
  const cal = [
    ["Tracking", 2, S0919, S0933], ["Bounty Hunter", 0, S0919, S0933], ["Bounty Hunter", 0, S0933, S0959],
  ];
  for (const [name, i, A, Z] of cal) {
    const a = ACT[name];
    const n = (Z.sc[name].s + Z.sc[name].f) - (A.sc[name].s + A.sc[name].f);
    const k = Z.sc[name].s - A.sc[name].s;
    const sl = A.sleeves[i];
    const ps = [], ts = [];
    for (let L = A.level[name]; L <= Z.level[name]; L++) {
      // Stadtwerte: Mittel aus Anfang und Ende
      const st = { ...A, pop: (A.pop + Z.pop) / 2, chaos: (A.chaos + Z.chaos) / 2, stamina: Math.min(A.stamina, Z.stamina) };
      ps.push(successChance(a, L, sl, st)); ts.push(actionTime(a, L, sl, st));
    }
    const pm = ps.reduce((x, y) => x + y, 0) / ps.length;
    const doneA = (A.sleeves[i].work && A.sleeves[i].work.tasksCompleted) || 0;
    const doneZ = (Z.sleeves[i].work && Z.sleeves[i].work.tasksCompleted) || 0;
    const dt = Z.play - A.play;
    console.log(`${name} Sleeve ${i} ${(A === S0919 ? "09:19" : "09:33")}->${(Z === S0933 ? "09:33" : "09:59")}: Versuche ${n} (Sleeve tasks ${doneZ - doneA}), Erfolge Ist ${k} = ${f(k / n)} | Soll p(Stufen ${A.level[name]}..${Z.level[name]}) ${ps.map((x) => f(x)).join("/")} Mittel ${f(pm)} -> ${f(pm * n, 1)} +- ${f(binomSd(n, pm), 1)} | Dauer Soll ${ts.join("/")} s, Ist ${f(dt / (doneZ - doneA), 2)} s/Versuch`);
  }

  console.log("\n=== 3. Eichung Spieler-Raid (Chance, Dauer, Rang) ===");
  {
    const a = ACT.Raid, A = S0919, Z = S0959;
    const n = (Z.sc.Raid.s + Z.sc.Raid.f) - (A.sc.Raid.s + A.sc.Raid.f), k = Z.sc.Raid.s - A.sc.Raid.s;
    const pts = [A, S0933, S0946, Z].map((s) => successChance(a, 5, s.player, { ...s, stamina: s.maxStamina }));
    const pm = pts.reduce((x, y) => x + y, 0) / pts.length;
    console.log(`Raid 09:19->09:59: Versuche ${n}, Erfolge ${k} = ${f(k / n)} | Soll p je Stand ${pts.map((x) => f(x)).join("/")} Mittel ${f(pm)} -> ${f(pm * n, 1)} +- ${f(binomSd(n, pm), 1)}`);
    console.log(`Raid Dauer Soll ${actionTime(a, 5, A.player, A)} s (blade.json dauer 77000 ms) | Rang je Erfolg Soll ${f(rankGain(a, 5), 2)} (Log 75,1..86,3 = +-10 % addOffset) | Verlust ${f(rankLoss(a, 5), 2)} (Log 3,48..4,01)`);
  }

  console.log("\n=== 4. Eichung Infiltrate (Bladeburner.ts:1251-1263, SleeveInfiltrateWork.ts:7-28) ===");
  {
    const dt = S0959.play - S0946.play;
    const nInf = 2; // 09:46 und 09:59: Sleeve 1 und 2 auf Infiltrate (Spielstand)
    const infil = (nInf * Math.pow(nInf, -0.5) / 2) * (dt / 60);
    const natural = (ACT.Raid.growthMean / C.ActionCountGrowthPeriod) * dt;
    const used = 7; // Spieler-Raids 09:46:57-09:59:23 laut Konsole (2 Erfolge, 5 Fehlschlaege)
    console.log(`Raid-Vorrat 09:46 -> 09:59 (${f(dt, 1)} s): Infiltrate +${f(infil, 2)}, Wachstum +${f(natural, 2)} (Mittelwert), Spieler -${used} => Soll ${f(S0946.count.Raid + infil + natural - used, 2)}, Ist ${f(S0959.count.Raid, 2)}`);
  }

  console.log("\n=== 5. Entscheidung je Sleeve (Stand 09:19 und 07:33) ===");
  for (const [tag, S] of [["07:33", S0733], ["09:19", S0919]]) {
    const st = { ...S, stamina: S.maxStamina };
    console.log(`-- Stand ${tag}: Rang ${f(S.rank, 0)}, Raid-Vorrat ${f(S.count.Raid, 1)}, Stufen ${JSON.stringify(S.level)}`);
    for (let i = 0; i < 3; i++) {
      const sl = S.sleeves[i];
      const row = [];
      for (const name of ["Tracking", "Bounty Hunter", "Retirement"]) {
        const a = ACT[name], L = S.level[name];
        const p = successChance(a, L, sl, st), t = actionTime(a, L, sl, st);
        row.push(`${name} p ${f(p)} t ${t}s ${f((p * rankGain(a, L)) / t * 3600, 1)} Rang/h`);
      }
      console.log(`  Sleeve ${i} (Kampf ${sl.skills.strength}/${sl.skills.defense}/${sl.skills.dexterity}/${sl.skills.agility}, Schock ${f(sl.shock, 1)}): ${row.join(" | ")} | Field Analysis 12,0 Rang/h`);
    }
    // Spieler: Raid gegen Rueckfall Retirement, je Sekunde und je Ausdauer
    const pr = successChance(ACT.Raid, S.level.Raid, S.player, st), tr = actionTime(ACT.Raid, S.level.Raid, S.player, st);
    const er = pr * rankGain(ACT.Raid, S.level.Raid) - (1 - pr) * rankLoss(ACT.Raid, S.level.Raid);
    const sr = C.BaseStaminaLoss * diffMult(difficulty(ACT.Raid, S.level.Raid));
    const pc = successChance(ACT.Retirement, S.level.Retirement, S.player, st), tc = actionTime(ACT.Retirement, S.level.Retirement, S.player, st);
    const ec = pc * rankGain(ACT.Retirement, S.level.Retirement);
    const scst = C.BaseStaminaLoss * diffMult(difficulty(ACT.Retirement, S.level.Retirement));
    console.log(`  Spieler Raid L${S.level.Raid}: p ${f(pr)} t ${tr}s E ${f(er, 2)} Rang/Versuch = ${f(er / tr * 3600, 0)} Rang/h, Ausdauer ${f(sr, 2)}/Versuch = ${f(er / sr, 2)} Rang/Ausdauer`);
    console.log(`  Spieler Retirement L${S.level.Retirement}: p ${f(pc)} t ${tc}s E ${f(ec, 2)} Rang/Versuch = ${f(ec / tc * 3600, 0)} Rang/h, Ausdauer ${f(scst, 2)}/Versuch = ${f(ec / scst, 2)} Rang/Ausdauer`);
    const perRaid = er - ec * (tr / tc);
    console.log(`  => ein zusaetzlicher Raid ersetzt ${f(tr / tc, 2)} Retirement-Versuche: +${f(perRaid, 2)} Rang je Raid (Zeitbasis)`);
    for (const N of [1, 2, 3]) {
      const supply = N * Math.pow(N, -0.5) / 2 * 60; // je Stunde und Aktionsart
      console.log(`  Infiltrate N=${N}: +${f(supply, 1)} Raids/h (natuerlich ${f(ACT.Raid.growthMean / 480 * 3600, 2)}/h); bei Vorratsbindung +${f(supply * perRaid, 0)} Rang/h fuer den Spieler`);
    }
  }

  console.log("\n=== 6. Trupp fuer chance-gebundene Black Ops: Support main sleeve gegen Recruitment ===");
  // Recruitment: data/GeneralActions.ts:22-31 (Dauer max(10, round(300-(cha^0,81+cha/90))), Chance cha^0,45/(team-sleeves+1)).
  // Support: SleeveSupportWork.ts:8-20 -> Bladeburner.sleeveSupport(+1 teamSize) sofort; Verluste treffen erst Menschen,
  // Sleeves halten teamSize >= sleeveSize (TeamCasualties.ts:52-57). Bonus (k+1)^0,05 (Operation.ts:96-98).
  {
    const g = 0.115; // ln-Wachstum der Black-Op-Chance je h (sleeve.js BO_CHANCE_WACHSTUM_JE_H, gemessen)
    const recT = (cha, k) => Math.max(10, Math.round(300 - (Math.pow(cha, 0.81) + cha / 90))) / Math.min(1, Math.pow(cha, 0.45) / (k + 1));
    const arrivals = (cha, n, k0 = 0) => { const a = []; let t = 0; for (let k = k0; k < k0 + n; k++) { t += recT(cha, k); a.push(t); } return a; };
    // Feuerzeit bei Luecke G (ln): kleinstes t mit g*t/3600 + 0,05*ln(team(t)+1) >= G
    function fire(G, support, recruit, cha) {
      const arr = recruit ? arrivals(cha, 6 - support, 0) : [];
      const team = (t) => support + arr.filter((x) => x <= t).length;
      for (let t = 0; t < 4 * 3600; t += 5) if (g * t / 3600 + 0.05 * Math.log(team(t) + 1) >= G) return t;
      return 4 * 3600;
    }
    for (const cha of [2, 57]) {
      const arr = arrivals(cha, 6);
      console.log(`Rekrutierer Charisma ${cha}: Mann 1..6 nach ${arr.map((x) => f(x / 60, 1)).join(" / ")} min`);
      const Gs = []; for (let G = 0.005; G <= Math.log(1.2); G += 0.005) Gs.push(G);
      const mean = (fn) => Gs.reduce((a, G) => a + fn(G), 0) / Gs.length / 60;
      const base = mean((G) => fire(G, 0, false, cha));
      console.log(`  Luecke G gleichverteilt bis ln(1,2): ohne Trupp ${f(base, 1)} min bis Feuer | 1 Rekrutierer ${f(mean((G) => fire(G, 0, true, cha)), 1)} | Support 1 ${f(mean((G) => fire(G, 1, false, cha)), 1)} | Support 2 ${f(mean((G) => fire(G, 2, false, cha)), 1)} | Support 3 ${f(mean((G) => fire(G, 3, false, cha)), 1)} | Support 2 + 1 Rekrutierer ${f(mean((G) => fire(G, 2, true, cha)), 1)} min`);
    }
  }

  console.log("\n=== 7. Gym bis Kampfwert 40 nach Knotenstart (Schock 100, Abbau 0,0001*intBonus je Zyklus) ===");
  // Exp fuer Stufe L: exp((L/mult+200)/32)-534,6 (formulas/skill.ts); Gym 10 exp/s * (100-Schock)/100 (Abschnitt 1 geeicht)
  {
    const need = (L, m) => Math.exp((L / m + 200) / 32) - 534.6;
    const decayPerH = 0.0001 * intBonus(24, 0.75) * 5 * 3600;
    for (const m of [1, 0.7, 0.5]) {
      const E = 4 * need(40, m);
      // Status quo: Gym ab Schock 100, Bonus waechst linear: Exp(t) = 36000 * (decay/100) * t^2 / 2
      const tSq = Math.sqrt(E / (10 * 3600 * decayPerH / 100 / 2));
      // Erst Recovery T1 (3-facher Abbau: 0,0001 + 0,0002 je Zyklus), dann Gym: Minimum ueber T1
      let best = { t: Infinity, T1: 0 };
      for (let T1 = 0; T1 <= 12; T1 += 0.05) {
        const b0 = 3 * decayPerH * T1 / 100, k = decayPerH / 100;
        const a = 36000 * k / 2, bq = 36000 * b0, c = -E;
        const t2 = (-bq + Math.sqrt(bq * bq - 4 * a * c)) / (2 * a);
        if (T1 + t2 < best.t) best = { t: T1 + t2, T1 };
      }
      console.log(`LevelMultiplier ${m}: 4 Werte auf 40 = ${f(E, 0)} Exp -> Status quo ${f(tSq, 2)} h; mit Recovery zuerst (${f(best.T1, 2)} h) ${f(best.t, 2)} h`);
    }
  }

  console.log("\n=== 8. Karma und Kills durch Sleeves (SleeveCrimeWork.ts:44-48, Bladeburner.ts:968-970) ===");
  {
    const hom = (sk, int) => Math.min(1, (2 * sk + 2 * sk + 0.5 * sk + 0.5 * sk + 0.025 * int) / 975 / 1 * intBonus(int, 1));
    for (const sk of [1, 40]) for (const sync of [0.01, 1]) {
      const p = hom(sk, 24);
      console.log(`Homicide Sleeve Kampf ${sk}, sync ${sync * 100} %: p ${f(p)} -> Karma ${f(p * 3 * sync / 3 * 3600, 1)}/h, Kills ${f(p / 3 * 3600, 0)}/h je Sleeve (Kills NICHT sync-skaliert)`);
    }
    console.log("Bladeburner-Kill-Aktionen: -1 Karma je Erfolg, egal wer; zaehlen NICHT als numPeopleKilled (Spielstand BN2L1: kills 0 bei Karma -145)");
  }
}
