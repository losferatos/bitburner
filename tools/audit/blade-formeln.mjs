// Audit 03.10.2026 (BLADE): Nachbau der Bladeburner-Formeln aus
// reference/bitburner-src 3.0.2. Jede Funktion nennt ihre Fundstelle.
// Geeicht in blade-eichung.mjs gegen echte Spielstandwerte.
//
// Konstanten: Bladeburner/data/Constants.ts
export const K = {
  StaminaGainPerSecond: 0.0085, BaseStaminaLoss: 0.285, MaxStaminaToGainFactor: 70000,
  DifficultyToTimeFactor: 10, DiffMultExponentialFactor: 0.28, DiffMultLinearFactor: 650,
  EffAgiLinearFactor: 10e3, EffDexLinearFactor: 10e3, EffAgiExponentialFactor: 0.04, EffDexExponentialFactor: 0.035,
  PopulationThreshold: 1e9, PopulationExponent: 0.7, ChaosThreshold: 50,
  ActionCountGrowthPeriod: 480, RanksPerSkillPoint: 3, HrcStaminaGain: 1, HospitalCostPerHp: 100e3,
};

// Aktionsdaten: data/Contracts.ts, data/Operations.ts, data/BlackOperations.ts (Auszug)
const W = (h, s, d, x, a, c, i) => ({ hacking: h, strength: s, defense: d, dexterity: x, agility: a, charisma: c, intelligence: i });
export const AKTIONEN = {
  "Tracking": { typ: "Contracts", baseDifficulty: 125, difficultyFac: 1.02, rewardFac: 1.041, rankGain: 0.3, rankLoss: 0, hpLoss: 0.5,
    weights: W(0, .05, .05, .35, .35, .1, .05), decays: W(0, .91, .91, .91, .91, .9, 1), isStealth: true, isKill: false, growth: [5, 75] },
  "Bounty Hunter": { typ: "Contracts", baseDifficulty: 250, difficultyFac: 1.04, rewardFac: 1.085, rankGain: 0.9, rankLoss: 0, hpLoss: 1,
    weights: W(0, .15, .15, .25, .25, .1, .1), decays: W(0, .91, .91, .91, .91, .8, .9), isStealth: false, isKill: true, growth: [5, 75] },
  "Retirement": { typ: "Contracts", baseDifficulty: 200, difficultyFac: 1.03, rewardFac: 1.065, rankGain: 0.6, rankLoss: 0, hpLoss: 1,
    weights: W(0, .2, .2, .2, .2, .1, .1), decays: W(0, .91, .91, .91, .91, .8, .9), isStealth: false, isKill: true, growth: [5, 75] },
  "Investigation": { typ: "Operations", baseDifficulty: 400, difficultyFac: 1.03, rewardFac: 1.07, rankGain: 2.2, rankLoss: 0.2, hpLoss: 0,
    weights: W(.25, .05, .05, .2, .1, .25, .1), decays: W(.85, .9, .9, .9, .9, .7, .9), isStealth: true, isKill: false, growth: [10, 40] },
  "Undercover Operation": { typ: "Operations", baseDifficulty: 500, difficultyFac: 1.04, rewardFac: 1.09, rankGain: 4.4, rankLoss: 0.4, hpLoss: 2,
    weights: W(.2, .05, .05, .2, .2, .2, .1), decays: W(.8, .9, .9, .9, .9, .7, .9), isStealth: true, isKill: false, growth: [10, 40] },
  "Sting Operation": { typ: "Operations", baseDifficulty: 650, difficultyFac: 1.04, rewardFac: 1.095, rankGain: 5.5, rankLoss: 0.5, hpLoss: 2.5,
    weights: W(.25, .05, .05, .25, .1, .2, .1), decays: W(.8, .85, .85, .85, .85, .7, .9), isStealth: true, isKill: false, growth: [3, 40] },
  "Raid": { typ: "Operations", baseDifficulty: 800, difficultyFac: 1.045, rewardFac: 1.1, rankGain: 55, rankLoss: 2.5, hpLoss: 50,
    weights: W(.1, .2, .2, .2, .2, 0, .1), decays: W(.7, .8, .8, .8, .8, 0, .9), isStealth: false, isKill: true, growth: [2, 40] },
  "Stealth Retirement Operation": { typ: "Operations", baseDifficulty: 1000, difficultyFac: 1.05, rewardFac: 1.11, rankGain: 22, rankLoss: 2, hpLoss: 10,
    weights: W(.1, .1, .1, .3, .3, 0, .1), decays: W(.7, .8, .8, .8, .8, 0, .9), isStealth: true, isKill: true, growth: [1, 20] },
  "Assassination": { typ: "Operations", baseDifficulty: 1500, difficultyFac: 1.06, rewardFac: 1.14, rankGain: 44, rankLoss: 4, hpLoss: 5,
    weights: W(.1, .1, .1, .3, .3, 0, .1), decays: W(.6, .8, .8, .8, .8, 0, .8), isStealth: true, isKill: true, growth: [1, 20] },
  "Operation Typhoon": { typ: "Black Operations", baseDifficulty: 2000, rankGain: 50, rankLoss: 10, hpLoss: 100,
    weights: W(.1, .2, .2, .2, .2, 0, .1), decays: W(.6, .8, .8, .8, .8, 0, .75), isStealth: false, isKill: true },
};

// data/Skills.ts: baseCost, costInc, mults (Prozent je Stufe)
export const SKILLS = {
  "Blade's Intuition": { baseCost: 3, costInc: 2.1, mults: { SuccessChanceAll: 3 } },
  "Cloak": { baseCost: 2, costInc: 1.1, mults: { SuccessChanceStealth: 5.5 } },
  "Short-Circuit": { baseCost: 2, costInc: 2.1, mults: { SuccessChanceKill: 5.5 } },
  "Digital Observer": { baseCost: 2, costInc: 2.1, mults: { SuccessChanceOperation: 4 } },
  "Tracer": { baseCost: 2, costInc: 2.1, mults: { SuccessChanceContract: 4 } },
  "Overclock": { baseCost: 3, costInc: 1.4, maxLvl: 90, mults: { ActionTime: -1 } },
  "Reaper": { baseCost: 2, costInc: 2.1, mults: { EffStr: 2, EffDef: 2, EffDex: 2, EffAgi: 2 } },
  "Evasive System": { baseCost: 2, costInc: 2.1, mults: { EffDex: 4, EffAgi: 4 } },
  "Datamancer": { baseCost: 3, costInc: 1, mults: { SuccessChanceEstimate: 5 } },
  "Cyber's Edge": { baseCost: 1, costInc: 3, mults: { Stamina: 2 } },
  "Hands of Midas": { baseCost: 2, costInc: 2.5, mults: { Money: 10 } },
  "Hyperdrive": { baseCost: 1, costInc: 2.5, mults: { ExpGain: 10 } },
};

// Bladeburner.ts:774-784 updateSkillMultipliers - multiplikativ je Faehigkeit
export function skillMults(skills) {
  const m = {};
  for (const [name, lvl] of Object.entries(skills || {})) {
    if (!lvl || !SKILLS[name]) continue;
    for (const [mn, base] of Object.entries(SKILLS[name].mults)) {
      m[mn] = Math.max(0, (m[mn] ?? 1) * (1 + base * lvl / 100));
    }
  }
  return m;
}
const sm = (m, n) => m[n] ?? 1;

// Skill.ts:37-81 calculateCost (count Stufen ab currentLevel)
export function skillCost(name, lvl, count = 1, bnSkillCost = 1) {
  const s = SKILLS[name];
  return Math.round(count * bnSkillCost * (s.baseCost + s.costInc * (lvl + (count - 1) / 2)));
}

// Bladeburner.ts:757-772 getEffectiveSkillLevel
export function effSkills(skills, m) {
  return {
    hacking: skills.hacking, strength: skills.strength * sm(m, "EffStr"), defense: skills.defense * sm(m, "EffDef"),
    dexterity: skills.dexterity * sm(m, "EffDex"), agility: skills.agility * sm(m, "EffAgi"),
    charisma: skills.charisma * sm(m, "EffCha"), intelligence: skills.intelligence,
  };
}

export function difficulty(a, level = 1) {
  if (a.typ === "Black Operations" || !a.difficultyFac) return a.baseDifficulty;
  return a.baseDifficulty * Math.pow(a.difficultyFac, level - 1);   // LevelableAction.ts:58-64
}
export function diffMult(d) {
  return Math.pow(d, K.DiffMultExponentialFactor) + d / K.DiffMultLinearFactor;   // Bladeburner.ts:711-713
}

/**
 * Action.ts:169-196 getSuccessChance (+ Operation.ts:63-68 Raid ohne comms,
 * BlackOperation.ts:55-61 Pop/Chaos = 1, Operation.ts:96-98 Truppbonus).
 * p = { skills, mults: {bladeburner_success_chance} }, bb = { skills, stamina, maxStamina },
 * city = { pop, popEst, chaos, comms }
 */
export function successChance(a, level, p, bb, city, { est = false, teamCount = 0 } = {}) {
  const m = skillMults(bb.skills);
  const eff = effSkills(p.skills, m);
  let d = difficulty(a, level);
  let c = 0;
  for (const st of ["hacking", "strength", "defense", "dexterity", "agility", "charisma", "intelligence"]) {
    c += a.weights[st] * Math.pow(eff[st], a.decays[st]);
  }
  c *= 1 + 0.75 * Math.pow(p.skills.intelligence, 0.8) / 600;              // formulas/intelligence.ts
  c *= Math.min(1, bb.stamina / (0.5 * bb.maxStamina));                      // Bladeburner.ts:167-169
  if (a.typ === "Operations" || a.typ === "Black Operations") c *= Math.pow(teamCount + 1, 0.05);
  if (a.typ !== "Black Operations") {
    const pop = est ? city.popEst : city.pop;
    c *= Math.pow(pop / K.PopulationThreshold, K.PopulationExponent);
    if (city.chaos > K.ChaosThreshold) d *= Math.pow(1 + (city.chaos - K.ChaosThreshold), 0.5);
    if (a === AKTIONEN.Raid && city.comms <= 0) return 0;
  }
  c *= sm(m, "SuccessChanceAll");
  if (a.typ === "Contracts") c *= sm(m, "SuccessChanceContract");
  else c *= sm(m, "SuccessChanceOperation");
  if (a.isStealth) c *= sm(m, "SuccessChanceStealth");
  if (a.isKill) c *= sm(m, "SuccessChanceKill");
  c *= p.mults.bladeburner_success_chance ?? 1;
  return Math.min(1, c / d);
}

// Action.ts:144-167 getSuccessRange
export function successRange(a, level, p, bb, city, opt = {}) {
  const clamp = (x) => Math.max(0, Math.min(x, 1));
  const est = successChance(a, level, p, bb, city, { ...opt, est: true });
  const real = successChance(a, level, p, bb, city, { ...opt, est: false });
  const diff = Math.abs(real - est);
  let low = real - diff, high = real + diff;
  let r = city.pop / city.popEst;
  if (Number.isNaN(r)) r = 0;
  if (r < 1) low *= r; else high *= Math.min(r, Number.MAX_VALUE);
  return [clamp(low), clamp(high), real];
}

// Action.ts:105-122 getActionTime (Sekunden)
export function actionTime(a, level, p, bb) {
  const m = skillMults(bb.skills);
  const eff = effSkills(p.skills, m);
  let base = difficulty(a, level) / K.DifficultyToTimeFactor;
  const skillFac = sm(m, "ActionTime");
  const statFac = 0.5 * (Math.pow(eff.agility, K.EffAgiExponentialFactor) + Math.pow(eff.dexterity, K.EffDexExponentialFactor)
    + eff.agility / K.EffAgiLinearFactor + eff.dexterity / K.EffDexLinearFactor);
  base = Math.max(1, base * skillFac / statFac);
  const penalty = a.typ === "Black Operations" ? 1.5 : 1;
  return Math.ceil(base * penalty);
}

// Bladeburner.ts:1327-1335 calculateMaxStamina, :1317-1325 calculateStaminaGainPerSecond
export function maxStamina(p, bb) {
  const m = skillMults(bb.skills);
  const effAgi = p.skills.agility * sm(m, "EffAgi");
  return Math.max(1e-9, (Math.pow(effAgi, 0.8) + (bb.staminaBonus || 0)) * sm(m, "Stamina") * (p.mults.bladeburner_max_stamina ?? 1));
}
export function staminaGainPerSecond(p, bb, maxSt) {
  const m = skillMults(bb.skills);
  const effAgi = p.skills.agility * sm(m, "EffAgi");
  const gain = (K.StaminaGainPerSecond + maxSt / K.MaxStaminaToGainFactor) * Math.pow(effAgi, 0.17);
  return Math.max(0, gain * sm(m, "Stamina") * (p.mults.bladeburner_stamina_gain ?? 1));
}
// Formulas.ts:9-44 (BN-Faktor nur auf Gewinn)
export function rankGain(a, level, bnRank = 1) {
  if (a.typ === "Black Operations") return a.rankGain * bnRank;
  return a.rankGain * Math.pow(a.rewardFac, level - 1) * bnRank;
}
export function rankLoss(a, level) {
  if (a.typ === "Black Operations") return a.rankLoss;
  return a.rankLoss * Math.pow(a.rewardFac, level - 1);
}
// Bladeburner.ts:920-921 Ausdauer je Versuch (nur Spieler)
export function staminaCost(a, level) { return K.BaseStaminaLoss * diffMult(difficulty(a, level)); }
// Bladeburner.ts:981-988 + Hospital.ts:4-18 + PlayerObjectGeneralMethods.ts:266-284:
// Schaden bei Fehlschlag, Krankenhauskosten des SPIELERS (hp faellt erst unter 0, dann
// wird mit (max - current) * 1e5 gerechnet, current ist dabei negativ)
export function hospitalCost(a, level, hp, money) {
  const dmg = Math.ceil(a.hpLoss * diffMult(difficulty(a, level)));   // ohne addOffset (+-10 %)
  if (hp.current - dmg > 0) return { dmg, kosten: 0, hospital: false };
  return { dmg, kosten: Math.min(money * 0.1, (hp.max - (hp.current - dmg)) * K.HospitalCostPerHp), hospital: true };
}
