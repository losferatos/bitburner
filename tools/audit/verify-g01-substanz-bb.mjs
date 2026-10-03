// Gegenpruefung G01 (Substanz): eigenes Bladeburner-Modell, Daten direkt aus dem
// Spielquellcode geladen (nicht aus tools/bbrank/bbmodel.mjs abgeschrieben).
//
// Quellen (reference/bitburner-src/src/):
//   Bladeburner/data/{Contracts,Operations,BlackOperations}.ts  Aktionsdaten (per eval geladen)
//   Bladeburner/Actions/Action.ts:104-122   getActionTime
//   Bladeburner/Actions/Action.ts:144-196   getSuccessRange / getSuccessChance
//   Bladeburner/Actions/LevelableAction.ts:58-64  getDifficulty
//   Bladeburner/Actions/Operation.ts:52-98  Chaos, Truppbonus, Operations-Skill
//   Bladeburner/Actions/BlackOperation.ts   pop=1, chaos=1, Zeitstrafe 1.5
//   Bladeburner/Bladeburner.ts:757-784      Effektivwerte, Skill-Multiplikatoren
//   Bladeburner/Bladeburner.ts:1327-1343    maxStamina
//   PersonObjects/formulas/skill.ts:7-15    Fertigkeit (534.6)
//   PersonObjects/formulas/intelligence.ts  Intelligenzbonus
//
// Aufruf: node tools/audit/verify-g01-substanz-bb.mjs [Spielstand-Teilstring]  -> Eichung
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSave, homeFile, findBackup } from "./verify-g01-substanz-save.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = path.join(ROOT, "reference", "bitburner-src", "src");

function parseEnum(txt, enumName) {
  const start = txt.indexOf("export enum " + enumName);
  const body = txt.slice(start, txt.indexOf("}", start));
  const map = {};
  for (const m of body.matchAll(/^\s*(\w+)\s*=\s*"([^"]*)"/gm)) map[m[1]] = m[2];
  return map;
}

function loadActionFile(file, fnName) {
  const enumTxt = fs.readFileSync(path.join(SRC, "Bladeburner", "Enums.ts"), "utf8");
  const enums = {
    BladeburnerContractName: parseEnum(enumTxt, "BladeburnerContractName"),
    BladeburnerOperationName: parseEnum(enumTxt, "BladeburnerOperationName"),
    BladeburnerBlackOpName: parseEnum(enumTxt, "BladeburnerBlackOpName"),
  };
  const txt = fs.readFileSync(path.join(SRC, "Bladeburner", "data", file), "utf8");
  const s = txt.indexOf("export function " + fnName);
  const r = txt.indexOf("return {", s);
  // Ende des return-Objekts: erstes "\n  };" nach dem return
  const e = txt.indexOf("\n  };", r);
  let body = txt.slice(r + "return ".length, e + 4);
  body = body.replace(/ as [A-Za-z<>\[\]]+/g, "");
  const stub = (kind) => function (p) { return { kind, ...p }; };
  const proxy = new Proxy({}, { get: (_, k) => String(k) });
  const fn = new Function("BladeburnerContractName", "BladeburnerOperationName", "BladeburnerBlackOpName",
    "Contract", "Operation", "BlackOperation", "getRandomIntInclusive", "CityName", "FactionName", "LocationName",
    "return (" + body + ");");
  return fn(enums.BladeburnerContractName, enums.BladeburnerOperationName, enums.BladeburnerBlackOpName,
    stub("C"), stub("O"), stub("B"), (a, b) => (a + b) / 2, proxy, proxy, proxy);
}

export const CONTRACTS = loadActionFile("Contracts.ts", "createContracts");
export const OPERATIONS = loadActionFile("Operations.ts", "createOperations");
export const BLACKOPS = loadActionFile("BlackOperations.ts", "createBlackOperations");

const DEF_W = { hacking: 1 / 7, strength: 1 / 7, defense: 1 / 7, dexterity: 1 / 7, agility: 1 / 7, charisma: 1 / 7, intelligence: 1 / 7 };
const DEF_D = { hacking: 0.9, strength: 0.9, defense: 0.9, dexterity: 0.9, agility: 0.9, charisma: 0.9, intelligence: 0.9 };

// Skill-Multiplikatoren (Skills.ts, Bladeburner.ts:774-784): Produkt je Skill (1 + base*lvl/100)
const SKILL_MULTS = {
  "Blade's Intuition": { SuccessChanceAll: 3 }, "Cloak": { SuccessChanceStealth: 5.5 },
  "Short-Circuit": { SuccessChanceKill: 5.5 }, "Digital Observer": { SuccessChanceOperation: 4 },
  "Tracer": { SuccessChanceContract: 4 }, "Overclock": { ActionTime: -1 },
  "Reaper": { EffStr: 2, EffDef: 2, EffDex: 2, EffAgi: 2 }, "Evasive System": { EffDex: 4, EffAgi: 4 },
  "Datamancer": { SuccessChanceEstimate: 5 }, "Cyber's Edge": { Stamina: 2 },
  "Hands of Midas": { Money: 10 }, "Hyperdrive": { ExpGain: 10 },
};
export function skillMults(levels) {
  const m = {};
  for (const [n, l] of Object.entries(levels || {})) {
    if (!l || !SKILL_MULTS[n]) continue;
    for (const [k, b] of Object.entries(SKILL_MULTS[n])) m[k] = (m[k] ?? 1) * (1 + (b * l) / 100);
  }
  return m;
}
const sm = (m, k) => m[k] ?? 1;

export const calcSkill = (exp, mult) => Math.max(Math.floor(mult * (32 * Math.log(exp + 534.6) - 200)), 1);

export function effSkill(skills, m, stat) {
  const map = { strength: "EffStr", defense: "EffDef", dexterity: "EffDex", agility: "EffAgi", charisma: "EffCha" };
  return map[stat] ? skills[stat] * sm(m, map[stat]) : skills[stat];
}

export function difficulty(a, level) {
  if (a.kind === "B") return a.baseDifficulty;
  return a.baseDifficulty * Math.pow(a.difficultyFac, level - 1);
}

/** Action.ts getSuccessChance, mit est-Schalter fuer den Bevoelkerungsfaktor */
export function successChance(a, level, st, est = false) {
  // st: {skills, m, stamina, maxStamina, city:{pop,popEst,chaos}, bbSucc, teamCount}
  let diff = difficulty(a, level);
  const w = a.weights || DEF_W, d = a.decays || DEF_D;
  let comp = 0;
  for (const stat of ["hacking", "strength", "defense", "dexterity", "agility", "charisma", "intelligence"]) {
    comp += (w[stat] ?? 0) * Math.pow(effSkill(st.skills, st.m, stat), d[stat] ?? 0.9);
  }
  comp *= 1 + (0.75 * Math.pow(st.skills.intelligence, 0.8)) / 600;
  comp *= Math.min(1, st.stamina / (0.5 * st.maxStamina));
  if (a.kind === "O" || a.kind === "B") comp *= Math.pow((st.teamCount ?? 0) + 1, 0.05);
  if (a.kind !== "B") {
    const pop = est ? st.city.popEst : st.city.pop;
    comp *= Math.pow(pop / 1e9, 0.7);
    if (st.city.chaos > 50) diff *= Math.pow(1 + (st.city.chaos - 50), 0.5);
  }
  comp *= sm(st.m, "SuccessChanceAll");
  if (a.kind === "C") comp *= sm(st.m, "SuccessChanceContract");
  if (a.kind === "O" || a.kind === "B") comp *= sm(st.m, "SuccessChanceOperation");
  if (a.isStealth) comp *= sm(st.m, "SuccessChanceStealth");
  if (a.isKill) comp *= sm(st.m, "SuccessChanceKill");
  comp *= st.bbSucc;
  return { p: Math.min(1, comp / diff), comp, diff };
}

/** Action.ts:144-167 getSuccessRange -> [low, high] */
export function successRange(a, level, st) {
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const est = successChance(a, level, st, true).p;
  const real = successChance(a, level, st, false).p;
  const dd = Math.abs(real - est);
  let low = real - dd, high = real + dd;
  let r = st.city.pop / st.city.popEst;
  if (Number.isNaN(r)) r = 0;
  if (r < 1) low *= r; else high *= r;
  return [clamp(low), clamp(high)];
}

export function actionTime(a, level, st) {
  const base = difficulty(a, level) / 10;
  const eA = effSkill(st.skills, st.m, "agility"), eD = effSkill(st.skills, st.m, "dexterity");
  const statFac = 0.5 * (Math.pow(eA, 0.04) + Math.pow(eD, 0.035) + eA / 1e4 + eD / 1e4);
  const pen = a.kind === "B" ? 1.5 : 1;
  return Math.ceil(Math.max(1, (base * sm(st.m, "ActionTime")) / statFac) * pen);
}

export function maxStamina(skills, m, staminaBonus, maxStamMult) {
  return Math.max(1e-9, (Math.pow(effSkill(skills, m, "agility"), 0.8) + staminaBonus) * sm(m, "Stamina") * maxStamMult);
}

export function allActions() {
  return { ...CONTRACTS, ...OPERATIONS };
}

// Zustand aus einem Spielstand
export function stateFromSave(p) {
  const bb = p.bladeburner.data || p.bladeburner;
  const m = skillMults(bb.skills);
  const cityRaw = bb.cities[bb.city];
  const c = cityRaw.data || cityRaw;
  return {
    skills: { ...p.skills }, m, stamina: bb.stamina, maxStamina: bb.maxStamina, staminaBonus: bb.staminaBonus,
    city: { pop: c.pop, popEst: c.popEst, chaos: c.chaos, comms: c.comms }, bbSucc: p.mults.bladeburner_success_chance,
    teamCount: 0, bb, mults: p.mults,
  };
}

function main() {
  const part = process.argv[2] || "BN2L1_2026-10-03T21-17";
  const file = findBackup(part);
  const { player: p, servers } = loadSave(file);
  const st = stateFromSave(p);
  console.log("Spielstand", path.basename(file));
  // Eichung 1: Fertigkeitsformel gegen die gespeicherten Stufen
  for (const s of ["hacking", "strength", "defense", "dexterity", "agility", "charisma"]) {
    const bnMult = s === "hacking" ? 0.8 : 1; // BN2 HackingLevelMultiplier 0.8
    const soll = p.skills[s], ist = calcSkill(p.exp[s], p.mults[s] * bnMult);
    console.log(`EICHUNG Stufe ${s.padEnd(9)} Soll ${soll} Ist ${ist} ${soll === ist ? "OK" : "ABWEICHUNG"}`);
  }
  // Eichung 2: maxStamina
  const ms = maxStamina(st.skills, st.m, st.bb.staminaBonus, p.mults.bladeburner_max_stamina);
  console.log(`EICHUNG maxStamina Soll ${st.maxStamina.toFixed(6)} Ist ${ms.toFixed(6)} ${Math.abs(ms / st.maxStamina - 1) < 1e-9 ? "OK" : "ABWEICHUNG"}`);
  // Eichung 3: getActionEstimatedSuccessChance()[0] der laufenden Aktion (blade.json "chance")
  const bj = JSON.parse(homeFile(servers, "data/blade.json") || "null");
  if (bj) {
    const [typ, name] = bj.aktion.split("/");
    const a = typ === "Contracts" ? CONTRACTS[name] : OPERATIONS[name];
    const lvl = bj.stufe;
    // Stufe im Spielstand pruefen
    const src = typ === "Contracts" ? st.bb.contracts : st.bb.operations;
    const saved = src[name].data || src[name];
    const rng = successRange(a, saved.level, st);
    console.log(`EICHUNG Chance ${bj.aktion} L${saved.level} (blade.json L${lvl}): Soll ${bj.chance} (Bot-Telemetrie = getActionEstimatedSuccessChance[0])`
      + ` Ist ${rng[0].toFixed(3)} / echte Chance ${successChance(a, saved.level, st).p.toFixed(4)}`
      + ` ${Math.abs(rng[0] - bj.chance) < 0.0006 ? "OK" : "ABWEICHUNG"}`);
    console.log(`  Stadt ${st.bb.city} pop ${st.city.pop.toExponential(4)} popEst ${st.city.popEst.toExponential(4)} chaos ${st.city.chaos.toFixed(2)}; Ausdauer ${st.stamina.toFixed(1)}/${st.maxStamina.toFixed(1)}`);
    // Vergleich Black Ops gegen die Bot-eigene Nachrechnung (keine Spielausgabe, nur Plausibilitaet)
    for (const [n, ch] of Object.entries(bj.boChancen || {}).slice(0, 3)) {
      console.log(`  Black Op ${n}: Bot ${ch}  eigenes Modell ${successChance(BLACKOPS[n], 1, st).p.toFixed(4)}`);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
