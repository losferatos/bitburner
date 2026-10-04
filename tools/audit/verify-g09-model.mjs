// G09-Gegenpruefung (Winkel Substanz): eigener Nachbau der Bladeburner-Formeln aus
// reference/bitburner-src/src (3.0.2). Unabhaengig von sleeve-bb.mjs / blade-formeln.mjs.
// Quellen: Bladeburner/Actions/Action.ts:60-215, Bladeburner/Bladeburner.ts (Stamina 1317-1343,
// completeAction 866-1010, Diplomacy/Kammer 1185-1218), data/Operations.ts, data/Contracts.ts,
// data/Skills.ts, data/Constants.ts, Hospital/Hospital.ts, LevelableAction.ts.
import { mapEntries } from "./verify-g09-lib.mjs";

export const K = {
  stamGain: 0.0085, stamLoss: 0.285, stamDiv: 70000, diffToTime: 10,
  dmExp: 0.28, dmLin: 650, effAgiLin: 1e4, effDexLin: 1e4, effAgiExp: 0.04, effDexExp: 0.035,
  popThr: 1e9, popExp: 0.7, chaosThr: 50, growthPeriod: 480, opSpl: 2.5, ctSpl: 3, hospPerHp: 1e5,
};

const W = (h, s, d, x, a, c, i) => ({ hacking: h, strength: s, defense: d, dexterity: x, agility: a, charisma: c, intelligence: i });

// Operationen (Operations.ts) und Vertraege (Contracts.ts)
export const ACT = {
  "Raid": { t: "O", bd: 800, df: 1.045, rf: 1.1, rg: 55, rl: 2.5, hp: 50, kill: true, stealth: false, growth: 2.1,
    w: W(.1, .2, .2, .2, .2, 0, .1), d: W(.7, .8, .8, .8, .8, 0, .9) },
  "Stealth Retirement Operation": { t: "O", bd: 1000, df: 1.05, rf: 1.11, rg: 22, rl: 2, hp: 10, kill: true, stealth: true, growth: 1.05,
    w: W(.1, .1, .1, .3, .3, 0, .1), d: W(.7, .8, .8, .8, .8, 0, .9) },
  "Assassination": { t: "O", bd: 1500, df: 1.06, rf: 1.14, rg: 44, rl: 4, hp: 5, kill: true, stealth: true, growth: 1.05,
    w: W(.1, .1, .1, .3, .3, 0, .1), d: W(.6, .8, .8, .8, .8, 0, .8) },
  "Tracking": { t: "C", bd: 125, df: 1.02, rf: 1.041, rg: 0.3, rl: 0, hp: 0.5, kill: false, stealth: true, growth: 4.0,
    w: W(0, .05, .05, .35, .35, .1, .05), d: W(0, .91, .91, .91, .91, .9, 1) },
  "Bounty Hunter": { t: "C", bd: 250, df: 1.04, rf: 1.085, rg: 0.9, rl: 0, hp: 1, kill: true, stealth: false, growth: 4.0,
    w: W(0, .15, .15, .25, .25, .1, .1), d: W(0, .91, .91, .91, .91, .8, .9) },
  "Retirement": { t: "C", bd: 200, df: 1.03, rf: 1.065, rg: 0.6, rl: 0, hp: 1, kill: true, stealth: false, growth: 4.0,
    w: W(0, .2, .2, .2, .2, .1, .1), d: W(0, .91, .91, .91, .91, .8, .9) },
};

// Skill-Multiplikatoren wie Bladeburner.updateSkillMultipliers (multiplikativ ueber Skills, additiv je Stufe)
const SKILL_MULTS = {
  "Blade's Intuition": { all: 3 }, "Cloak": { stealth: 5.5 }, "Short-Circuit": { kill: 5.5 }, "Digital Observer": { op: 4 },
  "Tracer": { ct: 4 }, "Overclock": { time: -1 }, "Reaper": { str: 2, def: 2, dex: 2, agi: 2 }, "Evasive System": { dex: 4, agi: 4 },
  "Datamancer": { est: 5 }, "Cyber's Edge": { stam: 2 }, "Hands of Midas": { money: 10 }, "Hyperdrive": { exp: 10 },
};
export function skillMults(levels) {
  const m = { all: 1, stealth: 1, kill: 1, op: 1, ct: 1, time: 1, str: 1, def: 1, dex: 1, agi: 1, est: 1, stam: 1, money: 1, exp: 1 };
  for (const [name, lvl] of Object.entries(levels || {})) {
    const def = SKILL_MULTS[name];
    if (!def || !lvl) continue;
    for (const [k, base] of Object.entries(def)) m[k] = Math.max(0, m[k] * (1 + base * lvl / 100));
  }
  return m;
}

export function intBonus(int, w) { return 1 + w * Math.pow(int, 0.8) / 600; }
export function diffAt(a, L) { return a.bd * Math.pow(a.df, L - 1); }
export function diffMult(d) { return Math.pow(d, K.dmExp) + d / K.dmLin; }

// ctx: { sk:{hacking,strength,defense,dexterity,agility,charisma,intelligence}, skm, bbSucc, stamina, maxStamina,
//        city:{pop,popEst,chaos,comms}, team }
export function eff(ctx, stat) {
  const v = ctx.sk[stat];
  switch (stat) {
    case "strength": return v * ctx.skm.str;
    case "defense": return v * ctx.skm.def;
    case "dexterity": return v * ctx.skm.dex;
    case "agility": return v * ctx.skm.agi;
    default: return v;
  }
}

export function chance(a, L, ctx, est = false) {
  if (a.t === "O" && a === ACT["Raid"] && ctx.city.comms <= 0) return 0;
  let comp = 0;
  for (const stat of Object.keys(a.w)) comp += a.w[stat] * Math.pow(eff(ctx, stat), a.d[stat]);
  comp *= intBonus(ctx.sk.intelligence, 0.75);
  comp *= Math.min(1, ctx.stamina / (0.5 * ctx.maxStamina));
  if (a.t === "O") comp *= Math.pow((ctx.team || 0) + 1, 0.05);
  const pop = est ? ctx.city.popEst : ctx.city.pop;
  comp *= Math.pow(pop / K.popThr, K.popExp);
  let diff = diffAt(a, L);
  if (ctx.city.chaos > K.chaosThr) diff *= Math.sqrt(1 + ctx.city.chaos - K.chaosThr);
  comp *= ctx.skm.all;
  comp *= a.t === "O" ? ctx.skm.op : ctx.skm.ct;
  if (a.stealth) comp *= ctx.skm.stealth;
  if (a.kill) comp *= ctx.skm.kill;
  comp *= ctx.bbSucc;
  return Math.min(1, comp / diff);
}

// getSuccessRange (Action.ts:144-175): [low, high]
export function range(a, L, ctx) {
  const e = chance(a, L, ctx, true), r = chance(a, L, ctx, false);
  const diff = Math.abs(r - e);
  let low = r - diff, high = r + diff;
  let q = ctx.city.pop / ctx.city.popEst;
  if (Number.isNaN(q)) q = 0;
  if (q < 1) low *= q; else high *= Math.max(0, Math.min(q, 1e300));
  const cl = (x) => Math.max(0, Math.min(x, 1));
  return [cl(low), cl(high)];
}

export function actionTime(a, L, ctx) {
  const base = diffAt(a, L) / K.diffToTime;
  const ea = eff(ctx, "agility"), ed = eff(ctx, "dexterity");
  const statFac = 0.5 * (Math.pow(ea, K.effAgiExp) + Math.pow(ed, K.effDexExp) + ea / K.effAgiLin + ed / K.effDexLin);
  return Math.ceil(Math.max(1, base * ctx.skm.time / statFac));
}

export function stamCost(a, L) { return K.stamLoss * diffMult(diffAt(a, L)); }
export function damage(a, L) { return a.hp * diffMult(diffAt(a, L)); }   // Mittel; Spiel addOffset +-10 %
export function rankGain(a, L, bnRank = 1) { return a.rg * Math.pow(a.rf, L - 1) * bnRank; }
export function rankLossAt(a, L) { return a.rl * Math.pow(a.rf, L - 1); }

export function maxStaminaOf(ctx, staminaBonus) {
  return Math.max(1e-9, (Math.pow(eff(ctx, "agility"), 0.8) + staminaBonus) * ctx.skm.stam * (ctx.bbMaxStamMult || 1));
}
export function regenPerSec(ctx) {
  return Math.max(0, (K.stamGain + ctx.maxStamina / K.stamDiv) * Math.pow(eff(ctx, "agility"), 0.17) * ctx.skm.stam * (ctx.bbStamGainMult || 1));
}

// Krankenhaus des SPIELERS bei Schaden dmg: Hospital.ts:4-18 + PlayerObjectGeneralMethods.ts:266-284
export function hospCost(dmg, hp, money) {
  if (hp.current - dmg > 0) return 0;
  if (money < 0) return 0;
  return Math.min(money * 0.1, (hp.max - (hp.current - dmg)) * K.hospPerHp);
}

// Stufenschwelle (LevelableAction.ts:51-58)
export function succNeeded(maxLevel, spl) { return Math.ceil(0.5 * maxLevel * (2 * spl + (maxLevel - 1))); }

// Kontext aus einem Spielstand (p = PlayerSave.data)
export function ctxOf(p, cityName) {
  const bb = p.bladeburner.data || p.bladeburner;
  const cities = mapEntries(bb.cities);
  const c = cities[cityName || bb.city];
  const skm = skillMults(bb.skills);
  const ctx = {
    sk: p.skills, skm, bbSucc: p.mults.bladeburner_success_chance, bbMaxStamMult: p.mults.bladeburner_max_stamina,
    bbStamGainMult: p.mults.bladeburner_stamina_gain, stamina: bb.stamina, maxStamina: bb.maxStamina,
    city: { pop: c.pop, popEst: c.popEst, chaos: c.chaos, comms: c.comms }, team: 0,
  };
  const levels = {};
  for (const [n, o] of Object.entries({ ...mapEntries(bb.operations), ...mapEntries(bb.contracts) })) levels[n] = { level: o.level, maxLevel: o.maxLevel, count: o.count, successes: o.successes, failures: o.failures };
  return { ctx, bb, levels, cities };
}
