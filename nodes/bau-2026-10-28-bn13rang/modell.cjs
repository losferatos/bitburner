// Nachbau der Bladeburner-Erfolgsformel (Actions/Action.ts getSuccessChance, getActionTime,
// Bladeburner.ts completeAction) aus reference/bitburner-src. Nur lesen, keine Spielaktion.
// Eichung: siehe eichen.js (Typhoon 0,136 und Raid-9 0,085 aus data/blade.json).
const W = (h, s, d, x, a, c, i) => ({ hacking: h, strength: s, defense: d, dexterity: x, agility: a, charisma: c, intelligence: i });
const ACT = {
  // typ, name, baseDiff, diffFac, rewardFac, rankGain, rankLoss, hpLoss, weights, decays, stealth, kill, growth[min,max]/10, count0
  "Tracking": { t: "C", bd: 125, df: 1.02, rf: 1.041, rg: 0.3, rl: 0, hp: 0.5, w: W(0, .05, .05, .35, .35, .1, .05), d: W(0, .91, .91, .91, .91, .9, 1), stealth: 1, kill: 0, gr: [5, 75] },
  "Bounty Hunter": { t: "C", bd: 250, df: 1.04, rf: 1.085, rg: 0.9, rl: 0, hp: 1, w: W(0, .15, .15, .25, .25, .1, .1), d: W(0, .91, .91, .91, .91, .8, .9), stealth: 0, kill: 1, gr: [5, 75] },
  "Retirement": { t: "C", bd: 200, df: 1.03, rf: 1.065, rg: 0.6, rl: 0, hp: 1, w: W(0, .2, .2, .2, .2, .1, .1), d: W(0, .91, .91, .91, .91, .8, .9), stealth: 0, kill: 1, gr: [5, 75] },
  "Investigation": { t: "O", bd: 400, df: 1.03, rf: 1.07, rg: 2.2, rl: 0.2, hp: 0, w: W(.25, .05, .05, .2, .1, .25, .1), d: W(.85, .9, .9, .9, .9, .7, .9), stealth: 1, kill: 0, gr: [10, 40] },
  "Undercover Operation": { t: "O", bd: 500, df: 1.04, rf: 1.09, rg: 4.4, rl: 0.4, hp: 2, w: W(.2, .05, .05, .2, .2, .2, .1), d: W(.8, .9, .9, .9, .9, .7, .9), stealth: 1, kill: 0, gr: [10, 40] },
  "Sting Operation": { t: "O", bd: 650, df: 1.04, rf: 1.095, rg: 5.5, rl: 0.5, hp: 2.5, w: W(.25, .05, .05, .25, .1, .2, .1), d: W(.8, .85, .85, .85, .85, .7, .9), stealth: 1, kill: 0, gr: [3, 40] },
  "Raid": { t: "O", bd: 800, df: 1.045, rf: 1.1, rg: 55, rl: 2.5, hp: 50, w: W(.1, .2, .2, .2, .2, 0, .1), d: W(.7, .8, .8, .8, .8, 0, .9), stealth: 0, kill: 1, gr: [2, 40] },
  "Stealth Retirement Operation": { t: "O", bd: 1000, df: 1.05, rf: 1.11, rg: 22, rl: 2, hp: 10, w: W(.1, .1, .1, .3, .3, 0, .1), d: W(.7, .8, .8, .8, .8, 0, .9), stealth: 1, kill: 1, gr: [1, 20] },
  "Assassination": { t: "O", bd: 1500, df: 1.06, rf: 1.14, rg: 44, rl: 4, hp: 5, w: W(.1, .1, .1, .3, .3, 0, .1), d: W(.6, .8, .8, .8, .8, 0, .8), stealth: 1, kill: 1, gr: [1, 20] },
  "Operation Typhoon": { t: "B", bd: 2000, df: 1, rf: 1, rg: 50, rl: 10, hp: 100, w: W(.1, .2, .2, .2, .2, 0, .1), d: W(.6, .8, .8, .8, .8, 0, .75), stealth: 0, kill: 1 },
};
const SKILL = { // Bladeburner-Faehigkeiten: mult je Stufe in Prozent
  "Blade's Intuition": { all: 3 }, "Cloak": { stealth: 5.5 }, "Short-Circuit": { kill: 5.5 },
  "Digital Observer": { op: 4 }, "Tracer": { contract: 4 }, "Overclock": { time: -1 },
  "Reaper": { str: 2, def: 2, dex: 2, agi: 2 }, "Evasive System": { dex: 4, agi: 4 },
  "Cyber's Edge": { stamina: 2 }, "Hyperdrive": { exp: 10 },
};
function skillMults(levels) {
  const m = {};
  for (const [n, lv] of Object.entries(levels)) {
    const s = SKILL[n]; if (!s || !lv) continue;
    for (const [k, v] of Object.entries(s)) m[k] = (m[k] ?? 1) * (1 + v * lv / 100); // sequenziell multiplikativ wie updateSkillMultipliers
  }
  return m;
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function intBonus(int, wt) { return 1 + wt * Math.pow(int, 0.8) / 600; }
// st: { skills{...}, levels{bb skills}, stamina, maxStamina, augMult(bladeburner_success_chance), city{pop,popEst,chaos,comms}, teamCount }
function effSkill(st, m, stat) {
  const f = { strength: m.str, defense: m.def, dexterity: m.dex, agility: m.agi, charisma: m.cha }[stat] ?? 1;
  return st.skills[stat] * (f ?? 1);
}
function difficulty(a, lvl) { return a.bd * Math.pow(a.df, lvl - 1); }
function chance(name, lvl, st, { est = false } = {}) {
  const a = ACT[name]; const m = skillMults(st.levels);
  let diff = difficulty(a, lvl); let comp = 0;
  for (const k of Object.keys(a.w)) comp += a.w[k] * Math.pow(effSkill(st, m, k), a.d[k]);
  comp *= intBonus(st.skills.intelligence, 0.75);
  comp *= Math.min(1, st.stamina / (0.5 * st.maxStamina));
  if (a.t !== "C") comp *= Math.pow((st.teamCount ?? 0) + 1, 0.05);
  if (a.t !== "B") { // Bevoelkerung und Chaos (Black Ops ignorieren beides)
    const pop = est ? st.city.popEst : st.city.pop;
    comp *= Math.pow(pop / 1e9, 0.7);
    if (st.city.chaos > 50) diff *= Math.sqrt(1 + st.city.chaos - 50);
  }
  if (name === "Raid" && st.city.comms < 1) return 0;
  comp *= m.all ?? 1;
  if (a.t !== "C") comp *= m.op ?? 1; else comp *= m.contract ?? 1;
  if (a.stealth) comp *= m.stealth ?? 1;
  if (a.kill) comp *= m.kill ?? 1;
  comp *= st.augMult;
  return Math.min(1, comp / diff);
}
function actionTime(name, lvl, st) {
  const a = ACT[name]; const m = skillMults(st.levels);
  const ea = effSkill(st, m, "agility"), ed = effSkill(st, m, "dexterity");
  const fac = 0.5 * (Math.pow(ea, 0.04) + Math.pow(ed, 0.035) + ea / 1e4 + ed / 1e4);
  let t = difficulty(a, lvl) / 10; t = Math.max(1, t * (m.time ?? 1) / fac);
  return Math.ceil(t * (a.t === "B" ? 1.5 : 1));
}
function diffMult(d) { return Math.pow(d, 0.28) + d / 650; }
// BN-Faktor auf Rangzuwachs; Rangverlust ist NICHT skaliert (Formulas.ts calculateActionRankLoss)
function rankGain(name, lvl, rankMult) { const a = ACT[name]; return a.rg * Math.pow(a.rf, lvl - 1) * (a.t === "B" ? 1 : 1) * rankMult; }
function rankLoss(name, lvl) { const a = ACT[name]; return a.rl * Math.pow(a.rf, lvl - 1); }
module.exports = { ACT, skillMults, chance, actionTime, diffMult, rankGain, rankLoss, difficulty };
