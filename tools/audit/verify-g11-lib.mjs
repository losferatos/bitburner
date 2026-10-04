// Gegenpruefung G11: eigener Nachbau der Bladeburner-Chancenformel, direkt aus dem Spielquelltext
// (reference/bitburner-src/src/Bladeburner/data/Skills.ts, data/BlackOperations.ts, Actions/Action.ts:169-196,
// Bladeburner.ts:757-784, Skill.ts:37-81). Unabhaengig von tools/audit/blade-formeln.mjs, wird aber
// gegen dieselben Spielstandwerte geeicht (verify-g11-eichung.mjs).
import fs from "node:fs";
import path from "node:path";
export const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const BB = path.join(root, "reference", "bitburner-src", "src", "Bladeburner");

// --- Skills.ts parsen -------------------------------------------------------
export function parseSkills() {
  const t = fs.readFileSync(path.join(BB, "data", "Skills.ts"), "utf8");
  const out = {};
  const re = /new Skill\(\{([\s\S]*?)\n  \}\),/g;
  let m;
  while ((m = re.exec(t))) {
    const b = m[1];
    const name = /name: BladeburnerSkillName\.(\w+)/.exec(b)[1];
    const num = (k, d) => { const x = new RegExp(k + ":\\s*([0-9.]+)").exec(b); return x ? Number(x[1]) : d; };
    const mults = {};
    const mm = /mults:\s*\{([^}]*)\}/.exec(b);
    for (const e of mm[1].split(",")) {
      const x = /\[BladeburnerMultName\.(\w+)\]:\s*(-?[0-9.]+)/.exec(e);
      if (x) mults[x[1]] = Number(x[2]);
    }
    out[name] = { baseCost: num("baseCost", 1), costInc: num("costInc", 1), maxLvl: num("maxLvl", Infinity), mults };
  }
  return out;
}
export const SK = parseSkills();
// Anzeigenamen (Spielstand) -> Enum-Namen
export const NAME = { "Blade's Intuition": "BladesIntuition", "Cloak": "Cloak", "Short-Circuit": "ShortCircuit", "Digital Observer": "DigitalObserver",
  "Tracer": "Tracer", "Overclock": "Overclock", "Reaper": "Reaper", "Evasive System": "EvasiveSystem", "Datamancer": "Datamancer",
  "Cyber's Edge": "CybersEdge", "Hands of Midas": "HandsOfMidas", "Hyperdrive": "Hyperdrive" };
export const skill = (n) => SK[NAME[n]];

// Skill.ts:37-81 calculateCost, count=1
export const cost = (n, lvl, bn = 1) => { const s = skill(n); return Math.round(bn * (s.baseCost + s.costInc * lvl)); };
export const costSum = (n, lvl, bn = 1) => { let c = 0; for (let i = 0; i < lvl; i++) c += cost(n, i, bn); return c; };

// Bladeburner.ts:774-784 updateSkillMultipliers: Produkt je Multiplikatorname
export function mults(levels) {
  const m = {};
  for (const [n, L] of Object.entries(levels)) {
    if (!L) continue;
    for (const [k, base] of Object.entries(skill(n).mults)) m[k] = Math.max(0, (m[k] ?? 1) * (1 + base * L / 100));
  }
  return m;
}
const g = (m, k) => m[k] ?? 1;

// --- BlackOperations.ts parsen ---------------------------------------------
export function parseBlackOps() {
  const t = fs.readFileSync(path.join(BB, "data", "BlackOperations.ts"), "utf8");
  const ops = [];
  const re = /new BlackOperation\(\{([\s\S]*?)desc:/g;
  let m;
  while ((m = re.exec(t))) {
    const b = m[1];
    const num = (k) => Number(new RegExp(k + ":\\s*([0-9.e]+)").exec(b)[1]);
    const blk = (k) => { const x = new RegExp(k + ":\\s*\\{([^}]*)\\}").exec(b)[1]; const o = {}; for (const l of x.split(",")) { const y = /(\w+):\s*([0-9.]+)/.exec(l); if (y) o[y[1]] = Number(y[2]); } return o; };
    ops.push({ name: /name: BladeburnerBlackOpName\.(\w+)/.exec(b)[1], n: num("n"), baseDifficulty: num("baseDifficulty"), reqdRank: num("reqdRank"),
      rankGain: num("rankGain"), rankLoss: num("rankLoss"), hpLoss: num("hpLoss"), weights: blk("weights"), decays: blk("decays"),
      isKill: /isKill:\s*true/.test(b), isStealth: /isStealth:\s*true/.test(b) });
  }
  return ops;
}
export const BLACKOPS = parseBlackOps();

// Action.ts:169-196 fuer Black Ops (BlackOperation.ts: Pop = 1, Chaos = 1, Truppbonus (team+1)^0,05,
// operationSkillSuccessBonus = SuccessChanceOperation)
// P = { skills: {hacking,...}, mults: {bladeburner_success_chance} }, lv = Bladeburner-Skillstufen,
// stamFrac = Ausdauer/Hoechstausdauer (Strafe min(1, f/0,5))
export function blackOpChance(op, P, lv, { team = 0, stamFrac = 1, unclamped = false } = {}) {
  const m = mults(lv);
  const eff = {
    hacking: P.skills.hacking,
    strength: P.skills.strength * g(m, "EffStr"), defense: P.skills.defense * g(m, "EffDef"),
    dexterity: P.skills.dexterity * g(m, "EffDex"), agility: P.skills.agility * g(m, "EffAgi"),
    charisma: P.skills.charisma * g(m, "EffCha"), intelligence: P.skills.intelligence,
  };
  let c = 0;
  for (const s of Object.keys(op.weights)) c += op.weights[s] * Math.pow(eff[s], op.decays[s]);
  c *= 1 + 0.75 * Math.pow(P.skills.intelligence, 0.8) / 600;
  c *= Math.min(1, stamFrac / 0.5);
  c *= Math.pow(team + 1, 0.05);
  c *= g(m, "SuccessChanceAll");
  c *= g(m, "SuccessChanceOperation");
  if (op.isStealth) c *= g(m, "SuccessChanceStealth");
  if (op.isKill) c *= g(m, "SuccessChanceKill");
  c *= P.mults.bladeburner_success_chance ?? 1;
  const w = c / op.baseDifficulty;
  return unclamped ? w : Math.min(1, w);
}
