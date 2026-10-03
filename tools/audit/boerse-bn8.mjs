// Audit 03.10.2026, Bereich BOERSE: BitNode 8 - boerse.js wie gebaut gegen
// zwei Korrekturen, ab dem Startgeld 250 Mio (Prestige.ts:38,158-160) auf
// frischem Markt (Prestige.ts:166-170). In BN8 sind Leerverkauf und
// Limit-Orders ohne SF8 frei (NetscriptFunctions/StockMarket.ts:46-53).
//
//   bot          src/boerse.js:151-308 Zeile fuer Zeile (boerse-sim.mjs makeBotStrategy),
//                4S-Kauf nur bei BARGELD >= 26 Mrd (:180-193)
//   bot+4S-Verm  wie bot, aber 4S-Kauf sobald das VERMOEGEN 26 Mrd erreicht
//                (Depot wird dafuer verkauft) - die Ein-Zeilen-Korrektur
//   best         Historie w=40 e=0,1 Long+Short bis Vermoegen 26 Mrd, dann 4S,
//                dann Rang nach (2f-1)*mv, Long+Short (makeOptStrategy)
// Danach (jeder weitere Zyklus nach einem Einbau, 4S bleibt bis zum
// Knotenwechsel, PlayerObjectGeneralMethods.ts:162-166 nur in prestigeSourceFile):
//   bot-4S       boerse.js-Regel mit 4S
//   best-4S      Rang (2f-1)*mv, Long+Short
// Ausgabe: Stunden bis Vermoegen 26 Mrd / 100 Mrd / 1 T / 2,5 T / 10 T.
//
// Aufruf: node tools/audit/boerse-bn8.mjs [--seeds N] [--start 250e6] [--hours 48]
import { Market, Account, makeBotStrategy, makeOptStrategy, makeHistStrategy } from "./boerse-sim.mjs";

const a = process.argv.slice(2);
const arg = (k, d) => (a.includes(k) ? Number(a[a.indexOf(k) + 1]) : d);
const SEEDS = arg("--seeds", 10), START = arg("--start", 250e6), HOURS = arg("--hours", 48);
const TPH = 600, T = [26e9, 100e9, 1e12, 2.5e12, 10e12];

function runOne(seed, mode) {
  const m = new Market(seed);
  const acc = new Account(START);
  let strat, s4 = null;
  if (mode === "bot") strat = makeBotStrategy({ fourS: false, buy4S: true });
  else if (mode === "bot+4S-Verm") strat = makeBotStrategy({ fourS: false, buy4S: false });
  else if (mode === "best") strat = makeHistStrategy({ window: 40, entry: 0.1, shorts: true });
  else if (mode === "bot-4S") { strat = makeBotStrategy({ fourS: true, buy4S: false }); s4 = 0; }
  else if (mode === "best-4S") { strat = makeOptStrategy({ entry: 0.05, shorts: true }); s4 = 0; }
  const hits = T.map(() => Infinity);
  for (let t = 1; t <= HOURS * TPH; t++) {
    m.tick();
    if (s4 === null && (mode === "bot+4S-Verm" || mode === "best") && acc.wealth(m) >= 26e9) {
      for (const s of m.stocks) { if (s.playerShares > 0) acc.sell(s, s.playerShares); if (s.playerShortShares > 0) acc.cover(s, s.playerShortShares); }
      acc.cash -= 25e9; s4 = t / TPH;
      if (mode === "best") strat = makeOptStrategy({ entry: 0.05, shorts: true });
      else { strat.state.hat4S = true; strat.state.gekauft4S = true; }
    }
    strat.act(m, acc);
    if (mode === "bot" && s4 === null && strat.state.gekauft4S) s4 = t / TPH;
    if (t % 30 === 0) { const w = acc.wealth(m); T.forEach((x, i) => { if (hits[i] === Infinity && w >= x) hits[i] = t / TPH; }); }
  }
  return { hits, s4 };
}

const med = (x) => { const b = [...x].sort((p, q) => p - q); return b[Math.floor(b.length / 2)]; };
const f = (x) => (Number.isFinite(x) ? x.toFixed(1) : "nie");
const lab = (x) => (x >= 1e12 ? x / 1e12 + "T" : x / 1e9 + "B");
console.log("BN8, Start " + (START / 1e6).toFixed(0) + " Mio, frischer Markt, " + SEEDS + " Seeds, Horizont " + HOURS + " h");
for (const mode of ["bot", "bot+4S-Verm", "best", "bot-4S", "best-4S"]) {
  const rs = [];
  for (let s = 1; s <= SEEDS; s++) rs.push(runOne(3000 + s, mode));
  const cols = T.map((x, i) => { const h = rs.map((r) => r.hits[i]); return lab(x) + ":" + f(med(h)) + "[" + f(Math.min(...h)) + "-" + f(Math.max(...h)) + "]"; });
  const s4 = rs.map((r) => r.s4 ?? Infinity);
  console.log(mode.padEnd(12), "4S@" + f(med(s4)) + "h", "| h bis", cols.join("  "));
}
