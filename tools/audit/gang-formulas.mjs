// Nachbau der Gang-Formeln aus Bitburner 3.0.2 (reference/bitburner-src/src).
// Jede Funktion nennt ihre Fundstelle. Reine Funktionen, keine Zufallselemente
// (Territorium/Clash wird hier NICHT simuliert: ohne Territory Warfare bleibt
// territory = 1/7, AllGangs.ts:13-41, Gang.ts:210-216 clashChance 0).

// Gang/data/Constants.ts:4-32
export const GC = {
  numFreeMembers: 3,
  recruitThresholdBase: 5,
  GangRespectToReputationRatio: 75,
  MaximumGangMembers: 12,
  CyclesPerTerritoryAndPowerUpdate: 100,
  InstallAscensionPenalty: 0.95,
  GangKarmaRequirement: -54000,
  MilliPerCycle: 200, // Constants.ts MilliPerCycle
  minCyclesToProcess: 2000 / 200,
  maxCyclesToProcess: 5000 / 200,
};

export const STATS = ["hack", "str", "def", "dex", "agi", "cha"];

// Gang/data/tasks.ts:33-398 (nur die Parameter, Gewichte in Prozent)
function T(name, isHacking, isCombat, p) {
  return {
    name, isHacking, isCombat,
    baseRespect: p.baseRespect || 0, baseWanted: p.baseWanted || 0, baseMoney: p.baseMoney || 0,
    w: { hack: p.hackWeight || 0, str: p.strWeight || 0, def: p.defWeight || 0, dex: p.dexWeight || 0, agi: p.agiWeight || 0, cha: p.chaWeight || 0 },
    difficulty: p.difficulty || 1, // GangMemberTask.ts: difficulty default 1
    territory: p.territory || { money: 1, respect: 1, wanted: 1 },
  };
}
export const TASKS = {
  "Unassigned": T("Unassigned", true, true, { hackWeight: 100 }),
  "Ransomware": T("Ransomware", true, false, { baseRespect: 0.00005, baseWanted: 0.0001, baseMoney: 3, hackWeight: 100, difficulty: 1 }),
  "Phishing": T("Phishing", true, false, { baseRespect: 0.00008, baseWanted: 0.003, baseMoney: 7.5, hackWeight: 85, chaWeight: 15, difficulty: 3.5 }),
  "Identity Theft": T("Identity Theft", true, false, { baseRespect: 0.0001, baseWanted: 0.075, baseMoney: 18, hackWeight: 80, chaWeight: 20, difficulty: 5 }),
  "DDoS Attacks": T("DDoS Attacks", true, false, { baseRespect: 0.0004, baseWanted: 0.2, hackWeight: 100, difficulty: 8 }),
  "Plant Virus": T("Plant Virus", true, false, { baseRespect: 0.0006, baseWanted: 0.4, hackWeight: 100, difficulty: 12 }),
  "Fraud & Counterfeiting": T("Fraud & Counterfeiting", true, false, { baseRespect: 0.0004, baseWanted: 0.3, baseMoney: 45, hackWeight: 80, chaWeight: 20, difficulty: 20 }),
  "Money Laundering": T("Money Laundering", true, false, { baseRespect: 0.001, baseWanted: 1.25, baseMoney: 360, hackWeight: 75, chaWeight: 25, difficulty: 25 }),
  "Cyberterrorism": T("Cyberterrorism", true, false, { baseRespect: 0.01, baseWanted: 6, hackWeight: 80, chaWeight: 20, difficulty: 36 }),
  "Ethical Hacking": T("Ethical Hacking", true, false, { baseWanted: -0.001, baseMoney: 3, hackWeight: 90, chaWeight: 10, difficulty: 1 }),
  "Mug People": T("Mug People", false, true, { baseRespect: 0.00005, baseWanted: 0.00005, baseMoney: 3.6, strWeight: 25, defWeight: 25, dexWeight: 25, agiWeight: 10, chaWeight: 15, difficulty: 1 }),
  "Deal Drugs": T("Deal Drugs", false, true, { baseRespect: 0.00006, baseWanted: 0.002, baseMoney: 15, agiWeight: 20, dexWeight: 20, chaWeight: 60, difficulty: 3.5, territory: { money: 1.2, respect: 1, wanted: 1.15 } }),
  "Strongarm Civilians": T("Strongarm Civilians", false, true, { baseRespect: 0.00004, baseWanted: 0.02, baseMoney: 7.5, hackWeight: 10, strWeight: 25, defWeight: 25, dexWeight: 20, agiWeight: 10, chaWeight: 10, difficulty: 5, territory: { money: 1.6, respect: 1.1, wanted: 1.5 } }),
  "Run a Con": T("Run a Con", false, true, { baseRespect: 0.00012, baseWanted: 0.05, baseMoney: 45, strWeight: 5, defWeight: 5, agiWeight: 25, dexWeight: 25, chaWeight: 40, difficulty: 14 }),
  "Armed Robbery": T("Armed Robbery", false, true, { baseRespect: 0.00014, baseWanted: 0.1, baseMoney: 114, hackWeight: 20, strWeight: 15, defWeight: 15, agiWeight: 10, dexWeight: 20, chaWeight: 20, difficulty: 20 }),
  "Traffick Illegal Arms": T("Traffick Illegal Arms", false, true, { baseRespect: 0.0002, baseWanted: 0.24, baseMoney: 174, hackWeight: 15, strWeight: 20, defWeight: 20, dexWeight: 20, chaWeight: 25, difficulty: 32, territory: { money: 1.4, respect: 1.3, wanted: 1.25 } }),
  "Threaten & Blackmail": T("Threaten & Blackmail", false, true, { baseRespect: 0.0002, baseWanted: 0.125, baseMoney: 72, hackWeight: 25, strWeight: 25, dexWeight: 25, chaWeight: 25, difficulty: 28 }),
  "Human Trafficking": T("Human Trafficking", false, true, { baseRespect: 0.004, baseWanted: 1.25, baseMoney: 360, hackWeight: 30, strWeight: 5, defWeight: 5, dexWeight: 30, chaWeight: 30, difficulty: 36, territory: { money: 1.5, respect: 1.5, wanted: 1.6 } }),
  "Terrorism": T("Terrorism", false, true, { baseRespect: 0.01, baseWanted: 6, hackWeight: 20, strWeight: 20, defWeight: 20, dexWeight: 20, chaWeight: 20, difficulty: 36, territory: { money: 1, respect: 2, wanted: 2 } }),
  "Vigilante Justice": T("Vigilante Justice", true, true, { baseWanted: -0.001, hackWeight: 20, strWeight: 20, defWeight: 20, dexWeight: 20, agiWeight: 20, difficulty: 1, territory: { money: 1, respect: 1, wanted: 0.9 } }),
  "Train Combat": T("Train Combat", true, true, { strWeight: 25, defWeight: 25, dexWeight: 25, agiWeight: 25, difficulty: 100 }),
  "Train Hacking": T("Train Hacking", true, true, { hackWeight: 100, difficulty: 45 }),
  "Train Charisma": T("Train Charisma", true, true, { chaWeight: 100, difficulty: 8 }),
  "Territory Warfare": T("Territory Warfare", true, true, { hackWeight: 15, strWeight: 20, defWeight: 20, dexWeight: 20, agiWeight: 20, chaWeight: 5, difficulty: 5 }),
};

// Gang.ts:419-427 getAllTaskNames
export function tasksFor(isHackingGang) {
  return Object.values(TASKS).filter((t) => t.name !== "Unassigned"
    && (isHackingGang === t.isHacking || !isHackingGang === t.isCombat));
}

// GangMember.ts:70-72
export function calculateSkill(exp, mult = 1) {
  return Math.max(Math.floor(mult * (32 * Math.log(exp + 534.5) - 200)), 1);
}
// formulas.ts:79-81
export function ascMult(points) { return Math.max(Math.pow(points / 2000, 0.5), 1); }
// formulas.ts:75-77
export function ascPointsGain(exp) { return Math.max(exp - 1000, 0); }

function statWeightOf(task, m) {
  return (task.w.hack / 100) * m.hack + (task.w.str / 100) * m.str + (task.w.def / 100) * m.def
    + (task.w.dex / 100) * m.dex + (task.w.agi / 100) * m.agi + (task.w.cha / 100) * m.cha;
}

// formulas.ts:11-13
export function wantedPenalty(g) { return g.respect / (g.respect + g.wantedLevel); }

// formulas.ts:15-31
export function respectGain(g, m, task, gangSoftcap = 1) {
  if (task.baseRespect === 0) return 0;
  let sw = statWeightOf(task, m) - 4 * task.difficulty;
  if (sw <= 0) return 0;
  const territoryMult = Math.max(0.005, Math.pow(g.territory * 100, task.territory.respect) / 100);
  const territoryPenalty = (0.2 * g.territory + 0.8) * gangSoftcap;
  if (isNaN(territoryMult) || territoryMult <= 0) return 0;
  return Math.pow(11 * task.baseRespect * sw * territoryMult * wantedPenalty(g), territoryPenalty);
}

// formulas.ts:33-54
export function wantedGain(g, m, task) {
  if (task.baseWanted === 0) return 0;
  let sw = statWeightOf(task, m) - 3.5 * task.difficulty;
  if (sw <= 0) return 0;
  const territoryMult = Math.max(0.005, Math.pow(g.territory * 100, task.territory.wanted) / 100);
  if (isNaN(territoryMult) || territoryMult <= 0) return 0;
  if (task.baseWanted < 0) return 0.4 * task.baseWanted * sw * territoryMult;
  const calc = (7 * task.baseWanted) / Math.pow(3 * sw * territoryMult, 0.8);
  return Math.min(100, calc);
}

// formulas.ts:56-73
export function moneyGain(g, m, task, gangSoftcap = 1) {
  if (task.baseMoney === 0) return 0;
  let sw = statWeightOf(task, m) - 3.2 * task.difficulty;
  if (sw <= 0) return 0;
  const territoryMult = Math.max(0.005, Math.pow(g.territory * 100, task.territory.money) / 100);
  if (isNaN(territoryMult) || territoryMult <= 0) return 0;
  const territoryPenalty = (0.2 * g.territory + 0.8) * gangSoftcap;
  return Math.pow(5 * task.baseMoney * sw * territoryMult * wantedPenalty(g), territoryPenalty);
}

// GangMember.ts:141-150 expMult, :155-210 calculateExpGain (je Zyklus * numCycles)
export function expGain(member, task, numCycles) {
  if (task.name === "Unassigned") return null;
  const diff = Math.pow(task.difficulty, 0.9) * numCycles;
  const out = {};
  for (const s of STATS) {
    const em = (member.mult[s] - 1) / 4 + 1;
    out[s] = (task.w[s] / 1500) * diff * em * ascMult(member.ascPoints[s]);
  }
  return out;
}

// Gang.ts:316-323
export function respectForNextRecruit(n) {
  if (n < GC.numFreeMembers) return 0;
  if (n >= GC.MaximumGangMembers) return Infinity;
  return Math.pow(GC.recruitThresholdBase, n - GC.numFreeMembers + 1);
}

// Gang.ts:406-416 (power ohne Territory Warfare = 1)
export function discount(respect, power = 1) {
  return Math.max(1, Math.pow(respect, 0.01) + respect / 5e6 + Math.pow(power, 0.01) + power / 1e6 - 1);
}

export function newMember(name) {
  const z = () => ({ hack: 0, str: 0, def: 0, dex: 0, agi: 0, cha: 0 });
  const one = () => ({ hack: 1, str: 1, def: 1, dex: 1, agi: 1, cha: 1 });
  const m = { name, task: "Unassigned", earnedRespect: 0, exp: z(), mult: one(), ascPoints: z(), lvl: one(), phase: "train" };
  return m;
}

// GangMember.ts:78-85
export function updateSkills(m) {
  for (const s of STATS) m.lvl[s] = calculateSkill(m.exp[s], m.mult[s] * ascMult(m.ascPoints[s]));
}

// GangMember.ts:261-285 (Verhaeltnis neuer/alter Asc-Mult je Wert)
export function ascensionResult(m) {
  const r = {};
  for (const s of STATS) r[s] = ascMult(m.ascPoints[s] + ascPointsGain(m.exp[s])) / ascMult(m.ascPoints[s]);
  return r;
}

// GangMember.ts:298-341 + Gang.ts:390-397
export function ascend(gang, m) {
  for (const s of STATS) m.ascPoints[s] += ascPointsGain(m.exp[s]);
  for (const s of STATS) { m.mult[s] = 1; m.exp[s] = 0; } // keine Mitglieds-Augs in diesem Modell
  updateSkills(m);
  const resp = m.earnedRespect;
  m.earnedRespect = 0;
  gang.respect = Math.max(1, gang.respect - resp);
}

// Prestige.ts:130-143 (Einbau: Asc-Punkte * 0,95)
export function installPenalty(gang) {
  for (const m of gang.members) for (const s of STATS) m.ascPoints[s] *= GC.InstallAscensionPenalty;
  for (const m of gang.members) updateSkills(m);
}
