// Audit 03.10.2026, Bereich BOERSE: Grobe Groessenordnung der Kurssteuerung
// per grow(host, {stock:true}) (StockMarket/PlayerInfluencing.ts:47-61:
// otlkMagForecast +0,1 mit Wahrscheinlichkeit moneyGrown/moneyMax je grow-AUFRUF,
// unabhaengig von der Threadzahl; NetscriptFunctions.ts:301-303).
// Modell: je Tick r erfolgreiche +0,1-Schritte auf das Forecast-Ziel jeder
// gehaltenen Long-Position (hoechstens K Aktien gleichzeitig - so viele Ziele
// kann der Batcher bedienen). r = Aufrufe/Tick x Anteil (z. B. 2 grow-Aufrufe
// je 6 s bei 50 % Hackanteil -> r = 1). NICHT modelliert: welche Server es zu
// welcher Aktie gibt und ob deren Hackstufe erreichbar ist; der Batcher-Takt.
// Das ist eine Groessenordnung, keine Eichung.
//
// Aufruf: node tools/audit/boerse-push.mjs [--seeds N] [--start 250e6] [--fours 1]
import { makeOptStrategy, makeHistStrategy } from "./boerse-sim.mjs";

const a = process.argv.slice(2);
const arg = (k, d) => (a.includes(k) ? Number(a[a.indexOf(k) + 1]) : d);
const SEEDS = arg("--seeds", 8), START = arg("--start", 250e6), FOURS = arg("--fours", 1);
const TPH = 600, HOURS = 12;

function pushFn(r, K) {
  return (m) => {
    const held = m.stocks.filter((s) => s.playerShares > 0).sort((x, y) => y.playerShares * y.price - x.playerShares * x.price).slice(0, K);
    for (const s of held) {
      // r erwartete Treffer je Tick: ganzzahliger Teil sicher, Rest als Bernoulli
      let n = Math.floor(r) + (m.R() < r - Math.floor(r) ? 1 : 0);
      for (let i = 0; i < n; i++) s.changeForecastForecast(s.otlkMagForecast + 0.1);
    }
  };
}
const med = (x) => { const b = [...x].sort((p, q) => p - q); return b[Math.floor(b.length / 2)]; };
const fmt = (x) => (x >= 1e12 ? (x / 1e12).toFixed(2) + "T" : (x / 1e9).toFixed(2) + "B");
console.log("Start " + fmt(START) + ", " + (FOURS ? "mit 4S (Rang (2f-1)*mv, Long)" : "ohne 4S (Historie w=40, Long)") + ", " + SEEDS + " Seeds");
for (const [r, K] of [[0, 0], [0.5, 3], [1, 3], [2, 3], [5, 3], [2, 8]]) {
  const ws = { 3: [], 6: [], 12: [] };
  for (let s = 1; s <= SEEDS; s++) {
    const strat = FOURS ? makeOptStrategy({ entry: 0.05 }) : makeHistStrategy({ window: 40, entry: 0.1 });
    const out = runWithPush(7000 + s, strat, r > 0 ? pushFn(r, K) : null);
    for (const h of [3, 6, 12]) ws[h].push(out[h]);
  }
  console.log(("r=" + r + " K=" + K).padEnd(10), "Vermoegen 3h " + fmt(med(ws[3])) + "  6h " + fmt(med(ws[6])) + "  12h " + fmt(med(ws[12])));
}

import { Market, Account } from "./boerse-sim.mjs";
function runWithPush(seed, strat, push) {
  const m = new Market(seed);
  const acc = new Account(START);
  const out = {};
  for (let t = 1; t <= HOURS * TPH; t++) {
    if (push) push(m, acc);
    m.tick();
    strat.act(m, acc);
    if (t % TPH === 0) out[t / TPH] = acc.wealth(m);
  }
  return out;
}
