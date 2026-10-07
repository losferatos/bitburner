// Machbarkeit Labyrinth-Weg V1b in BN15 (Bauauftrag P1 aus AUDIT-ROADMAP-PRUEFUNG-2026-10).
// Nachbau der Spielformeln (bitburner-src 3.0.2) als ausfuehrbarer Code, geeicht gegen
// Spielstaende aus backups/. Aufruf aus dem Repo-Wurzelordner oder einem Worktree:
//   node nodes/labyrinth-machbarkeit-2026-10/rechnung.mjs
// Liest nur. Schreibt nichts.
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";

const ROOT = "C:/Users/erche/Desktop/claude_projecto/bitburner";
const REF = ROOT + "/reference/bitburner-src/src";
const BACKUPS = ROOT + "/backups";
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

// ---------------------------------------------------------------------------
// 1. Formeln (Nachbau)
// ---------------------------------------------------------------------------

// PersonObjects/formulas/skill.ts:7-15
function calculateSkill(exp, mult = 1) {
  if (mult === 0) return 1;
  return Math.max(1, Math.floor(mult * (32 * Math.log(exp + 534.6) - 200)));
}
// skill.ts:17-19 (ohne die Rundungsschleife; fuer Groessenordnungen reicht das)
const calculateExp = (skill, mult = 1) => Math.max(0, Math.exp((skill / mult + 200) / 32) - 534.6);
// Umkehrung fuer ein festes EXP-Budget: welcher Gesamtmultiplikator ist fuer Level L noetig?
const multNeeded = (level, exp) => level / (32 * Math.log(exp + 534.6) - 200);

// PersonObjects/formulas/intelligence.ts:1-3
const intBonus = (int, weight = 1) => 1 + (weight * Math.pow(int, 0.8)) / 600;

// DarkNet/effects/effects.ts:60-98 (ohne Backdoor-Malus, ohne TimingAttack-Zuschlag)
function authTime({ chaReq, difficulty, depth }, { cha, int = 150, threads = 1, boots = false }) {
  const skillFactor = (5 * chaReq + (difficulty + 1) * 100) / (cha + 150);
  const under = cha <= chaReq && depth > 1 ? 1.5 + (chaReq + 50) / (cha + 50) : 1;
  const threadsFactor = 1 / (1 + 0.2 * (threads - 1));
  return 850 * skillFactor * under * (boots ? 0.8 : 1) * threadsFactor / intBonus(int, 0.25);
}
// effects.ts:121-132; darkweb: maxRam 16, schon geknackt (alreadyHacked 0,2), Erfolg zaehlt nicht x10
const chaGainAuth = (difficulty, threads, chaExpMult, { alreadyHacked = true, success = true } = {}) =>
  (2.5 + 1.07 ** difficulty) * (alreadyHacked ? 0.2 : 1) * (success && !alreadyHacked ? 10 : 1) * threads * chaExpMult;
// NetscriptFunctions/Darknet.ts:276 (heartbleed, unabhaengig von Threads)
const chaGainHeartbleed = (cha, chaExpMult) => chaExpMult * 50 * ((500 + cha) / 500);

// DarknetServerOptions.ts:67-72 - Charisma-Anforderung eines Netzservers (Mittelwert der Varianz: +0,5*d)
const serverChaReq = (difficulty, labDepth, labCha) =>
  difficulty < 2 ? difficulty * 10 : (difficulty / labDepth) ** 1.5 * labCha * 0.85 + 0.5 * difficulty;

// ---------------------------------------------------------------------------
// 2. Bitnode-Multiplikatoren aus BitNode.tsx lesen (nicht abschreiben)
// ---------------------------------------------------------------------------
function readBitNodeMults() {
  const t = fs.readFileSync(REF + "/BitNode/BitNode.tsx", "utf8");
  const out = {};
  const re = /case (\d+): \{([\s\S]*?)\n    \}/g;
  let m;
  while ((m = re.exec(t))) {
    const n = Number(m[1]);
    const body = m[2];
    const get = (k) => { const x = body.match(new RegExp(k + ":\\s*([\\d.]+)")); return x ? Number(x[1]) : 1; };
    out[n] = {
      HackingLevelMultiplier: get("HackingLevelMultiplier"),
      CharismaLevelMultiplier: get("CharismaLevelMultiplier"),
      WorldDaemonDifficulty: get("WorldDaemonDifficulty"),
      AugmentationMoneyCost: get("AugmentationMoneyCost"),
      HackExpGain: get("HackExpGain"),
      HackingSpeedMultiplier: get("HackingSpeedMultiplier"),
      DaedalusAugsRequirement: (body.match(/DaedalusAugsRequirement:\s*(\d+)/) || [0, 30])[1] * 1,
    };
  }
  return out;
}
const BN = readBitNodeMults();

// ---------------------------------------------------------------------------
// 3. Eichung calculateSkill gegen Spielstaende (unabhaengige Werte: vom Spiel gespeicherte Level)
// ---------------------------------------------------------------------------
function loadPlayer(file) {
  const s = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(BACKUPS, file))).toString()).data;
  const pd = JSON.parse(s.PlayerSave).data;
  let homeRam = null;
  try { homeRam = JSON.parse(s.AllServersSave).home.data.maxRam; } catch { /* egal */ }
  return { pd, homeRam };
}
const saveFiles = fs.readdirSync(BACKUPS).filter((f) => /\.json\.gz$/.test(f) && /pre-jump|pre-install/.test(f)).sort();

let checked = 0, exact = 0, worst = 0;
const runs = {};
for (const f of saveFiles) {
  const mm = f.match(/_BN(\d+)L(\d)_/);
  if (!mm) continue;
  const bn = Number(mm[1]), lvl = Number(mm[2]);
  let p;
  try { p = loadPlayer(f); } catch { continue; }
  const { pd } = p;
  // BN12 hat stufenabhaengige Multiplikatoren ("inc"/"dec") - nicht in der Tabelle, daher nicht eichen
  if (bn !== 12) {
    for (const [stat, key] of [["hacking", "HackingLevelMultiplier"], ["charisma", "CharismaLevelMultiplier"]]) {
      const lv = calculateSkill(pd.exp[stat], pd.mults[stat] * BN[bn][key]);
      checked++;
      if (lv === pd.skills[stat]) exact++;
      worst = Math.max(worst, Math.abs(lv - pd.skills[stat]));
    }
  }
  const key = "BN" + bn + "." + lvl;
  (runs[key] ??= []).push({
    f, t: pd.playtimeSinceLastBitnode / 3.6e6, augs: pd.augmentations.length,
    hM: pd.mults.hacking, chaM: pd.mults.charisma, chaX: pd.mults.charisma_exp,
    hackExp: pd.exp.hacking, hack: pd.skills.hacking, homeRam: p.homeRam, int: pd.skills.intelligence,
  });
}
console.log("== 1. Eichung calculateSkill (skill.ts:7-15) gegen gespeicherte Level ==");
console.log(`   ${exact}/${checked} Level exakt getroffen (hacking + charisma, ${saveFiles.length} Spielstaende ohne BN12), groesste Abweichung ${worst}`);

// ---------------------------------------------------------------------------
// 4. Lab-Kette in BN15 (labyrinth.ts:403-473) - wie viele Einbau-Zyklen bis TRP?
// ---------------------------------------------------------------------------
const LABS = { // labyrinth.ts:37-110
  NormalLab: { depth: 7, cha: 300 }, CruelLab: { depth: 12, cha: 600 }, MercilessLab: { depth: 19, cha: 1500 },
  UberLab: { depth: 23, cha: 2500 }, EternalLab: { depth: 29, cha: 3000 }, EndlessLab: { depth: 31, cha: 3500 },
  FinalLab: { depth: 36, cha: 4000 }, BonusLab: { depth: 36, cha: 4000 },
};
function currentLab(installed, bn, allowTRP = true) {
  const has = (a) => installed.includes(a);
  if (!has("Wings")) return "NormalLab";
  if (!has("Boots")) return "CruelLab";
  if (!has("Hammer")) return "MercilessLab";
  if (!has("Staff")) return "UberLab";
  if (bn === 15) {
    if (!has("TRP")) return "EternalLab";
    if (!has("Law")) return "EndlessLab";
    if (!has("Sword")) return "FinalLab";
    return "BonusLab";
  }
  if (!has("Law")) return "EternalLab";
  if (!has("Sword")) return "EndlessLab";
  if (allowTRP && !has("TRP")) return "FinalLab";
  return "BonusLab";
}
function labReward(installed, bn, allowTRP = true) {
  const has = (a) => installed.includes(a);
  const next = ["Wings", "Boots", "Hammer", "Staff", "Law", "Sword"].find((a) => !has(a));
  if (!next && (has("TRP") || !allowTRP)) return "NFG";
  if (bn === 15 && next === "Law" && !has("TRP")) return "TRP";
  if (!next && allowTRP) return "TRP";
  return next ?? "NFG";
}
console.log("\n== 2. Lab-Kette BN15 (Belohnung nur gequeued -> naechstes Lab erst nach Einbau) ==");
{
  const inst = [];
  let cycle = 0;
  while (!inst.includes("TRP") && cycle < 10) {
    cycle++;
    const lab = currentLab(inst, 15);
    const r = labReward(inst, 15);
    console.log(`   Zyklus ${cycle}: ${lab.padEnd(13)} Tiefe ${String(LABS[lab].depth).padStart(2)}  Cha-Tor ${String(LABS[lab].cha).padStart(4)}  -> ${r} (Einbau ${cycle})`);
    inst.push(r);
  }
  console.log(`   => ${cycle} Einbauten bis TRP installiert; danach w0r1d_d43m0n Hacking ${3000 * BN[15].WorldDaemonDifficulty} (ServerHelpers.ts:423, servers.ts:1553) bei HackingLevelMultiplier ${BN[15].HackingLevelMultiplier}`);
}

// ---------------------------------------------------------------------------
// 5. Charisma-Tor: noetiger Spieler-Charismamultiplikator je Lab und EXP-Budget
// ---------------------------------------------------------------------------
console.log("\n== 3. Charisma-Tor: noetiger SPIELER-Charisma-Mult (BN15 CharismaLevelMultiplier " + BN[15].CharismaLevelMultiplier + ") ==");
const budgets = [1e9, 1e10, 1e11, 1e12, 1e13, 1e14, 1e15];
console.log("   Lab           cha  | " + budgets.map((b) => b.toExponential(0).padStart(6)).join(" "));
for (const lab of ["NormalLab", "CruelLab", "MercilessLab", "UberLab", "EternalLab"]) {
  const row = budgets.map((b) => (multNeeded(LABS[lab].cha, b) / BN[15].CharismaLevelMultiplier).toFixed(2).padStart(6));
  console.log(`   ${lab.padEnd(13)} ${String(LABS[lab].cha).padStart(4)} | ${row.join(" ")}`);
}

// Was hatte der Bot? Hoechster Charisma-Mult je Lauf
console.log("\n   Bot-Charisma-Mult je Lauf (max ueber pre-install/pre-jump):");
const runKeys = Object.keys(runs).sort((a, b) => parseFloat(a.slice(2)) - parseFloat(b.slice(2)));
const runSummary = [];
for (const k of runKeys) {
  const r = runs[k];
  const mx = r.reduce((a, b) => (b.chaM > a.chaM ? b : a));
  const mh = r.reduce((a, b) => (b.hM > a.hM ? b : a));
  runSummary.push({ k, chaM: mx.chaM, hM: mh.hM, augs: Math.max(...r.map((x) => x.augs)), t: Math.max(...r.map((x) => x.t)) });
}
console.log("   " + runSummary.map((s) => `${s.k} cha ${s.chaM.toFixed(2)} hack ${s.hM.toFixed(2)} (${s.augs} Augs)`).join("\n   "));

// Was waere mit gezieltem Kauf erreichbar? Startwert = Mult mit 0-1 Augs (SF-Boni), Lab-Augs, billige Cha-Augs
const augs = JSON.parse(fs.readFileSync(path.join(here, "augs-3.0.2.json"), "utf8"));
const chaAugs = Object.values(augs).filter((a) => !a.isSpecial && a.name !== "NeuroFlux Governor" && (a.mults.charisma || 1) > 1);
const cheap = chaAugs.filter((a) => a.repCost <= 125000);
const prodCheap = cheap.reduce((p, a) => p * a.mults.charisma, 1);
const prodAll = chaAugs.reduce((p, a) => p * a.mults.charisma, 1);
const labCha = 1.05 * 1.06 * 1.07; // Wings, Boots, Hammer (Augmentations.ts:1851-1900); Staff hat nur charisma_exp
const sfBase = 2.04; // BN3.2 mit 1 Aug (SF1.3 x SF2.3 x SF3.2); in BN15 mit SF3.3 etwas hoeher
console.log(`\n   Erreichbar: SF-Basis ~${sfBase} x Lab-Augs ${labCha.toFixed(3)} x alle Cha-Augs bis 125k Ruf (${cheap.length} Stueck) ${prodCheap.toFixed(2)} = ${(sfBase * labCha * prodCheap).toFixed(2)}`);
console.log(`   (alle Cha-Augs inkl. Konzernfraktionen 375k-875k Ruf: x${prodAll.toFixed(1)})`);

// ---------------------------------------------------------------------------
// 6. Charisma-EXP-Rate: Farm ueber authenticate(darkweb) von home mit vielen Threads
// ---------------------------------------------------------------------------
console.log("\n== 4. Charisma-Farm (authenticate auf darkweb von home; NICHT geeicht, keine Darknet-Werte im Spielstand) ==");
const homeRams = runSummary.length ? [65536, 524288] : [65536];
const scriptGb = 1.6 + 0.4; // Grundkosten + dnet.authenticate (RamCostGenerator.ts:239)
for (const ram of homeRams) {
  for (const floorMs of [4, 50]) {
    const threads = Math.floor((ram * 0.5) / scriptGb); // halber home-RAM fuer die Farm
    const cha = 1500, chaX = 2;
    const t = Math.max(floorMs, authTime({ chaReq: 1, difficulty: 0, depth: -1 }, { cha, threads }));
    const rate = (chaGainAuth(0, threads, chaX) / t) * 1000;
    console.log(`   home ${ram / 1024} TB, halb belegt (${threads} Threads in 1 Skript), Timer-Boden ${floorMs} ms: ${rate.toExponential(2)} EXP/s -> 1e12 in ${(1e12 / rate / 3600).toFixed(2)} h, 1e14 in ${(1e14 / rate / 3600).toFixed(1)} h`);
  }
}
console.log("   Folge: EXP ist mit genug home-RAM fast frei; das Tor ist der MULTIPLIKATOR (Abschnitt 3), nicht die Zeit.");

// ---------------------------------------------------------------------------
// 7. Hacking-Wand: w0r1d_d43m0n 6000 bei HackingLevelMultiplier 0,6
// ---------------------------------------------------------------------------
const wd = 3000 * BN[15].WorldDaemonDifficulty;
console.log(`\n== 5. Hacking-Wand BN15: Level ${wd} bei Level-Mult ${BN[15].HackingLevelMultiplier} -> noetiger SPIELER-Hacking-Mult ==`);
console.log("   EXP-Budget | " + budgets.map((b) => b.toExponential(0).padStart(6)).join(" "));
console.log("   Hack-Mult  | " + budgets.map((b) => (multNeeded(wd, b) / BN[15].HackingLevelMultiplier).toFixed(1).padStart(6)).join(" "));

// Analogie BN5.3: naechster Verwandter (AugMoney 2, HackExpGain 0,5, WD 1,5) - bester V1-Lauf des Bots
const end53 = runs["BN5.3"]?.reduce((a, b) => (b.t > a.t ? b : a));
if (end53) {
  // EXP-Umrechnung BN5 -> BN15: HackExpGain 1 statt 0,5 (x2), HackingSpeed 0,6 (x0,6 Operationen)
  const c = (BN[15].HackExpGain / BN[5].HackExpGain) * BN[15].HackingSpeedMultiplier;
  const lvl15 = calculateSkill(end53.hackExp * c, end53.hM * BN[15].HackingLevelMultiplier);
  console.log(`   BN5.3 Ende (${end53.t.toFixed(1)} h Knotenzeit, ${end53.augs} Augs): hack ${end53.hack}, Mult ${end53.hM.toFixed(2)}, EXP ${end53.hackExp.toExponential(2)}`);
  console.log(`   Derselbe Stand in BN15 (EXP x${c.toFixed(2)}): Level ${lvl15} = ${((100 * lvl15) / wd).toFixed(0)} % von ${wd}`);
  console.log(`   Bei Mult ${end53.hM.toFixed(1)} braucht BN15 ${calculateExp(wd, end53.hM * 0.6).toExponential(2)} EXP (x${(calculateExp(wd, end53.hM * 0.6) / (end53.hackExp * c)).toExponential(1)} gegenueber BN5.3-Ende)`);
  for (const hm of [13, 15, 17, 19]) {
    console.log(`   Mult ${hm}: braucht ${calculateExp(wd, hm * 0.6).toExponential(2)} EXP`);
  }
  // Augmentierungskosten: BN15 AugMoney 3 gegen BN5 2
  console.log(`   Aug-Preise BN15/BN5 = ${BN[15].AugmentationMoneyCost}/${BN[5].AugmentationMoneyCost} = x${(BN[15].AugmentationMoneyCost / BN[5].AugmentationMoneyCost).toFixed(1)}; Daedalus braucht in BN15 ${BN[15].DaedalusAugsRequirement} Augs (BN5: ${BN[5].DaedalusAugsRequirement})`);
}

// ---------------------------------------------------------------------------
// 8. Darknet-Weg je Zyklus (Netz + Labyrinth) - Formelband, nicht geeicht
// ---------------------------------------------------------------------------
console.log("\n== 6. Darknet-Zeit je Zyklus (Formelband, nicht geeicht) ==");
let sumLo = 0, sumHi = 0;
for (const lab of ["NormalLab", "CruelLab", "MercilessLab", "UberLab", "EternalLab"]) {
  const L = LABS[lab];
  let lo = 0, hi = 0;
  for (let d = 0; d < L.depth; d++) {
    const req = serverChaReq(d, L.depth, L.cha);
    const ta = authTime({ chaReq: req, difficulty: d, depth: d }, { cha: L.cha, threads: 4 }) / 1000;
    // je Server 3-20 Versuche, jeder Fehlversuch braucht ein heartbleed (x1,5) fuer die Rueckmeldung
    lo += 3 * ta * 2.5; hi += 20 * ta * 2.5;
  }
  const tLab = authTime({ chaReq: L.cha, difficulty: 10, depth: L.depth }, { cha: L.cha, threads: 4 }) / 1000;
  const cells = (LABS[lab].depth >= 23 ? 60 * 40 : lab === "MercilessLab" ? 40 * 26 : lab === "CruelLab" ? 30 * 20 : 20 * 14) / 4;
  lo += cells * 0.5 * tLab; hi += cells * 2 * 1.5 * tLab; // DFS: 0,5-2 Zuege je Zelle, labreport 1,5 Aktionen je Zug
  sumLo += lo; sumHi += hi;
  console.log(`   ${lab.padEnd(13)} Netz+Maze ${(lo / 3600).toFixed(2)}-${(hi / 3600).toFixed(2)} h (4 Threads, cha = Tor)`);
}
console.log(`   Summe 5 Zyklen ${(sumLo / 3600).toFixed(1)}-${(sumHi / 3600).toFixed(1)} h, plus je Zyklus Wiederanlauf (TOR + darkscape ${50}e6) und Einbau`);

// ---------------------------------------------------------------------------
// 9. Red Pill in BN15 (Skeptiker-Einwand 07.10.): Daedalus verkauft sie dort NICHT
// ---------------------------------------------------------------------------
{
  const fh = fs.readFileSync(REF + "/Faction/FactionHelpers.tsx", "utf8");
  const filtered = /bitNodeN === 15 && faction\.name == FactionName\.Daedalus\)\s*\{\s*return faction\.augmentations\.filter\(\(aug\) => aug !== AugmentationName\.TheRedPill\)/.test(fh);
  console.log("\n== 7. Red Pill bei Daedalus in BN15 ==");
  console.log(`   FactionHelpers.tsx Filter vorhanden: ${filtered} -> in BN15 gibt es KEINEN klassischen V1-Weg; TRP nur aus dem EternalLab`);
}

// ---------------------------------------------------------------------------
// 10. Darknet-Geld entlang eines Pfads (cacheFiles.ts getMoneyReward; effects.ts:42 Cache-Chance) - ungeeicht
// ---------------------------------------------------------------------------
console.log("\n== 8. Erwartetes Cache-Geld je Pfad (1 Server je Tiefe, Geld = 1 von 4 Belohnungsarten, crime_money ~2) ==");
for (const [lab, cha] of [["MercilessLab", 1500], ["UberLab", 2500], ["EternalLab", 3000]]) {
  let sum = 0;
  for (let d = 0; d < LABS[lab].depth; d++) sum += 0.1 * 1.05 ** d * 0.25 * 1.2 ** d * 1e7 * ((200 + cha) / 200) * 2;
  console.log(`   ${lab.padEnd(13)} ~${sum.toExponential(1)} je Durchgang`);
}
