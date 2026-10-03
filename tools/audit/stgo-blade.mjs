// Audit 03.10.2026, Bereich STGO (Stanek + IPvGO).
//
// Zweck: die Kette "Multiplikator auf Kampfwert-Stufe -> Stufe -> Black-Op-
// Chance / Exp-Bedarf fuer das Beitrittstor" als Code, geeicht gegen den
// echten Spielstand. Go (Tetrads) und Stanek (Kampf-Fragmente) wirken genau
// an dieser Stelle: sie multiplizieren mults.strength/defense/dexterity/
// agility (Go/effects/effect.ts:82-87, CotMG/StaneksGift.ts:155-170), und das
// geht linear in die Stufe (PersonObjects/formulas/skill.ts:7-16).
// Stanek-Bladeburner-Fragment multipliziert bladeburner_success_chance
// (CotMG/StaneksGift.ts:195-200), das geht linear in die competence
// (Bladeburner/Actions/Action.ts:186-187).
//
// Eichung 1: Stufen aus exp und mults gegen skills im Spielstand.
// Eichung 2: Black-Op-Chance (Action.ts:169-196) aus dem Spielstand gegen
//            data/blade.json (boChancen) und data/kpi.json (next_blackop_chance)
//            im SELBEN Spielstand (0,5 s Abstand). blade.js-blackOpChance ist im
//            Audit 26.09. (4-bladeburner.md "Geprueft") gegen Action.ts
//            bestaetigt; hier wird unabhaengig aus dem Quellcode nachgebaut.
//
// Aufruf: node tools/audit/stgo-blade.mjs [backup-datei]
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readSave } from "./stgo-save-scan.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// PersonObjects/formulas/skill.ts:7-16
export function calculateSkill(exp, mult = 1) {
  if (mult === 0) return 1;
  return Math.max(1, Math.floor(mult * (32 * Math.log(exp + 534.6) - 200)));
}
// PersonObjects/formulas/skill.ts:18-20 (ohne Rundungsschleife)
export function calculateExp(skill, mult = 1) {
  return Math.max(0, Math.exp((skill / mult + 200) / 32) - 534.6);
}

// Bladeburner/data/Skills.ts:6-103 (nur die chance-relevanten)
const SKILL_MULTS = {
  "Blade's Intuition": { SuccessChanceAll: 3 },
  Cloak: { SuccessChanceStealth: 5.5 },
  "Short-Circuit": { SuccessChanceKill: 5.5 },
  "Digital Observer": { SuccessChanceOperation: 4 },
  Tracer: { SuccessChanceContract: 4 },
  Reaper: { EffStr: 2, EffDef: 2, EffDex: 2, EffAgi: 2 },
  "Evasive System": { EffDex: 4, EffAgi: 4 },
};
// Bladeburner.ts:774-784: je Faehigkeit multiplikativ (1 + basis*stufe/100)
export function skillMult(skills, name) {
  let m = 1;
  for (const [sk, lvl] of Object.entries(skills)) {
    const eff = SKILL_MULTS[sk];
    if (eff && eff[name]) m *= 1 + (eff[name] * lvl) / 100;
  }
  return m;
}

// Bladeburner/data/BlackOperations.ts:7-32 Operation Typhoon
export const TYPHOON = {
  baseDifficulty: 2000, isKill: true, isStealth: false,
  weights: { hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2, charisma: 0, intelligence: 0.1 },
  decays: { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, charisma: 0, intelligence: 0.75 },
};

/**
 * Black-Op-Chance nach Action.ts:169-196 (Black Op: Bevoelkerung und Chaos 1,
 * BlackOperation.ts:55-61; Truppbonus und Operations-Skill wie Operation,
 * BlackOperation.ts:67-69).
 */
export function blackOpChance(op, skills, bbSkills, mults, stamina, maxStamina, teamCount = 0) {
  const eff = {
    hacking: skills.hacking,
    strength: skills.strength * skillMult(bbSkills, "EffStr"),
    defense: skills.defense * skillMult(bbSkills, "EffDef"),
    dexterity: skills.dexterity * skillMult(bbSkills, "EffDex"),
    agility: skills.agility * skillMult(bbSkills, "EffAgi"),
    charisma: skills.charisma * skillMult(bbSkills, "EffCha"),
    intelligence: skills.intelligence,
  };
  let c = 0;
  for (const st of Object.keys(op.weights)) c += op.weights[st] * Math.pow(eff[st], op.decays[st]);
  c *= 1 + (0.75 * Math.pow(skills.intelligence, 0.8)) / 600; // formulas/intelligence.ts
  c *= Math.min(1, stamina / (0.5 * maxStamina)); // Bladeburner.ts:167-169
  c *= Math.pow(teamCount + 1, 0.05); // Operation.ts:96-98
  c *= skillMult(bbSkills, "SuccessChanceAll");
  c *= skillMult(bbSkills, "SuccessChanceOperation");
  if (op.isStealth) c *= skillMult(bbSkills, "SuccessChanceStealth");
  if (op.isKill) c *= skillMult(bbSkills, "SuccessChanceKill");
  c *= mults.bladeburner_success_chance ?? 1;
  return Math.min(1, c / op.baseDifficulty);
}

const COMBAT = ["strength", "defense", "dexterity", "agility"];

/** Stufen neu berechnen, wenn die Kampf-Level-Multiplikatoren um f wachsen. */
export function skillsWithCombatFactor(p, f, bnLevelMult = 1) {
  const s = { ...p.skills };
  for (const st of COMBAT) s[st] = calculateSkill(p.exp[st], p.mults[st] * bnLevelMult * f);
  return s;
}

/** Exp-Bedarf fuer Stufe 100 in allen vier Kampfwerten (Beitrittstor). */
export function gateExp(augMult, bnLevelMult, f = 1) {
  return 4 * calculateExp(100, augMult * bnLevelMult * f);
}

function homeFile(d, name) {
  const all = JSON.parse(d.AllServersSave);
  const home = all.home?.data ?? all.home;
  const tf = home.textFiles;
  const list = Array.isArray(tf) ? tf : (tf.data ?? Object.entries(tf));
  for (const e of list) {
    const n = e?.data?.filename ?? e?.[0] ?? e?.filename;
    const t = e?.data?.text ?? e?.[1]?.data?.text ?? e?.text;
    if (n === name) return t;
  }
  return null;
}

export function loadState(file) {
  const save = readSave(file);
  const d = save.data ?? save;
  const p = JSON.parse(d.PlayerSave).data;
  const bb = p.bladeburner?.data;
  return { d, p, bb };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const file = process.argv[2] ?? path.join(root, "backups", "LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz");
  const { d, p, bb } = loadState(file);
  console.log("Spielstand:", path.basename(file), "BN", p.bitNodeN);

  // Eichung 1: Stufen (BN2: Kampf/Charisma-LevelMultiplier 1,
  // HackingLevelMultiplier 0,8 - BitNode.tsx:569-592)
  const LM = p.bitNodeN === 2 ? { hacking: 0.8 } : {};
  let ok1 = true;
  for (const st of [...COMBAT, "hacking", "charisma"]) {
    const ist = p.skills[st];
    const soll = calculateSkill(p.exp[st], p.mults[st] * (LM[st] ?? 1));
    if (ist !== soll) ok1 = false;
    console.log(`  Eichung Stufe ${st.padEnd(10)} Spielstand ${ist}  gerechnet ${soll}  ${ist === soll ? "OK" : "ABWEICHUNG"}`);
  }

  // Eichung 2: Typhoon-Chance
  const team = bb.blackOperations?.["Operation Typhoon"]?.data?.teamCount ?? 0;
  const ch = blackOpChance(TYPHOON, p.skills, bb.skills, p.mults, bb.stamina, bb.maxStamina, team);
  const blade = JSON.parse(homeFile(d, "data/blade.json"));
  const kpi = JSON.parse(homeFile(d, "data/kpi.json"));
  const soll = blade.boChancen?.["Operation Typhoon"];
  console.log(`  Eichung Typhoon-Chance: gerechnet ${ch.toFixed(4)}  blade.json ${soll}  kpi ${kpi.next_blackop_chance}  Abw. ${(100 * (ch / soll - 1)).toFixed(2)} %`);
  console.log(`  (Zeitabstand blade.json zu Spielstand: ${(p.lastUpdate - blade.zeit) / 1000} s; Stamina ${bb.stamina.toFixed(2)}/${bb.maxStamina.toFixed(2)})`);

  // Empfindlichkeit: Kampf-Level-Faktor f und Erfolgsfaktor g
  console.log("\n  Faktor f auf mults.{str,def,dex,agi} -> Typhoon-Chance (ohne Ausdauerstrafe) und Verhaeltnis");
  const base = blackOpChance(TYPHOON, p.skills, bb.skills, p.mults, bb.maxStamina, bb.maxStamina, team);
  for (const f of [0.9, 1.05, 1.1, 1.2, 1.3, 1.5, 2.0]) {
    const s = skillsWithCombatFactor(p, f);
    const c = blackOpChance(TYPHOON, s, bb.skills, p.mults, bb.maxStamina, bb.maxStamina, team);
    console.log(`    f=${f.toFixed(2)}  str ${s.strength}  chance ${c.toFixed(4)}  x${(c / base).toFixed(3)}  (f^0,8=${Math.pow(f, 0.8).toFixed(3)})`);
  }

  // Beitrittstor: Exp-Bedarf je Knoten der Restroute, Aug-Mult wie Knotenstart
  // (nur NFG + SF: hier der Spielstandwert ohne gekaufte Augs, BN2 = 1,434)
  const augMult = p.mults.strength;
  console.log(`\n  Beitrittstor 4x Stufe 100, aug-mult ${augMult.toFixed(3)} (Spielstand), Exp-Bedarf und Ersparnis durch Faktor f`);
  const nodes = { "BN2/3/6/7/11/8": 1, BN13: 0.7, BN14: 0.5, BN15: 0.7 }; // BitNode.tsx Kampf-LevelMultiplier
  for (const [n, lm] of Object.entries(nodes)) {
    const e0 = gateExp(augMult, lm, 1);
    const row = [1.1, 1.2, 1.31, 1.5, 2.0].map((f) => `f${f}: -${(100 * (1 - gateExp(augMult, lm, f) / e0)).toFixed(0)}%`);
    // Gym 10 exp/s * exp-mult (Spieler allein, ohne Sleeves/Hash) - Work/Formulas.ts
    const h = e0 / (10 * p.mults.strength_exp) / 3600;
    console.log(`    ${n.padEnd(15)} LM ${lm}  Exp ${Math.round(e0)}  (= ${h.toFixed(2)} h Gym allein)  ${row.join("  ")}`);
  }
  if (!ok1) process.exitCode = 1;
}
