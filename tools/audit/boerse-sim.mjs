// Audit 03.10.2026, Bereich BOERSE: der Aktienmarkt des Spiels als
// ausfuehrbarer Code, dazu die Handelsregeln des Bots und Alternativen.
//
// QUELLEN (reference/bitburner-src/src, Spiel 3.0.2):
//   StockMarket/StockMarket.ts:223-236   stockMarketCycle (45 % Kippen, Zyklus 75 Ticks)
//   StockMarket/StockMarket.ts:239-320   processStockPrices (Tick)
//   StockMarket/Stock.ts:126-151         Konstruktor (Preis, mv, cap, totalShares, maxShares)
//   StockMarket/Stock.ts:174-265         cycleForecast, cycleForecastForecast, influence*
//   StockMarket/StockMarketHelpers.ts    Kauf-/Verkaufspreis, Kommission, Kursdruck je Paket
//   StockMarket/BuyingAndSelling.tsx     buyStock/sellStock/shortStock/sellShort
//   StockMarket/PlayerInfluencing.ts     grow/hack {stock:true}
//   StockMarket/data/InitStockMetadata.ts  wird direkt aus der Quelle gelesen (kein Abschreiben)
//   StockMarket/data/Constants.ts        6 s je Tick, Kommission 100k, 4S-API 25 Mrd
//
// Der Bot (src/boerse.js) wird Zeile fuer Zeile nachgebaut (Strategie "bot").
// Zufall: eigener, geseedeter Generator statt Math.random (reproduzierbar).
//
// Aufruf als Bibliothek (siehe boerse-szenarien.mjs) oder direkt:
//   node tools/audit/boerse-sim.mjs --eich      Selbsttest/Eichung des Marktmodells
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const REF = path.join(root, "reference", "bitburner-src", "src", "StockMarket");

export const CONST = {
  msPerStockUpdate: 6e3,
  TicksPerCycle: 75,
  StockMarketCommission: 100e3,
  MarketDataTixApi4SCost: 25e9,
  TixApiCost: 5e9,
  WseAccountCost: 200e6,
  forecastChangePerPriceMovement: 0.006, // StockMarketHelpers.ts:6
  StockForecastInfluenceLimit: 5, // Stock.ts:5
  forecastForecastChangeFromHack: 0.1, // PlayerInfluencing.ts:12
};

// Konstanten gegen die Quelle pruefen statt glauben
export function checkConstants() {
  const k = fs.readFileSync(path.join(REF, "data", "Constants.ts"), "utf8");
  const num = (n) => Number(new RegExp(n + ":\\s*([0-9.e+]+)").exec(k)[1]);
  const out = {
    msPerStockUpdate: num("msPerStockUpdate"),
    TicksPerCycle: num("TicksPerCycle"),
    StockMarketCommission: num("StockMarketCommission"),
    MarketDataTixApi4SCost: num("MarketDataTixApi4SCost"),
    TixApiCost: num("TixApiCost"),
    WseAccountCost: num("WseAccountCost"),
  };
  for (const [key, v] of Object.entries(out)) {
    if (CONST[key] !== v) throw new Error("Konstante weicht ab: " + key + " " + CONST[key] + " vs " + v);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Metadaten direkt aus der TS-Quelle lesen
// ---------------------------------------------------------------------------
export function loadMetadata() {
  let src = fs.readFileSync(path.join(REF, "data", "InitStockMetadata.ts"), "utf8");
  src = src.replace(/^import.*$/gm, "");
  src = src.replace(/export const InitStockMetadata:\s*IConstructorParams\[\]\s*=/, "return ");
  src = src.replace(/StockSymbol\[([^\]]+)\]/g, "$1");
  src = src.replace(/LocationName\.(\w+)/g, '"$1"');
  const meta = new Function(src)();
  // Symbole aus Enums.ts
  const en = fs.readFileSync(path.join(REF, "Enums.ts"), "utf8");
  const sym = {};
  for (const m of en.matchAll(/\[(?:LocationName\.(\w+)|"([^"]+)")\]:\s*"(\w+)"/g)) sym[m[1] ?? m[2]] = m[3];
  for (const x of meta) {
    x.locKey = x.name;
    x.symbol = sym[x.name];
    if (!x.symbol) throw new Error("kein Symbol fuer " + x.name);
  }
  return meta;
}

// ---------------------------------------------------------------------------
// Zufall
// ---------------------------------------------------------------------------
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randInt = (R, min, max) => Math.floor(R() * (max - min + 1) + min); // getRandomIntInclusive
function toNumber(R, n) {
  if (typeof n === "number") return n;
  const v = randInt(R, n.min, n.max);
  return typeof n.divisor === "number" ? v / n.divisor : v;
}

// ---------------------------------------------------------------------------
// Stock und Markt
// ---------------------------------------------------------------------------
export class Stock {
  constructor(R, p) {
    this.name = p.name;
    this.symbol = p.symbol;
    this.price = toNumber(R, p.initPrice);
    this.lastPrice = this.price;
    this.playerShares = 0; this.playerAvgPx = 0;
    this.playerShortShares = 0; this.playerAvgShortPx = 0;
    this.mv = toNumber(R, p.mv);
    this.b = p.b;
    this.otlkMag = p.otlkMag;
    this.otlkMagForecast = this.getAbsoluteForecast();
    this.cap = randInt(R, this.price * 1e3, this.price * 25e3);
    this.spreadPerc = toNumber(R, p.spreadPerc);
    this.shareTxForMovement = toNumber(R, p.shareTxForMovement);
    this.shareTxUntilMovement = this.shareTxForMovement;
    const totalSharesUnrounded = p.marketCap / this.price;
    this.totalShares = Math.round(totalSharesUnrounded / 1e5) * 1e5;
    this.maxShares = Math.round((this.totalShares * 0.2) / 1e5) * 1e5;
  }
  changeForecastForecast(n) { this.otlkMagForecast = Math.min(100, Math.max(0, n)); }
  getAbsoluteForecast() { return this.b ? 50 + this.otlkMag : 50 - this.otlkMag; }
  getAskPrice() { return this.price * (1 + this.spreadPerc / 100); }
  getBidPrice() { return this.price * (1 - this.spreadPerc / 100); }
  getForecastIncreaseChance() {
    const diff = this.otlkMagForecast - this.getAbsoluteForecast();
    return (50 + Math.min(Math.max(diff, -45), 45)) / 100;
  }
  cycleForecast(R, ch) {
    const inc = this.getForecastIncreaseChance();
    if (R() < inc) { if (this.b) this.otlkMag += ch; else this.otlkMag -= ch; }
    else if (this.b) this.otlkMag -= ch; else this.otlkMag += ch;
    this.otlkMag = Math.min(this.otlkMag, 50);
    if (this.otlkMag < 0) { this.otlkMag *= -1; this.b = !this.b; }
  }
  cycleForecastForecast(R, ch) {
    if (R() < 0.5) this.changeForecastForecast(this.otlkMagForecast + ch);
    else this.changeForecastForecast(this.otlkMagForecast - ch);
  }
  influenceForecast(ch) {
    if (this.otlkMag > CONST.StockForecastInfluenceLimit) this.otlkMag = Math.max(CONST.StockForecastInfluenceLimit, this.otlkMag - ch);
  }
  influenceForecastForecast(ch) {
    if (this.otlkMagForecast > 50) this.otlkMagForecast = Math.max(50, this.otlkMagForecast - ch);
    else if (this.otlkMagForecast < 50) this.otlkMagForecast = Math.min(50, this.otlkMagForecast + ch);
  }
  // getForecast (NetscriptFunctions/StockMarket.ts:237-247), nur mit 4S-API
  forecast() { return (this.b ? 50 + this.otlkMag : 50 - this.otlkMag) / 100; }
  volatility() { return this.mv / 100; }
}

export class Market {
  constructor(seed, meta = loadMetadata()) {
    this.R = rng(seed);
    this.stocks = meta.map((m) => new Stock(this.R, m));
    this.bySym = Object.fromEntries(this.stocks.map((s) => [s.symbol, s]));
    this.ticksUntilCycle = randInt(this.R, 1, CONST.TicksPerCycle); // StockMarket.ts:208
    this.tickNo = 0;
    this.cycles = 0;
    this.push = null; // optionale Kursbeeinflussung: (market) => void, vor dem Tick
  }
  cycle() {
    for (const s of this.stocks) {
      if (this.R() < 0.45) { s.b = !s.b; s.otlkMagForecast = 100 - s.otlkMagForecast; }
      this.ticksUntilCycle = CONST.TicksPerCycle;
    }
    this.cycles++;
  }
  tick() {
    this.tickNo++;
    --this.ticksUntilCycle;
    if (this.ticksUntilCycle <= 0) this.cycle();
    const v = this.R();
    for (const s of this.stocks) {
      const vol = s.mv; // getDarknetVolatilityMult = 1 ohne Darknet-Werbung
      let av = (v * vol) / 100;
      let chc = 50;
      chc = s.b ? (chc + s.otlkMag) / 100 : (chc - s.otlkMag) / 100;
      if (s.price >= s.cap) { chc = 0.1; s.b = false; }
      const c = this.R();
      if (c < chc) s.price = (s.lastPrice = s.price) * (1 + av);
      else s.price = (s.lastPrice = s.price) / (1 + av);
      let ch = s.otlkMag * av;
      if (s.otlkMag < 5) { if (s.otlkMag <= 1) ch = 1; else ch *= 10; }
      s.cycleForecast(this.R, ch);
      s.cycleForecastForecast(this.R, ch / 2);
      s.shareTxUntilMovement = Math.min(s.shareTxUntilMovement + 10, s.shareTxForMovement);
    }
  }
}

// ---------------------------------------------------------------------------
// Konto und Transaktionen (BuyingAndSelling.tsx, StockMarketHelpers.ts)
// ---------------------------------------------------------------------------
export function processTransactionForecastMovement(s, shares) {
  shares = Math.min(shares, s.maxShares);
  const first = s.shareTxUntilMovement;
  if (shares <= first) {
    s.shareTxUntilMovement -= shares;
    if (s.shareTxUntilMovement <= 0) {
      s.shareTxUntilMovement = s.shareTxForMovement;
      s.influenceForecast(CONST.forecastChangePerPriceMovement);
      s.influenceForecastForecast(CONST.forecastChangePerPriceMovement * (s.mv / 100));
    }
    return;
  }
  const remaining = shares - first;
  let n = 1 + Math.ceil(remaining / s.shareTxForMovement);
  s.shareTxUntilMovement = s.shareTxForMovement - ((shares - s.shareTxUntilMovement) % s.shareTxForMovement);
  if (s.shareTxUntilMovement === s.shareTxForMovement || s.shareTxUntilMovement <= 0) { ++n; s.shareTxUntilMovement = s.shareTxForMovement; }
  const fc = CONST.forecastChangePerPriceMovement * (n - 1);
  s.influenceForecast(fc);
  s.influenceForecastForecast(fc * (s.mv / 100));
}

export class Account {
  constructor(cash) { this.cash = cash; this.commissions = 0; this.trades = 0; this.spent = 0; }
  buy(s, shares) { // buyStock
    shares = Math.round(shares);
    if (shares <= 0) return false;
    const cost = Math.min(shares, s.maxShares) * s.getAskPrice() + CONST.StockMarketCommission;
    if (this.cash < cost) return false;
    if (shares + s.playerShares + s.playerShortShares > s.maxShares) return false;
    const origTotal = s.playerShares * s.playerAvgPx;
    this.cash -= cost;
    s.playerShares = Math.round(s.playerShares + shares);
    s.playerAvgPx = (origTotal + cost - CONST.StockMarketCommission) / s.playerShares;
    processTransactionForecastMovement(s, shares);
    this.commissions += CONST.StockMarketCommission; this.trades++;
    return true;
  }
  sell(s, shares) { // sellStock
    shares = Math.round(shares);
    if (shares > s.playerShares) shares = s.playerShares;
    if (shares <= 0) return false;
    const gain = Math.min(shares, s.maxShares) * s.getBidPrice() - CONST.StockMarketCommission;
    this.cash += gain;
    s.playerShares = Math.round(s.playerShares - shares);
    if (s.playerShares === 0) s.playerAvgPx = 0;
    processTransactionForecastMovement(s, shares);
    this.commissions += CONST.StockMarketCommission; this.trades++;
    return true;
  }
  short(s, shares) { // shortStock
    shares = Math.round(shares);
    if (shares <= 0) return false;
    const cost = Math.min(shares, s.maxShares) * s.getBidPrice() + CONST.StockMarketCommission;
    if (this.cash < cost) return false;
    if (shares + s.playerShares + s.playerShortShares > s.maxShares) return false;
    const orig = s.playerShortShares * s.playerAvgShortPx;
    this.cash -= cost;
    s.playerShortShares = Math.round(s.playerShortShares + shares);
    s.playerAvgShortPx = (orig + cost - CONST.StockMarketCommission) / s.playerShortShares;
    processTransactionForecastMovement(s, shares);
    this.commissions += CONST.StockMarketCommission; this.trades++;
    return true;
  }
  cover(s, shares) { // sellShort
    shares = Math.round(shares);
    if (shares > s.playerShortShares) shares = s.playerShortShares;
    if (shares <= 0) return false;
    const n = Math.min(shares, s.maxShares);
    const origCost = n * s.playerAvgShortPx;
    const profit = (s.playerAvgShortPx - s.getAskPrice()) * n - CONST.StockMarketCommission;
    this.cash += origCost + profit;
    s.playerShortShares = Math.round(s.playerShortShares - shares);
    if (s.playerShortShares === 0) s.playerAvgShortPx = 0;
    processTransactionForecastMovement(s, shares);
    this.commissions += CONST.StockMarketCommission; this.trades++;
    return true;
  }
  // Liquidationswert (alles zum Geldkurs verkaufen, Kommission je Posten)
  wealth(market) {
    let w = this.cash;
    for (const s of market.stocks) {
      if (s.playerShares > 0) w += s.playerShares * s.getBidPrice() - CONST.StockMarketCommission;
      if (s.playerShortShares > 0) w += s.playerShortShares * s.playerAvgShortPx + (s.playerAvgShortPx - s.getAskPrice()) * s.playerShortShares - CONST.StockMarketCommission;
    }
    return w;
  }
  depot(market) { return this.wealth(market) - this.cash; }
}

// ---------------------------------------------------------------------------
// Strategien
// ---------------------------------------------------------------------------

// Nachbau src/boerse.js:151-308 (eine Runde je Tick; TAKT_MS 6000 = Tick).
// opts.fourS: 4S-API vorhanden; opts.buy4S: Kaufregel :178-193 aktiv
// opts.fourSCost: 25e9 x FourSigmaMarketDataApiCost
export function makeBotStrategy(opts = {}) {
  const HISTORIE = 40, KAUF = 0.575, VERKAUF = 0.5, ANTEIL = 0.25, BAR = 0.15, KOMM = 100e3;
  const st = { hat4S: !!opts.fourS, gekauft4S: false, hist: new Map(), boughtAtTick: null };
  const schaetzung = (h) => { // boerse.js:342-355
    if (h.length < 11) return 0.5;
    let hoch = 0, schritte = 0;
    for (let i = 1; i < h.length; i++) { if (h[i] === h[i - 1]) continue; schritte++; if (h[i] > h[i - 1]) hoch++; }
    if (schritte < 10) return 0.5;
    return hoch / schritte;
  };
  return {
    name: "bot" + (opts.fourS ? "-4S" : "-Historie"),
    state: st,
    act(m, acc) {
      // :178-193 4S-Kauf mit dem BARGELD zu Rundenbeginn
      if (!st.hat4S && !st.gekauft4S && opts.buy4S !== false) {
        if (acc.cash >= 26e9) {
          const cost = opts.fourSCost ?? 25e9;
          if (acc.cash >= cost) { acc.cash -= cost; acc.spent += cost; st.gekauft4S = true; st.hat4S = true; st.boughtAtTick = m.tickNo; }
        }
      }
      const lage = [];
      for (const s of m.stocks) {
        let h = st.hist.get(s.symbol);
        if (!h) { h = []; st.hist.set(s.symbol, h); }
        h.push(s.price);
        while (h.length > HISTORIE + 1) h.shift();
        let f = null, quelle = null;
        if (st.hat4S) { f = s.forecast(); quelle = "4S"; }
        if (f === null) { f = schaetzung(h); quelle = "Historie"; }
        lage.push({ s, f, quelle, ticks: h.length - 1 });
      }
      for (const e of lage) { // :221-236
        const lang = e.s.playerShares;
        if (lang <= 0) continue;
        if (e.quelle === "Historie" && e.ticks < 20) continue;
        if (e.f >= VERKAUF) continue;
        acc.sell(e.s, lang);
      }
      const einsetzbar = acc.cash * (1 - BAR); // :239-240
      const kand = lage.filter((e) => e.f >= KAUF).filter((e) => e.quelle === "4S" || e.ticks >= 20).sort((a, b) => b.f - a.f);
      for (const e of kand) { // :246-265
        const frei = acc.cash * (1 - BAR);
        if (frei <= 0) break;
        const budget = Math.min(frei, einsetzbar * ANTEIL);
        if (budget < KOMM * 50) continue;
        const stueck = Math.min(Math.floor((budget - KOMM) / e.s.price), e.s.maxShares - e.s.playerShares);
        if (stueck <= 0) continue;
        acc.buy(e.s, stueck);
      }
    },
  };
}

// Beste Alternative mit 4S: Rang nach erwartetem Ertrag je Tick
// er = (2f-1) * E[av], E[av] = mv/200 (v ~ U(0,1), StockMarket.ts:264-269).
// Einstieg ab |f-0,5| >= entry, Ausstieg wenn das Vorzeichen kippt.
// shorts nur in BN8 oder mit SF8.2 (NetscriptFunctions/StockMarket.ts:46-53,156-175).
// reserve: absoluter Barbestand, der nie investiert wird.
export function makeOptStrategy(opts = {}) {
  const entry = opts.entry ?? 0.05;
  const shorts = !!opts.shorts;
  const reserve = opts.reserve ?? 0;
  return {
    name: "opt-4S" + (shorts ? "-LS" : "-L") + "-e" + entry,
    act(m, acc) {
      for (const s of m.stocks) {
        const f = s.forecast();
        if (s.playerShares > 0 && f < 0.5) acc.sell(s, s.playerShares);
        if (s.playerShortShares > 0 && f > 0.5) acc.cover(s, s.playerShortShares);
      }
      const cand = [];
      for (const s of m.stocks) {
        const f = s.forecast();
        const er = (2 * f - 1) * (s.mv / 200); // relativer Ertrag je Tick
        if (f - 0.5 >= entry) cand.push({ s, er, long: true });
        else if (shorts && 0.5 - f >= entry) cand.push({ s, er: -er, long: false });
      }
      cand.sort((a, b) => b.er - a.er);
      for (const c of cand) {
        const free = acc.cash - reserve;
        if (free < 2e7) break; // Mindestposition: 2x Kommission < 1 %
        const s = c.s;
        const room = s.maxShares - s.playerShares - s.playerShortShares;
        if (room <= 0) continue;
        const px = c.long ? s.getAskPrice() : s.getBidPrice();
        const n = Math.min(room, Math.floor((free - CONST.StockMarketCommission) / px));
        if (n <= 0) continue;
        if (n * px < 1e7) continue;
        if (c.long) acc.buy(s, n); else acc.short(s, n);
      }
    },
  };
}

// Ohne 4S, aber mit Long+Short und kuerzerem Fenster: zum Vergleich der
// Schaetzerqualitaet (nicht der Bot).
export function makeHistStrategy(opts = {}) {
  const W = opts.window ?? 40, entry = opts.entry ?? 0.075, shorts = !!opts.shorts;
  const hist = new Map();
  return {
    name: "hist-w" + W + "-e" + entry + (shorts ? "-LS" : "-L"),
    act(m, acc) {
      const est = new Map();
      for (const s of m.stocks) {
        let h = hist.get(s.symbol); if (!h) { h = []; hist.set(s.symbol, h); }
        h.push(s.price > s.lastPrice ? 1 : 0); while (h.length > W) h.shift();
        est.set(s.symbol, h.length >= Math.min(W, 20) ? h.reduce((a, b) => a + b, 0) / h.length : 0.5);
      }
      for (const s of m.stocks) {
        const f = est.get(s.symbol);
        if (s.playerShares > 0 && f < 0.5) acc.sell(s, s.playerShares);
        if (s.playerShortShares > 0 && f > 0.5) acc.cover(s, s.playerShortShares);
      }
      const cand = [];
      for (const s of m.stocks) {
        const f = est.get(s.symbol);
        const er = (2 * f - 1) * s.mv;
        if (f - 0.5 >= entry) cand.push({ s, er, long: true });
        else if (shorts && 0.5 - f >= entry) cand.push({ s, er: -er, long: false });
      }
      cand.sort((a, b) => b.er - a.er);
      for (const c of cand) {
        const free = acc.cash;
        if (free < 2e7) break;
        const s = c.s;
        const room = s.maxShares - s.playerShares - s.playerShortShares;
        if (room <= 0) continue;
        const px = c.long ? s.getAskPrice() : s.getBidPrice();
        const n = Math.min(room, Math.floor((Math.min(free, opts.maxPos ?? Infinity) - CONST.StockMarketCommission) / px));
        if (n <= 0 || n * px < 1e7) continue;
        if (c.long) acc.buy(s, n); else acc.short(s, n);
      }
    },
  };
}

// Laeuft eine Strategie ticks lang, Rueckgabe: Verlauf des Liquidationswerts
export function run({ seed, cash, ticks, strategy, warmup = 0, sampleEvery = 600, onTick }) {
  const m = new Market(seed);
  for (let i = 0; i < warmup; i++) m.tick(); // Markt einschwingen (Spiel laeuft schon)
  const acc = new Account(cash);
  const samples = [];
  for (let t = 1; t <= ticks; t++) {
    if (m.push) m.push(m, acc);
    m.tick();
    strategy.act(m, acc);
    if (onTick) onTick(m, acc, t);
    if (t % sampleEvery === 0) samples.push({ t, h: (t * 6) / 3600, w: acc.wealth(m), cash: acc.cash });
  }
  return { market: m, acc, samples, strategy };
}

// ---------------------------------------------------------------------------
// Eichung / Selbsttest
// ---------------------------------------------------------------------------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain && process.argv.includes("--eich")) {
  const c = checkConstants();
  console.log("Konstanten aus Constants.ts:", JSON.stringify(c));
  const meta = loadMetadata();
  console.log("Aktien aus InitStockMetadata.ts:", meta.length, "Symbole", meta.map((x) => x.symbol).join(","));
  // (1) Up-Tick-Anteil gegen die mittlere Vorhersage (Erwartungstreue des Tick-Modells)
  let up = 0, n = 0, fsum = 0;
  const m = new Market(1, meta);
  for (let t = 0; t < 20000; t++) {
    const pre = m.stocks.map((s) => (s.price >= s.cap ? 0.1 : s.forecast()));
    m.tick();
    m.stocks.forEach((s, i) => { fsum += pre[i]; n++; if (s.price > s.lastPrice) up++; });
  }
  console.log("Up-Tick-Anteil", (up / n).toFixed(5), "mittlere Vorhersage vor dem Tick", (fsum / n).toFixed(5),
    "(Abweichung durch Zyklus-Kippen am Tickanfang erwartet klein)");
  // (2) maxShares-Formel und Kapazitaet (Stock.ts:144-150)
  let cap = 0;
  for (const s of m.stocks) cap += s.maxShares * s.price;
  console.log("Kapazitaet sum(maxShares*Preis) nach 20000 Ticks:", (cap / 1e12).toFixed(2), "Bio $");
  const m0 = new Market(7, meta);
  let cap0 = 0;
  for (const s of m0.stocks) cap0 += s.maxShares * s.price;
  console.log("Kapazitaet bei Marktstart:", (cap0 / 1e12).toFixed(2), "Bio $ (= 0,2 x Summe marketCap",
    (meta.reduce((a, x) => a + x.marketCap, 0) * 0.2 / 1e12).toFixed(2), "Bio, bis auf Rundung)");
}
