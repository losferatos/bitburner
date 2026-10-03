// Audit 03.10.2026, Bereich BOERSE: Wann kauft boerse.js in BN8 die 4S-API?
// Die Regel (src/boerse.js:178-193) prueft das BARGELD zu Rundenbeginn
// (>= 26 Mrd), bevor verkauft wird; die Kaufschleife (:239-265) legt das
// Bargeld danach bis auf wenige Mio wieder an. Gemessen wird: Tick, an dem
// das VERMOEGEN (Bargeld + Depot zum Geldkurs) 26 Mrd erreicht, gegen den
// Tick, an dem die Regel wirklich kauft.
// Aufruf: node tools/audit/boerse-4skauf.mjs [--seeds N] [--start 250e6]
import { run, makeBotStrategy } from "./boerse-sim.mjs";
const a = process.argv.slice(2);
const SEEDS = a.includes("--seeds") ? Number(a[a.indexOf("--seeds") + 1]) : 12;
const START = a.includes("--start") ? Number(a[a.indexOf("--start") + 1]) : 250e6;
const rows = [];
for (let seed = 1; seed <= SEEDS; seed++) {
  const strat = makeBotStrategy({ fourS: false, buy4S: true });
  let tWealth = null, cashMaxBefore = 0, wealthAtBuy = null;
  const r = run({ seed: 1000 + seed, cash: START, ticks: 72 * 600, strategy: strat, sampleEvery: 600, onTick: (m, acc, t) => {
    const w = acc.wealth(m);
    if (tWealth === null && w >= 26e9) tWealth = t;
    if (!strat.state.gekauft4S) cashMaxBefore = Math.max(cashMaxBefore, acc.cash);
    if (strat.state.gekauft4S && wealthAtBuy === null) wealthAtBuy = w;
  } });
  const tb = strat.state.boughtAtTick;
  rows.push({ seed, hWealth26: tWealth / 600, hBuy: tb ? tb / 600 : Infinity, wealthAtBuy, cashMaxBefore });
}
const f = (x) => (x === null || !Number.isFinite(x) ? "nie" : x.toFixed(2));
for (const r of rows) console.log("seed", r.seed, "Vermoegen>=26 Mrd nach", f(r.hWealth26), "h | 4S gekauft nach", f(r.hBuy), "h | Vermoegen beim Kauf", r.wealthAtBuy ? (r.wealthAtBuy / 1e9).toFixed(0) + " Mrd" : "-");
const d = rows.filter((r) => Number.isFinite(r.hBuy)).map((r) => r.hBuy - r.hWealth26).sort((x, y) => x - y);
console.log("Verzoegerung Kauf gegen 26-Mrd-Vermoegen (h): Median", d[Math.floor(d.length / 2)]?.toFixed(2), "min", d[0]?.toFixed(2), "max", d[d.length - 1]?.toFixed(2), "| gekauft in", d.length, "von", rows.length);
