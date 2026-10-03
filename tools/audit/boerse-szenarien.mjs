// Audit 03.10.2026, Bereich BOERSE: Szenarien auf dem Marktmodell
// (boerse-sim.mjs). Jede Zeile = Mittel und Spanne ueber mehrere Seeds.
//
// Der Markt startet FRISCH (warmup 0): initStockMarket laeuft beim Kauf des
// Zugangs (NetscriptFunctions/StockMarket.ts:309-311, 328-330), bei JEDEM
// Einbau und beim Knotenwechsel (Prestige.ts:166-171, 318-323).
//
// Aufruf: node tools/audit/boerse-szenarien.mjs [A|B|C|D|E|alle] [--seeds N]
import { run, makeBotStrategy, makeOptStrategy, makeHistStrategy } from "./boerse-sim.mjs";

const args = process.argv.slice(2);
const which = args.find((a) => /^[A-Z]$|^alle$/.test(a)) ?? "alle";
const iS = args.indexOf("--seeds");
const SEEDS = iS >= 0 ? Number(args[iS + 1]) : 8;
const TPH = 600; // Ticks je Stunde (6 s)
const fmt = (x) => {
  if (!Number.isFinite(x)) return String(x);
  const a = Math.abs(x);
  if (a >= 1e12) return (x / 1e12).toFixed(2) + "T";
  if (a >= 1e9) return (x / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (x / 1e6).toFixed(1) + "M";
  return x.toFixed(0);
};
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

function sweep(label, mk, cash, hours, checkpoints) {
  const res = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const strat = mk();
    const r = run({ seed: 1000 + seed, cash, ticks: hours * TPH, strategy: strat, sampleEvery: TPH / 4 });
    res.push({ r, strat });
  }
  const row = [label.padEnd(34), ("K=" + fmt(cash)).padEnd(9)];
  for (const h of checkpoints) {
    const ws = res.map(({ r }) => r.samples.find((s) => Math.abs(s.h - h) < 1e-9)?.w ?? NaN);
    row.push(("" + h + "h: " + fmt(med(ws)) + " [" + fmt(Math.min(...ws)) + "-" + fmt(Math.max(...ws)) + "]").padEnd(34));
  }
  console.log(row.join(" "));
  return res;
}

// Erste Stunde, in der der Median den Zielwert erreicht
function hoursTo(mk, cash, targets, maxH) {
  const hits = targets.map(() => []);
  for (let seed = 1; seed <= SEEDS; seed++) {
    const strat = mk();
    const got = targets.map(() => null);
    run({ seed: 1000 + seed, cash, ticks: maxH * TPH, strategy: strat, sampleEvery: 60, onTick: (m, acc, t) => {
      if (t % 60) return;
      const w = acc.wealth(m);
      targets.forEach((x, i) => { if (got[i] === null && w >= x) got[i] = t / TPH; });
    } });
    got.forEach((g, i) => hits[i].push(g === null ? Infinity : g));
  }
  return hits.map((h) => ({ med: med(h), min: Math.min(...h), max: Math.max(...h) }));
}

if (which === "A" || which === "alle") {
  console.log("\n=== A) V2-Knoten, 4S-API vorhanden, nur Long (kein SF8), Startkapital K, frischer Markt ===");
  const cp = [1, 3, 6, 12];
  for (const K of [5e9, 10e9, 30e9, 100e9, 300e9, 1e12]) {
    sweep("opt-4S-L (Rang (2f-1)*mv, e=0,05)", () => makeOptStrategy({ entry: 0.05 }), K, 12, cp);
  }
  for (const K of [10e9, 100e9]) {
    sweep("opt-4S-L e=0,02", () => makeOptStrategy({ entry: 0.02 }), K, 12, cp);
    sweep("opt-4S-L e=0,10", () => makeOptStrategy({ entry: 0.10 }), K, 12, cp);
    sweep("boerse.js-Regel mit 4S (Long)", () => makeBotStrategy({ fourS: true, buy4S: false }), K, 12, cp);
  }
}

if (which === "B" || which === "alle") {
  console.log("\n=== B) ohne 4S (Schaetzung aus der Kurshistorie), nur Long, K=10B ===");
  const cp = [1, 3, 6, 12];
  sweep("boerse.js Phase 1 (Historie 40)", () => makeBotStrategy({ fourS: false, buy4S: false }), 10e9, 12, cp);
  for (const w of [20, 40, 75]) for (const e of [0.05, 0.1, 0.15]) {
    sweep("hist w=" + w + " e=" + e + " Long", () => makeHistStrategy({ window: w, entry: e }), 10e9, 12, cp);
  }
}

if (which === "C" || which === "alle") {
  console.log("\n=== C) BN8 Phase 1: 250 Mio Start, kein 4S, boerse.js-Regel inkl. 4S-Kaufregel (Bargeld >= 26 Mrd) ===");
  const cp = [6, 24, 48];
  const res = sweep("boerse.js (wie gebaut)", () => makeBotStrategy({ fourS: false, buy4S: true }), 250e6, 48, cp);
  const bought = res.filter(({ strat }) => strat.state.gekauft4S).length;
  console.log("   4S gekauft in " + bought + " von " + res.length + " Laeufen; Bargeld am Ende (Median): "
    + fmt(med(res.map(({ r }) => r.acc.cash))) + ", Kommissionen (Median): " + fmt(med(res.map(({ r }) => r.acc.commissions))));
  sweep("boerse.js ab 39 Mio (nach C6-Leiter)", () => makeBotStrategy({ fourS: false, buy4S: true }), 39e6, 48, cp);
  sweep("hist w=40 e=0,1 Long+Short", () => makeHistStrategy({ window: 40, entry: 0.1, shorts: true }), 250e6, 48, cp);
  sweep("hist w=20 e=0,1 Long+Short", () => makeHistStrategy({ window: 20, entry: 0.1, shorts: true }), 250e6, 48, cp);
}

if (which === "D" || which === "alle") {
  console.log("\n=== D) BN8 mit 4S-API (nach dem Kauf; gilt nach jedem Einbau wieder ab 250 Mio, Prestige.ts:158-160) ===");
  const cp = [1, 3, 6, 12];
  sweep("opt-4S Long+Short e=0,05", () => makeOptStrategy({ entry: 0.05, shorts: true }), 250e6, 12, cp);
  sweep("opt-4S Long e=0,05", () => makeOptStrategy({ entry: 0.05 }), 250e6, 12, cp);
  sweep("boerse.js-Regel mit 4S (Long)", () => makeBotStrategy({ fourS: true, buy4S: false }), 250e6, 12, cp);
  const T = [26e9, 100e9, 1e12, 2.5e12, 5e12];
  for (const [lab, mk] of [
    ["opt-4S Long+Short", () => makeOptStrategy({ entry: 0.05, shorts: true })],
    ["opt-4S Long", () => makeOptStrategy({ entry: 0.05 })],
    ["boerse.js 4S Long", () => makeBotStrategy({ fourS: true, buy4S: false })],
  ]) {
    const h = hoursTo(mk, 250e6, T, 48);
    console.log("   " + lab.padEnd(22) + " Stunden bis " + T.map((x, i) => fmt(x) + ": " + h[i].med.toFixed(2) + " [" + h[i].min.toFixed(2) + "-" + h[i].max.toFixed(2) + "]").join("  "));
  }
}

if (which === "E" || which === "alle") {
  console.log("\n=== E) BN8 Phase 1 -> 4S: Stunden bis 26 Mrd Vermoegen (dann 4S-Kauf) ohne 4S ===");
  const T = [1e9, 5e9, 26e9];
  for (const [lab, mk] of [
    ["boerse.js Historie (Long)", () => makeBotStrategy({ fourS: false, buy4S: false })],
    ["hist w=40 e=0,1 L+S", () => makeHistStrategy({ window: 40, entry: 0.1, shorts: true })],
    ["hist w=20 e=0,1 L+S", () => makeHistStrategy({ window: 20, entry: 0.1, shorts: true })],
  ]) {
    const h = hoursTo(mk, 250e6, T, 96);
    console.log("   " + lab.padEnd(26) + " Stunden bis " + T.map((x, i) => fmt(x) + ": " + h[i].med.toFixed(1) + " [" + h[i].min.toFixed(1) + "-" + h[i].max.toFixed(1) + "]").join("  "));
  }
}
