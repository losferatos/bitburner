/**
 * Zeitschritt-Simulation des Bladeburner-Rangs. Erwartungswerte statt Wuerfeln,
 * damit das Ergebnis reproduzierbar ist. Bildet nach:
 *   Bladeburner.ts:1377-1411  process() - 1 Sekunde je Tick, Ausdauer, count-Wachstum
 *   Bladeburner.ts:1296-1317  processAction()
 *   Bladeburner.ts:891-1013   completeAction() - Erfolg/Misserfolg, Stufenaufstieg
 */
import { ACTIONS, C, skillMultipliers, actionTime, successChance, rankGain, rankLoss,
         successesNeeded, effSkill, difficultyOf } from "./bbmodel.mjs";

export function staminaGainPerSecond(skills, m, maxStamina, staminaGainMult = 1) {
  const eA = effSkill(skills, m, "agility");
  return (C.StaminaGainPerSecond + maxStamina / C.MaxStaminaToGainFactor)
       * Math.pow(eA, 0.17) * (m.Stamina ?? 1) * staminaGainMult;
}
export function maxStaminaOf(skills, m, staminaBonus = 0, maxStaminaMult = 1) {
  return Math.max(1e-9, (Math.pow(effSkill(skills, m, "agility"), 0.8) + staminaBonus)
                        * (m.Stamina ?? 1) * maxStaminaMult);
}
const diffMult = (d) => Math.pow(d, C.DiffMultExponentialFactor) + d / C.DiffMultLinearFactor;

/**
 * @param cfg {skills, bbSkills, levels, successes, env, bnRankMult, hours, policy}
 * policy: "greedy" = jederzeit die Aktion mit dem hoechsten E[Rang]/s,
 *         "contractsOnly" = nur Contracts (das, was der Bot tut)
 */
export function simulate(cfg) {
  const m = skillMultipliers(cfg.bbSkills);
  const skills = cfg.skills;
  const maxStamina = maxStaminaOf(skills, m, cfg.staminaBonus ?? 0);
  const regen = staminaGainPerSecond(skills, m, maxStamina);
  const succ = {...cfg.successes};
  const lvl  = {...cfg.levels};
  const names = cfg.policy === "contractsOnly"
    ? Object.keys(ACTIONS).filter(n => ACTIONS[n].kind === "C")
    : Object.keys(ACTIONS);

  let rank = cfg.rank, stamina = cfg.stamina ?? maxStamina, t = 0;
  const T = (cfg.hours ?? 24) * 3600;
  let restSec = 0, workSec = 0;
  const trace = [];
  let nextMark = 3600;

  while (t < T) {
    const env = {...cfg.env, stamina, maxStamina};
    // Beste Aktion nach E[Rang] je Sekunde
    let best = null;
    for (const n of names) {
      const a = ACTIONS[n], L = lvl[n] ?? 1;
      const p = successChance(a, L, skills, m, env);
      const tt = actionTime(a, L, skills, m);
      const per = p * rankGain(a, L, cfg.bnRankMult) - (1 - p) * rankLoss(a, L);
      const rate = per / tt;
      if (!best || rate > best.rate) best = {n, a, L, p, tt, per, rate};
    }
    // Ausdauerkosten der besten Aktion
    const cost = C.BaseStaminaLoss * diffMult(difficultyOf(best.a, best.L));
    const netto = cost - regen * best.tt;
    // Reicht die Ausdauer, ohne unter die Straf-Schwelle (50 %) zu rutschen?
    if (stamina - cost < 0.5 * maxStamina && netto > 0) {
      // Rasten: Hyperbolic Regeneration Chamber, 60 s, +1 % maxStamina, kein Rang
      stamina = Math.min(maxStamina, stamina + regen * 60 + maxStamina * 0.01);
      t += 60; restSec += 60;
    } else {
      stamina = Math.max(0, Math.min(maxStamina, stamina - cost + regen * best.tt));
      rank += best.per;
      succ[best.n] = (succ[best.n] ?? 0) + best.p;      // Erwartungswert an Erfolgen
      const per = best.a.kind === "O" ? C.OperationSuccessesPerLevel : C.ContractSuccessesPerLevel;
      while (succ[best.n] >= successesNeeded(lvl[best.n] ?? 1, per)) lvl[best.n] = (lvl[best.n] ?? 1) + 1;
      t += best.tt; workSec += best.tt;
    }
    if (t >= nextMark) {
      trace.push({h: t/3600, rank, best: best.n, L: best.L, p: best.p, tt: best.tt});
      nextMark += 3600;
    }
    if (trace.length > 100000) break;
  }
  return {rank, lvl, succ, hours: t/3600, duty: workSec/(workSec+restSec), maxStamina, regen, trace};
}
