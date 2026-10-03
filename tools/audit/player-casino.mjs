// Audit 03.10.2026, Bereich PLAYER: Casino (Roulette) als Geldquelle je Einbauzyklus.
//
// Spiel 3.0.2 (nur gelesen):
//   Casino/Game.ts:4-19        gainLimit 10e9; reachedLimit prueft Player.getCasinoWinnings() > 10e9
//                              VOR jedem Spiel; win(n) -> Player.gainMoney(n, "casino") OHNE BN-Faktor
//   PlayerObjectGeneralMethods.ts:599-601  getCasinoWinnings = moneySourceA.casino
//   PlayerObjectGeneralMethods.ts:128      moneySourceA.reset() in prestigeAugmentation (jeder Einbau,
//                                          auch beim BN-Wechsel ueber prestigeSourceFile -> :145)
//   Casino/Roulette.tsx:12      maxBet 1e7; :100-107 Single(s) payout 36; :110 WHRNG(new Date().getTime())
//   Casino/Roulette.tsx:141-176 n = floor(rng*37); bei Gewinn mit 10 % (Math.random) Neuwurf, bis verloren;
//                               Gewinn gain = Einsatz*36, Verlust -Einsatz; setTimeout 1600 ms
//   Casino/RNG.ts:38-63         WHRNG: s = (seed/1000) % 30000, drei LCG-Teile, Summe mod 1
//   Casino/utils.ts:3-8         trusted(): event.isTrusted - der Bot umgeht das bereits mit
//                               __reactProps$-onClick und Attrappen-Ereignis (src/join.js:97-101, src/darkweb.js:190-195)
//
// EICHUNG: Geldseite gegen den Spielstand - Hacking-Einkommen BN2.1 = moneySourceA.hacking /
// playtimeSinceLastAug (gemessen). Die Roulette-Simulation selbst ist UNGEEICHT (kein Casino-Spiel
// im Spielstand), der WHRNG ist Zeile fuer Zeile aus RNG.ts uebertragen.
//
// Aufruf: node tools/audit/player-casino.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSave, latestFile } from "./player-save.mjs";
import { bnMult } from "./player-crime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export class WHRNG {
  constructor(seed) { const v = (seed / 1000) % 30000; this.s1 = v; this.s2 = v; this.s3 = v; }
  step() { this.s1 = (171 * this.s1) % 30269; this.s2 = (172 * this.s2) % 30307; this.s3 = (170 * this.s3) % 30323; }
  random() { this.step(); return (this.s1 / 30269.0 + this.s2 / 30307.0 + this.s3 / 30323.0) % 1.0; }
}

// Ein Spiel nach Roulette.tsx:141-176. bet auf Single(target).
function playRound(rng, target, cheatRoll) {
  let n = Math.floor(rng.random() * 37);
  let win = n === target;
  if (win && cheatRoll > 0.9) {
    while (win) { n = Math.floor(rng.random() * 37); win = n === target; }
  }
  return { n, win };
}

// Bot kennt den Seed exakt (er loest den Mount aus und liest Date.now()); er sagt die naechste
// Zahl mit einer Kopie des Generators voraus und setzt darauf. Nach einem "Hausbetrug" laeuft
// seine Kopie den Neuwurf mit (deterministisch, nur der Ausloeser ist Math.random).
export function simulate(seed, startMoney, rand = Math.random) {
  const game = new WHRNG(seed);
  const mine = new WHRNG(seed);
  let money = startMoney, casino = 0, spins = 0;
  while (casino <= 10e9 && spins < 10000) {
    const probe = new WHRNG(0); Object.assign(probe, mine);
    const target = Math.floor(probe.random() * 37);
    const bet = Math.min(1e7, money);
    if (bet <= 0) break;
    const r = playRound(game, target, rand());
    spins++;
    // Eigene Kopie nachfuehren - der Zustand des Spiels ist unbekannt, nur das
    // angezeigte n. Vorhergesagt gewonnen, aber verloren = Hausbetrug: dann
    // so lange weiterziehen, bis die Zahl nicht mehr trifft (Roulette.tsx:149-154).
    const re = new WHRNG(0); Object.assign(re, mine);
    let n = Math.floor(re.random() * 37);
    if (n === target && !r.win) { while (n === target) n = Math.floor(re.random() * 37); }
    if (n !== r.n) throw new Error("Nachfuehrung verloren");
    Object.assign(mine, re);
    const gain = r.win ? bet * 36 : -bet;
    money += gain; casino += gain;
  }
  return { spins, money, casino, seconds: spins * 1.6 };
}

const isMain = process.argv[1] && process.argv[1].endsWith("player-casino.mjs");
if (isMain) {
  // Determinismus des Ports: gleicher Seed, gleiche Folge
  const a = new WHRNG(1791040603520), b = new WHRNG(1791040603520);
  const seqA = Array.from({ length: 5 }, () => Math.floor(a.random() * 37));
  const seqB = Array.from({ length: 5 }, () => Math.floor(b.random() * 37));
  console.log("WHRNG-Port deterministisch:", JSON.stringify(seqA) === JSON.stringify(seqB), seqA.join(","));

  // Spins bis zur Sperre, je Startkapital, 200 Seeds
  console.log("\n## Spins bis Casino-Gewinn > 10 Mrd (Seed bekannt, 10 % Hausbetrug), 200 Laeufe");
  for (const start of [5e4, 1e6, 1e7]) {
    const res = [];
    for (let i = 0; i < 200; i++) res.push(simulate(1790000000000 + i * 7919, start));
    res.sort((x, y) => x.spins - y.spins);
    const med = res[100];
    console.log("Start", start.toExponential(0).padEnd(6), "Spins Median", med.spins, " max", res[199].spins,
      " Endgeld Median", (med.money / 1e9).toFixed(2), "Mrd  reine Spielzeit", (med.seconds / 60).toFixed(1), "min");
  }

  // Gemessen je Lauf: Hacking-Einkommen seit Knotenbeginn und Zahl der Einbauzyklen
  // (verschiedene lastAugReset-Werte je Lauf = Einbauten + 1). Gegenprobe zur Skalierung unten.
  const dir = path.join(root, "backups");
  const idx = fs.readFileSync(path.join(dir, "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((l) => l.split("\t"));
  const runs = new Map();
  for (const c of idx) {
    const f = path.join(dir, c[1]);
    if (!fs.existsSync(f)) continue;
    const run = "BN" + c[4] + "L" + c[5];
    const r = runs.get(run) || { files: [] };
    r.files.push(f);
    runs.set(run, r);
  }
  console.log("\n## Gemessen je Lauf (letzter Stand): Hacking seit Knotenbeginn, Einbauzyklen, Casino");
  console.log("Lauf".padEnd(8), "h_Knoten", "Hacking Mrd", "Mrd/h", "Zyklen", "casinoB", "Hackfaktor");
  const base0 = bnMult(2, "ServerMaxMoney") * bnMult(2, "ScriptHackMoney");
  for (const [run, r] of runs) {
    const resets = new Set();
    let last = null;
    for (const f of r.files) {
      try {
        const { player } = loadSave(f);
        resets.add(player.lastAugReset);
        if (!last || player.totalPlaytime > last.totalPlaytime) last = player;
      } catch { /* defekt */ }
    }
    if (!last) continue;
    const msB = last.moneySourceB.data || last.moneySourceB;
    const h = last.playtimeSinceLastBitnode / 3.6e6;
    const n = last.bitNodeN;
    const f = bnMult(n, "ServerMaxMoney") * bnMult(n, "ScriptHackMoney") * bnMult(n, "ScriptHackMoneyGain") / base0;
    console.log(run.padEnd(8), h.toFixed(1).padStart(8), (msB.hacking / 1e9).toFixed(1).padStart(11), (msB.hacking / 1e9 / h).toFixed(2).padStart(6),
      String(resets.size).padStart(6), String(msB.casino).padStart(7), f.toFixed(3).padStart(10));
  }

  // Wert gegen das gemessene Hacking-Einkommen
  const { player: p } = loadSave(latestFile());
  const msA = p.moneySourceA.data || p.moneySourceA;
  const hPerH = msA.hacking / (p.playtimeSinceLastAug / 3.6e6);
  console.log("\n## Wert von 10 Mrd je Einbauzyklus");
  console.log("BN" + p.bitNodeN, "Hacking gemessen", (hPerH / 1e9).toFixed(2), "Mrd/h (moneySourceA.hacking", (msA.hacking / 1e9).toFixed(2),
    "Mrd /", (p.playtimeSinceLastAug / 3.6e6).toFixed(2), "h)");
  const base = bnMult(2, "ServerMaxMoney") * bnMult(2, "ScriptHackMoney");
  console.log("Knoten  Hackfaktor  Hacking~Mrd/h  10 Mrd = h Hacking   AugMoneyCost (GESCHAETZT: Hacking linear in ServerMaxMoney*ScriptHackMoney*Gain)");
  for (const n of [2, 3, 11, 6, 7, 14, 13, 15, 8]) {
    const f = bnMult(n, "ServerMaxMoney") * bnMult(n, "ScriptHackMoney") * bnMult(n, "ScriptHackMoneyGain") / base;
    const h = hPerH * f;
    console.log(("BN" + n).padEnd(7), f.toFixed(3).padStart(10), (h / 1e9).toFixed(2).padStart(14), (h > 0 ? (10e9 / h).toFixed(1) : "inf").padStart(19),
      String(bnMult(n, "AugmentationMoneyCost")).padStart(12));
  }
}
