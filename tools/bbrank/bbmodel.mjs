/**
 * Nachbau der Bladeburner-Rangmechanik aus Bitburner v3.0.1.
 * Quellen (reference/v301/src/Bladeburner/...):
 *   Formulas.ts:9-28              calculateActionRankGain
 *   Actions/Action.ts:105-122     getActionTime
 *   Actions/Action.ts:169-196     getSuccessChance
 *   Actions/LevelableAction.ts:246-261 setMaxLevel / getDifficulty
 *   Bladeburner.ts:167-169        calculateStaminaPenalty
 *   Bladeburner.ts:776-786        updateSkillMultipliers
 *   data/Constants.ts             alle Konstanten
 */

// --- Konstanten (data/Constants.ts) ---
const C = {
  DifficultyToTimeFactor: 10,
  EffAgiLinearFactor: 10e3, EffDexLinearFactor: 10e3,
  EffAgiExponentialFactor: 0.04, EffDexExponentialFactor: 0.035,
  PopulationThreshold: 1e9, PopulationExponent: 0.7, ChaosThreshold: 50,
  ContractSuccessesPerLevel: 3, OperationSuccessesPerLevel: 2.5,
  RanksPerSkillPoint: 3,
  DiffMultExponentialFactor: 0.28, DiffMultLinearFactor: 650,
  BaseStaminaLoss: 0.285, StaminaGainPerSecond: 0.0085, MaxStaminaToGainFactor: 70000,
};

// --- Aktionsdaten (data/Contracts.ts, data/Operations.ts) ---
const ACTIONS = {
  "Tracking": {kind:"C", baseDifficulty:125, difficultyFac:1.02, rewardFac:1.041, rankGain:0.3, rankLoss:0, hpLoss:0.5,
    w:{hacking:0,strength:.05,defense:.05,dexterity:.35,agility:.35,charisma:.1,intelligence:.05},
    d:{hacking:0,strength:.91,defense:.91,dexterity:.91,agility:.91,charisma:.9,intelligence:1},
    stealth:true, kill:false},
  "Bounty Hunter": {kind:"C", baseDifficulty:250, difficultyFac:1.04, rewardFac:1.085, rankGain:0.9, rankLoss:0, hpLoss:1,
    w:{hacking:0,strength:.15,defense:.15,dexterity:.25,agility:.25,charisma:.1,intelligence:.1},
    d:{hacking:0,strength:.91,defense:.91,dexterity:.91,agility:.91,charisma:.8,intelligence:.9},
    stealth:false, kill:true},
  "Retirement": {kind:"C", baseDifficulty:200, difficultyFac:1.03, rewardFac:1.065, rankGain:0.6, rankLoss:0, hpLoss:1,
    w:{hacking:0,strength:.2,defense:.2,dexterity:.2,agility:.2,charisma:.1,intelligence:.1},
    d:{hacking:0,strength:.91,defense:.91,dexterity:.91,agility:.91,charisma:.8,intelligence:.9},
    stealth:false, kill:true},
  "Investigation": {kind:"O", baseDifficulty:400, difficultyFac:1.03, rewardFac:1.07, rankGain:2.2, rankLoss:0.2, hpLoss:0,
    w:{hacking:.25,strength:.05,defense:.05,dexterity:.2,agility:.1,charisma:.25,intelligence:.1},
    d:{hacking:.85,strength:.9,defense:.9,dexterity:.9,agility:.9,charisma:.7,intelligence:.9},
    stealth:true, kill:false},
  "Undercover Operation": {kind:"O", baseDifficulty:500, difficultyFac:1.04, rewardFac:1.09, rankGain:4.4, rankLoss:0.4, hpLoss:2,
    w:{hacking:.2,strength:.05,defense:.05,dexterity:.2,agility:.2,charisma:.2,intelligence:.1},
    d:{hacking:.8,strength:.9,defense:.9,dexterity:.9,agility:.9,charisma:.7,intelligence:.9},
    stealth:true, kill:false},
  "Sting Operation": {kind:"O", baseDifficulty:650, difficultyFac:1.04, rewardFac:1.095, rankGain:5.5, rankLoss:0.5, hpLoss:2.5,
    w:{hacking:.25,strength:.05,defense:.05,dexterity:.25,agility:.1,charisma:.2,intelligence:.1},
    d:{hacking:.8,strength:.85,defense:.85,dexterity:.85,agility:.85,charisma:.7,intelligence:.9},
    stealth:true, kill:false},
  "Raid": {kind:"O", baseDifficulty:800, difficultyFac:1.045, rewardFac:1.1, rankGain:55, rankLoss:2.5, hpLoss:50,
    w:{hacking:.1,strength:.2,defense:.2,dexterity:.2,agility:.2,charisma:0,intelligence:.1},
    d:{hacking:.7,strength:.8,defense:.8,dexterity:.8,agility:.8,charisma:0,intelligence:.9},
    stealth:false, kill:true, needsComms:true},
  "Stealth Retirement Operation": {kind:"O", baseDifficulty:1000, difficultyFac:1.05, rewardFac:1.11, rankGain:22, rankLoss:2, hpLoss:10,
    w:{hacking:.1,strength:.1,defense:.1,dexterity:.3,agility:.3,charisma:0,intelligence:.1},
    d:{hacking:.7,strength:.8,defense:.8,dexterity:.8,agility:.8,charisma:0,intelligence:.9},
    stealth:true, kill:true},
  "Assassination": {kind:"O", baseDifficulty:1500, difficultyFac:1.06, rewardFac:1.14, rankGain:44, rankLoss:4, hpLoss:5,
    w:{hacking:.1,strength:.1,defense:.1,dexterity:.3,agility:.3,charisma:0,intelligence:.1},
    d:{hacking:.6,strength:.8,defense:.8,dexterity:.8,agility:.8,charisma:0,intelligence:.8},
    stealth:true, kill:true},
};

// --- Skill-Multiplikatoren (data/Skills.ts + Bladeburner.ts:776-786) ---
const SKILL_MULTS = {
  "Blade's Intuition": {SuccessChanceAll:3},
  "Cloak": {SuccessChanceStealth:5.5},
  "Short-Circuit": {SuccessChanceKill:5.5},
  "Digital Observer": {SuccessChanceOperation:4},
  "Tracer": {SuccessChanceContract:4},
  "Overclock": {ActionTime:-1},
  "Reaper": {EffStr:2,EffDef:2,EffDex:2,EffAgi:2},
  "Evasive System": {EffDex:4,EffAgi:4},
  "Datamancer": {SuccessChanceEstimate:5},
  "Cyber's Edge": {Stamina:2},
  "Hands of Midas": {Money:10},
  "Hyperdrive": {ExpGain:10},
};
export function skillMultipliers(levels) {
  const m = {};
  for (const [name, lvl] of Object.entries(levels)) {
    if (!lvl) continue;
    const spec = SKILL_MULTS[name]; if (!spec) continue;
    for (const [k, base] of Object.entries(spec)) m[k] = (m[k] ?? 1) * (1 + (base * lvl) / 100);
  }
  return m;
}
const mult = (m, k) => m[k] ?? 1;

export function effSkill(skills, m, name) {
  switch (name) {
    case "strength":  return skills.strength  * mult(m,"EffStr");
    case "defense":   return skills.defense   * mult(m,"EffDef");
    case "dexterity": return skills.dexterity * mult(m,"EffDex");
    case "agility":   return skills.agility   * mult(m,"EffAgi");
    case "charisma":  return skills.charisma  * mult(m,"EffCha");
    default:          return skills[name];
  }
}
export const intBonus = (i, w=1) => 1 + (w * Math.pow(i, 0.8)) / 600;
export const difficultyOf = (a, level) => a.baseDifficulty * Math.pow(a.difficultyFac, level - 1);

/** Action.ts:105-122 */
export function actionTime(a, level, skills, m) {
  const base = difficultyOf(a, level) / C.DifficultyToTimeFactor;
  const skillFac = mult(m, "ActionTime");
  const eA = effSkill(skills, m, "agility"), eD = effSkill(skills, m, "dexterity");
  const statFac = 0.5 * (Math.pow(eA, C.EffAgiExponentialFactor) + Math.pow(eD, C.EffDexExponentialFactor)
                       + eA / C.EffAgiLinearFactor + eD / C.EffDexLinearFactor);
  return Math.ceil(Math.max(1, (base * skillFac) / statFac));
}

/** Action.ts:169-196 (+ Operation.ts:92-98) */
export function successChance(a, level, skills, m, env) {
  if (a.needsComms && env.comms <= 0) return 0;
  let difficulty = difficultyOf(a, level);
  let comp = 0;
  for (const st of Object.keys(skills)) comp += (a.w[st] ?? 0) * Math.pow(effSkill(skills, m, st), a.d[st] ?? 0.9);
  comp *= intBonus(skills.intelligence, 0.75);
  comp *= Math.min(1, env.stamina / (0.5 * env.maxStamina));
  if (a.kind === "O") comp *= Math.pow((env.teamCount ?? 0) + 1, 0.05);
  comp *= Math.pow(env.pop / C.PopulationThreshold, C.PopulationExponent);
  if (env.chaos > C.ChaosThreshold) difficulty *= Math.pow(1 + (env.chaos - C.ChaosThreshold), 0.5);
  comp *= mult(m, "SuccessChanceAll");
  if (a.kind === "C") comp *= mult(m, "SuccessChanceContract");
  if (a.kind === "O") comp *= mult(m, "SuccessChanceOperation");
  if (a.stealth) comp *= mult(m, "SuccessChanceStealth");
  if (a.kill)    comp *= mult(m, "SuccessChanceKill");
  comp *= env.bbSuccessMult ?? 1;
  return Math.min(1, comp / difficulty);
}

/** Formulas.ts:9-28 - DER Ranggewinn. Kein Term enthaelt den aktuellen Rang. */
export function rankGain(a, level, bnRankMult) {
  return a.rankGain * Math.pow(a.rewardFac, level - 1) * bnRankMult;
}
/** Formulas.ts:30-44 - Rangverlust, OHNE BitNode-Multiplikator. */
export function rankLoss(a, level) {
  return a.rankLoss * Math.pow(a.rewardFac, level - 1);
}

/** LevelableAction.ts:251-253 */
export const successesNeeded = (maxLevel, per) => Math.ceil(0.5 * maxLevel * (2 * per + (maxLevel - 1)));
export function levelFromSuccesses(successes, per) {
  let L = 1; while (successes >= successesNeeded(L, per)) L++;
  return L;
}

/** Erwartungswert Rang je Sekunde bei Dauerbetrieb einer Aktion. */
export function rankRate(a, level, skills, m, env, bnRankMult) {
  const p = successChance(a, level, skills, m, env);
  const t = actionTime(a, level, skills, m);
  const per = p * rankGain(a, level, bnRankMult) - (1 - p) * rankLoss(a, level);
  return { p, t, per, perHour: (per / t) * 3600 };
}

export { ACTIONS, C };
