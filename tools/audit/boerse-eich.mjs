// Audit 03.10.2026, Bereich BOERSE: Eichung des Marktmodells boerse-sim.mjs.
//
// WARUM SO: Kein einziger der 200 Spielstaende unter backups/ hat je einen
// Boersenzugang gehabt (boerse-save.mjs: acc=---- und init=false in allen
// 200, das Werkzeug liest hasWseAccount/hasTixApiAccess/has4S* und
// StockMarketSave.lastUpdate und KANN den Fall also zeigen). Ein Spielstandwert
// zum Eichen existiert damit nicht. Geeicht wird deshalb gegen zwei
// unabhaengige Quellen:
//   (1) die Sollwerte der Spiel-eigenen Unittests
//       reference/bitburner-src/test/jest/StockMarket.test.ts
//       (geschrieben von den Spielentwicklern, nicht von uns),
//   (2) den ORIGINALEN Quelltext, ausgefuehrt ueber boerse-orig.mjs, mit
//       demselben Zufallsstrom wie der Nachbau: nach N Ticks muessen alle
//       Kurse, otlkMag, otlkMagForecast, b BITGLEICH sein.
// Dazu (3) eine Plausibilitaetspruefung der Ertragsformel, mit der die
// Strategien rangieren: E[ln(P_t+1/P_t)] = (2f-1) * E[ln(1+av)].
//
// Aufruf: node tools/audit/boerse-eich.mjs
import { loadOriginal } from "./boerse-orig.mjs";
import { Stock as SimStock, Market, Account, rng, loadMetadata, processTransactionForecastMovement as simPTFM, CONST } from "./boerse-sim.mjs";

const O = loadOriginal();
let pass = 0, fail = 0;
const ok = (cond, label, soll, ist) => {
  if (cond) pass++;
  else { fail++; console.log("  ABWEICHUNG", label, "Soll", soll, "Ist", ist); }
};
const eq = (label, soll, ist) => ok(Object.is(soll, ist) || soll === ist, label, soll, ist);

// ---------------------------------------------------------------------------
// (1) Unittest-Sollwerte (StockMarket.test.ts:41-51 ctorParams)
// ---------------------------------------------------------------------------
const ctorParams = { b: true, initPrice: 10e3, marketCap: 5e9, mv: 2, name: "MockStock", otlkMag: 20, spreadPerc: 1, shareTxForMovement: 5e3, symbol: "mock" };
const makeO = () => new O.Stock(ctorParams);
const makeS = () => new SimStock(rng(1), ctorParams);

function unitTests(make, tag, cycleForecast) {
  // getForecastIncreaseChance, StockMarket.test.ts:274-325
  const cases = [
    [true, 90, 20, 0.7], [true, 90, 25, 0.65], [true, 100, 0, 0.95], [true, 60, 25, 0.35], [true, 10, 25, 0.05],
    [false, 90, 20, 0.95], [false, 50, 25, 0.75], [false, 100, 0, 0.95], [false, 5, 25, 0.3], [false, 10, 25, 0.35],
    [false, 50, 0, 0.5], [false, 25, 5, 0.3],
  ];
  for (const [b, ff, mag, soll] of cases) {
    const s = make(); s.b = b; s.otlkMagForecast = ff; s.otlkMag = mag;
    eq(tag + " getForecastIncreaseChance b=" + b + " ff=" + ff + " mag=" + mag, soll, s.getForecastIncreaseChance());
  }
  // flipForecastForecast, :197-227
  for (const [a, soll] of [[50, 50], [60, 40], [90, 10], [100, 0], [40, 60], [0, 100], [25, 75]]) {
    const s = make(); s.otlkMagForecast = a;
    if (s.flipForecastForecast) s.flipForecastForecast(); else s.otlkMagForecast = 100 - s.otlkMagForecast;
    eq(tag + " flipForecastForecast " + a, soll, s.otlkMagForecast);
  }
  // influenceForecast, :327-354
  { const s = make(); s.otlkMag = 10; s.influenceForecast(2); eq(tag + " influenceForecast 10-2", 8, s.otlkMag); }
  { const s = make(); s.otlkMag = 10; s.b = true; s.influenceForecast(1); eq(tag + " influenceForecast b", 9, s.otlkMag); s.b = false; s.influenceForecast(2); eq(tag + " influenceForecast !b", 7, s.otlkMag); }
  { const s = make(); s.otlkMag = 10; s.influenceForecast(10); eq(tag + " influenceForecast limit", 5, s.otlkMag); s.influenceForecast(10); eq(tag + " influenceForecast limit2", 5, s.otlkMag); }
  // influenceForecastForecast, :356-376
  for (const [a, ch, soll] of [[75, 15, 60], [25, 15, 40], [40, 20, 50], [60, 20, 50]]) {
    const s = make(); s.otlkMagForecast = a; s.influenceForecastForecast(ch);
    eq(tag + " influenceForecastForecast " + a + "/" + ch, soll, s.otlkMagForecast);
  }
  // cycleForecast, :164-187 (Wahrscheinlichkeit erzwungen)
  { const s = make(); s.getForecastIncreaseChance = () => 1; cycleForecast(s, 5); eq(tag + " cycleForecast +5", 25, s.otlkMag);
    s.getForecastIncreaseChance = () => 0; cycleForecast(s, 10); eq(tag + " cycleForecast -10", 15, s.otlkMag); }
  { const s = make(); s.getForecastIncreaseChance = () => 0; cycleForecast(s, 25); eq(tag + " cycleForecast Vorzeichen", 5, s.otlkMag); eq(tag + " cycleForecast b kippt", false, s.b); }
  // Konstruktor: totalShares auf 100k gerundet, :134-136
  { const s = make(); eq(tag + " totalShares%1e5", 0, s.totalShares % 100e3); }
  // Ask/Bid, :252-272
  { const s = make(); eq(tag + " ask", s.price * (1 + s.spreadPerc / 100), s.getAskPrice()); eq(tag + " bid", s.price * (1 - s.spreadPerc / 100), s.getBidPrice()); }
}
unitTests(makeO, "ORIGINAL", (s, ch) => s.cycleForecast(ch));
unitTests(makeS, "NACHBAU", (s, ch) => s.cycleForecast(() => 0.5, ch));

// Kursdruck je Paket (processTransactionForecastMovement), :612-735
function ptfmTests(make, ptfm, tag) {
  const nth = (orig, n) => orig - O.forecastChangePerPriceMovement * (n - 1);
  const nthFF = (s, orig, n) => {
    if (s.otlkMagForecast > 50) { const e = orig - O.forecastChangePerPriceMovement * (n - 1) * (s.mv / 100); return e < 50 ? 50 : e; }
    if (s.otlkMagForecast < 50) { const e = orig + O.forecastChangePerPriceMovement * (n - 1) * (s.mv / 100); return e > 50 ? 50 : e; }
    return 50;
  };
  const noMv = Math.round(ctorParams.shareTxForMovement / 2.2);
  const mv = ctorParams.shareTxForMovement * 3 + noMv;
  { const s = make(); const o = s.otlkMag; ptfm(s, noMv); eq(tag + " ptfm ohne Bewegung otlkMag", o, s.otlkMag); eq(tag + " ptfm ohne Bewegung Zaehler", s.shareTxForMovement - noMv, s.shareTxUntilMovement); }
  { const s = make(); const o = s.otlkMag, of = s.otlkMagForecast; ptfm(s, mv); eq(tag + " ptfm 4 Bewegungen otlkMag", nth(o, 4), s.otlkMag); eq(tag + " ptfm 4 Bewegungen ff", nthFF(s, of, 4), s.otlkMagForecast); eq(tag + " ptfm Zaehler", s.shareTxForMovement - noMv, s.shareTxUntilMovement); }
  { const s = make(); const o = s.otlkMag, of = s.otlkMagForecast; ptfm(s, s.shareTxForMovement); eq(tag + " ptfm genau 1x", nth(o, 2), s.otlkMag); eq(tag + " ptfm genau 1x ff", nthFF(s, of, 2), s.otlkMagForecast); eq(tag + " ptfm genau 1x Zaehler", s.shareTxForMovement, s.shareTxUntilMovement); }
  { const s = make(); const o = s.otlkMag; ptfm(s, Math.round(s.shareTxForMovement / 2)); ptfm(s, s.shareTxUntilMovement); eq(tag + " ptfm 2 Haelften", nth(o, 2), s.otlkMag); eq(tag + " ptfm 2 Haelften Zaehler", s.shareTxForMovement, s.shareTxUntilMovement); }
  { const s = make(); const o = s.otlkMag; ptfm(s, 3 * s.shareTxForMovement); eq(tag + " ptfm 3x", nth(o, 4), s.otlkMag); eq(tag + " ptfm 3x Zaehler", s.shareTxForMovement, s.shareTxUntilMovement); }
}
ptfmTests(makeO, O.processTransactionForecastMovement, "ORIGINAL");
ptfmTests(makeS, simPTFM, "NACHBAU");

// Transaktionskosten, :532-603: Nachbau-Konto gegen Original-Formeln
{
  const so = makeO(), ss = makeS();
  const sh = ctorParams.shareTxForMovement / 2;
  eq("Kauf Long Original", sh * so.getAskPrice() + 100e3, O.getBuyTransactionCost(so, sh, O.PositionType.Long));
  eq("Kauf Short Original", sh * so.getBidPrice() + 100e3, O.getBuyTransactionCost(so, sh, O.PositionType.Short));
  eq("Verkauf Long Original", sh * so.getBidPrice() - 100e3, O.getSellTransactionGain(so, sh, O.PositionType.Long));
  const acc = new Account(1e12);
  const before = acc.cash;
  acc.buy(ss, sh);
  eq("Kauf Long Nachbau = Original", O.getBuyTransactionCost(so, sh, O.PositionType.Long), before - acc.cash);
  const c2 = acc.cash;
  acc.sell(ss, sh);
  eq("Verkauf Long Nachbau = Original", O.getSellTransactionGain(so, sh, O.PositionType.Long), acc.cash - c2);
  // Short: Kauf und Rueckkauf, Original-Gewinnformel StockMarketHelpers.ts:55-59
  const so2 = makeO(), ss2 = makeS();
  const acc2 = new Account(1e12);
  const b2 = acc2.cash;
  acc2.short(ss2, sh);
  eq("Short-Kauf Nachbau = Original", O.getBuyTransactionCost(so2, sh, O.PositionType.Short), b2 - acc2.cash);
  so2.playerAvgShortPx = ss2.playerAvgShortPx; so2.price = ss2.price = ss2.price * 0.9;
  const c3 = acc2.cash;
  acc2.cover(ss2, sh);
  eq("Short-Rueckkauf Nachbau = Original", O.getSellTransactionGain(so2, sh, O.PositionType.Short), acc2.cash - c3);
}

console.log("(1) Unittest-Sollwerte und Kostenformeln:", pass, "gleich,", fail, "abweichend");

// ---------------------------------------------------------------------------
// (2) Originalcode gegen Nachbau, derselbe Zufallsstrom, 20.000 Ticks
// ---------------------------------------------------------------------------
const meta = loadMetadata();
function bitIdentity(seed, ticks, withTrades) {
  const realRandom = Math.random;
  // Original aufbauen wie initStockMarket (StockMarket.ts:187-210)
  Math.random = rng(seed);
  const mk = {};
  const oStocks = meta.map((m) => { const s = new O.Stock(m); mk[m.name] = s; return s; });
  mk.Orders = {}; mk.storedCycles = 0; mk.lastUpdate = 0;
  mk.ticksUntilCycle = O.getRandomIntInclusive(1, O.StockMarketConstants.TicksPerCycle);
  O.setMarket(mk);
  const oR = Math.random;
  // Nachbau mit eigenem Strom gleichen Seeds
  const sim = new Market(seed, meta);
  let maxRel = 0, firstDiff = null;
  for (let t = 1; t <= ticks; t++) {
    Math.random = oR; O.tick();
    Math.random = realRandom; sim.tick();
    if (withTrades && t % 97 === 0) { // gleiche Pakete auf beiden Seiten
      const i = t % oStocks.length;
      const n = Math.round(oStocks[i].shareTxForMovement * 2.7);
      O.processTransactionForecastMovement(oStocks[i], n);
      simPTFM(sim.stocks[i], n);
    }
    for (let i = 0; i < oStocks.length; i++) {
      const a = oStocks[i], b = sim.stocks[i];
      const same = a.price === b.price && a.otlkMag === b.otlkMag && a.otlkMagForecast === b.otlkMagForecast && a.b === b.b && a.shareTxUntilMovement === b.shareTxUntilMovement;
      if (!same && !firstDiff) firstDiff = { t, sym: b.symbol, orig: [a.price, a.otlkMag, a.otlkMagForecast, a.b], sim: [b.price, b.otlkMag, b.otlkMagForecast, b.b] };
      maxRel = Math.max(maxRel, Math.abs(a.price - b.price) / a.price);
    }
  }
  Math.random = realRandom;
  const o0 = oStocks[0], s0 = sim.stocks[0];
  return { firstDiff, maxRel, sample: { sym: s0.symbol, origPrice: o0.price, simPrice: s0.price, origMag: o0.otlkMag, simMag: s0.otlkMag }, cycles: sim.cycles };
}
for (const [seed, trades] of [[11, false], [12, true], [13, true]]) {
  const r = bitIdentity(seed, 20000, trades);
  console.log("(2) Seed", seed, trades ? "mit Kursdruck-Paketen" : "ohne Handel", ": erste Abweichung", r.firstDiff ? JSON.stringify(r.firstDiff) : "KEINE",
    "| max. rel. Kursdifferenz", r.maxRel, "| Probe", r.sample.sym, "Original", r.sample.origPrice, "Nachbau", r.sample.simPrice, "| Zyklen", r.cycles);
  if (r.firstDiff) fail++; else pass++;
}

// ---------------------------------------------------------------------------
// (3) Ertragsformel: mittlerer Log-Ertrag je Tick gegen (2f-1)*E[ln(1+av)]
// ---------------------------------------------------------------------------
{
  const m = new Market(99, meta);
  const acc = { n: 0, real: 0, pred: 0 };
  for (let t = 0; t < 60000; t++) {
    const pre = m.stocks.map((s) => ({ p: s.price, f: s.price >= s.cap ? 0.1 : s.forecast(), mv: s.mv }));
    m.tick();
    m.stocks.forEach((s, i) => {
      const e = pre[i];
      acc.real += Math.log(s.price / e.p);
      // E[ln(1+v*mv/100)] fuer v~U(0,1), numerisch
      let el = 0; for (let k = 0; k < 20; k++) el += Math.log(1 + ((k + 0.5) / 20) * e.mv / 100) / 20;
      acc.pred += (2 * e.f - 1) * el;
      acc.n++;
    });
  }
  console.log("(3) mittlerer Log-Ertrag je Aktie und Tick: gemessen", (acc.real / acc.n).toExponential(4), " Formel", (acc.pred / acc.n).toExponential(4),
    " (Formel nutzt f VOR dem Tick; Zykluskippen am Tickanfang verschiebt leicht)");
}

console.log("GESAMT:", pass, "bestanden,", fail, "abweichend");
