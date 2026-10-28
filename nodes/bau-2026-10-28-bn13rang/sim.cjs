// Erwartungswert-Simulation Rang in BN13.1 aus dem Spielstand (Schritte 0,1 h). Nutzt modell.cjs (geeicht: eichen.cjs).
// Vereinfachungen (alle benannt): Ausdauerpausen 7 % der Zeit, Chaos in Staedten unter 50 folgenlos (Sleeves halten NT),
// Bevoelkerungsereignisse (Zufallsereignisse) im Mittel null, Hospitalgeld ohne Wirkung, Go-Bonus +1,5 %/h auf die Kampfmultiplikatoren.
const M = require("./modell.cjs");
const SAVE = process.argv[2];
const policy = process.argv[3] || "status";   // status | bestcity | bestcity_team | gym | bestcity_gym
const HOURS = Number(process.argv[4] || 24);
const s = require(SAVE); const p = s.PlayerSave.data; const b = p.bladeburner.data;
const RM = 0.45, LVLMULT = 0.7; let EXPMULT = p.mults.strength_exp;
const BB = {}; // Basis: Aktionsstand
for (const k of ["contracts", "operations"]) for (const [n, a] of Object.entries(b[k])) BB[n] = { ...a.data, kind: k };
const SUP = { Tracking: 30, "Bounty Hunter": 30, Retirement: 30, Investigation: 18.75, "Undercover Operation": 18.75, "Sting Operation": 16.1, Raid: 15.75, "Stealth Retirement Operation": 7.9, Assassination: 7.9 };
const INFIL = 30; // eine infiltrierende Sleeve: +0,5 je Minute auf JEDE Aktion
const cities = Object.fromEntries(Object.entries(b.cities).map(([n, c]) => [n, { ...c.data }]));
let exp = { str: p.exp.strength, def: p.exp.defense, dex: p.exp.dexterity, agi: p.exp.agility };
const baseMult = { str: p.mults.strength, def: p.mults.defense, dex: p.mults.dexterity, agi: p.mults.agility };
const lvl = (E, m) => Math.max(1, Math.floor(m * LVLMULT * (32 * Math.log(E + 534.5) - 200)));
let skills = { ...p.skills }; const levels = { ...b.skills };
let rank = b.rank, sp = 0;
const SK = { "Blade's Intuition": [3, 2.1], "Cloak": [2, 1.1], "Short-Circuit": [2, 2.1], "Digital Observer": [2, 2.1], "Tracer": [2, 2.1], "Overclock": [3, 1.4], "Reaper": [2, 2.1], "Evasive System": [2, 2.1], "Cyber's Edge": [1, 3], "Hyperdrive": [1, 2.5], "Datamancer": [3, 1] };
function cost(n, l) { return Math.round(2 * (SK[n][0] + SK[n][1] * l)); }
function spent(n, l) { let t = 0; for (let i = 0; i < l; i++) t += cost(n, i); return t; }
sp = Math.floor(b.totalSkillPoints) - Object.entries(levels).reduce((a, [n, l]) => a + spent(n, l), 0);
const hasGym = policy.includes("gym"), bestCity = policy.includes("bestcity"), team = policy.includes("team");
const maxSta = b.maxStamina;
function stateFor(city) { return { skills, levels, stamina: maxSta, maxStamina: maxSta, augMult: p.mults.bladeburner_success_chance, city: cities[city], teamCount: team ? 3 : 0 }; }
function cityFor(name) { if (typeof name !== "string") throw new Error("cityFor " + name); // Stadt fuer eine Aktion: status = NT, bestcity = bester Wert nach echter Chance
  if (!bestCity) return "New Tokyo";
  let best = null, bv = -1;
  for (const c of Object.keys(cities)) { if (name === "Raid" && cities[c].comms < 1) continue; const ch = M.chance(name, BB[name].level, stateFor(c)); if (ch > bv) { bv = ch; best = c; } }
  return best || "New Tokyo";
}
function evalAction(name) {
  const L = BB[name].level; const c0 = cityFor(name); const st = stateFor(c0);
  const c = M.chance(name, L, st), t = M.actionTime(name, L, st);
  const g = M.rankGain(name, L, RM), l = M.rankLoss(name, L);
  const ev = c * g - (1 - c) * l;
  const d = M.ACT[name], dm = M.diffMult(M.difficulty(d, L));
  const hyper = 1 + 0.1 * (levels["Hyperdrive"] || 0);
  const un = t * dm * (c + (1 - c) * 0.5) * hyper * EXPMULT;
  return { name, c, t, ev, g, l, city: c0, expStat: { str: un * d.w.strength, def: un * d.w.defense, dex: un * d.w.dexterity, agi: un * d.w.agility } };
}
function buy() {
  for (let guard = 0; guard < 400; guard++) {
    const base = M.chance("Raid", BB.Raid.level, stateFor(cityFor("Raid")));
    let best = null;
    for (const n of ["Blade's Intuition", "Short-Circuit", "Digital Observer", "Reaper", "Evasive System", "Hyperdrive"]) {
      const cst = cost(n, levels[n] || 0); if (cst > sp) continue;
      levels[n] = (levels[n] || 0) + 1; const c2 = M.chance("Raid", BB.Raid.level, stateFor(cityFor("Raid"))); levels[n]--;
      const gainEV = (c2 - base) * (BB.Raid.level ? 58.4 : 0) ;
      const val = n === "Hyperdrive" ? 0.0003 / cst : gainEV / cst; // Hyperdrive: Nebenwert ueber Exp
      if (!best || val > best.val) best = { n, cst, val };
    }
    if (!best) return; sp -= best.cst; levels[best.n] = (levels[best.n] || 0) + 1;
  }
}
const DT = 0.1; let t = 0; const out = [];
let succ = {}; for (const n of Object.keys(BB)) succ[n] = BB[n].successes;
let installed = !policy.includes("install");
while (t < HOURS - 1e-9) {
  if (!installed && t >= 1.3 - 1e-9) { installed = true; exp = { str: 0, def: 0, dex: 0, agi: 0 }; baseMult.str *= 1.1; baseMult.def *= 1.1; baseMult.dex *= 1.386; baseMult.agi *= 1.1025; EXPMULT *= 1.1; }
  const list = Object.keys(BB).map(evalAction);
  const bgExp = hasGym ? { str: 0, def: 0, dex: 0, agi: 0 } : { str: 1.136, def: 1.136, dex: 1.136, agi: 1.136 };
  if (hasGym) { for (const k of ["str", "def", "dex", "agi"]) bgExp[k] = 15.14 / 4; } // Powerhouse 10 x 1,514 exp/s, reihum auf vier Werte
  list.sort((a, b2) => (b2.ev / b2.t) - (a.ev / a.t));
  let timeLeft = DT * 3600 * Number(process.env.EFF || 0.93);
  for (const a of list) {
    const avail = BB[a.name].count; if (a.ev <= 0 || avail < 1) continue;
    const n = Math.min(avail, timeLeft / a.t); if (n <= 0) continue;
    BB[a.name].count -= n; timeLeft -= n * a.t; rank += n * a.ev; succ[a.name] += n * a.c;
    for (const k of Object.keys(exp)) exp[k] += n * a.expStat[k];
    if (a.name === "Raid") { // Bevoelkerungsverbrauch
      const c = cities[a.city]; const drop = n * (a.c * 0.01 + (1 - a.c) * 0.0075); c.pop *= Math.exp(-drop); c.comms = Math.max(0, c.comms - n * a.c);
    }
  }
  for (const k of Object.keys(exp)) exp[k] += bgExp[k] * DT * 3600;
  // Zuwachs
  for (const n of Object.keys(BB)) BB[n].count += (SUP[n] + INFIL) * DT;
  // Stufen aus Erfolgen
  for (const n of Object.keys(BB)) { const per = BB[n].kind === "contracts" ? 3 : 2.5; while (succ[n] >= Math.ceil(0.5 * BB[n].level * (2 * per + BB[n].level - 1))) BB[n].level++; }
  // Stats mit Go-Zuwachs
  const goF = 1 + 0.015 * t * (t < 10 ? 1 : 0.7);
  skills.strength = lvl(exp.str, baseMult.str * goF); skills.defense = lvl(exp.def, baseMult.def * goF);
  skills.dexterity = lvl(exp.dex, baseMult.dex * goF); skills.agility = lvl(exp.agi, baseMult.agi * goF);
  sp = Math.floor(rank / 3) - Object.entries(levels).reduce((a, [n2, l2]) => a + spent(n2, l2), 0); buy();
  t += DT;
  if (Math.abs(t * 2 - Math.round(t * 2)) < 1e-6 && Math.round(t * 2) % 2 === 0) out.push({ h: t, rank, str: skills.strength, L: BB.Raid.level, cR: evalAction("Raid").c });
}
const pick = out.filter((o) => [1, 2, 3, 4, 8, 12, 16, 24, 36, 48, 72, 96, 120].includes(Math.round(o.h)));
console.log(policy.padEnd(16), pick.map((o) => `h${o.h.toFixed(0)}:${o.rank.toFixed(0)}(str${o.str} L${o.L} c${o.cR.toFixed(2)})`).join("  "));
