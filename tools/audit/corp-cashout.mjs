// Audit 03.10.2026, Bereich CORP: "Seed-Auszahlung" - wie viel Spielergeld
// liefert eine Corporation OHNE jedes Geschaeft, nur ueber Boersengang und
// Anteilsverkauf? Und wann?
//
// Nachgebaut (Spiel 3.0.2):
//   Corporation.ts:109-187  process(): START-Zustand je Marktzyklus (10 s),
//                           updateTotalAssets, determineCycleValuation,
//                           determineValuation (Mittel der letzten 10), updateSharePrice
//   Corporation.ts:264-274  updateSharePrice (Zufall U(0,1) -> Monte Carlo mit fester Saat)
//   Actions.ts:145-160      goPublic (Kurs = Zielkurs mit der GEMITTELTEN Bewertung)
//   Actions.ts:348-361      sellShares -> Player.gainMoney (kein Tribut, keine Steuer)
//   helpers.ts:85-90        Gruendungskosten 150 Mrd (ausser Seed in BN3)
//   PlayerObjectCorporationMethods.ts:27-30  Seed: +500 Mio Investorenanteile
// Formeln aus corp-formeln.mjs (dort gegen die Jest-Sollwerte des Spiels geeicht).
//
// Aufruf: node tools/audit/corp-cashout.mjs [--laeufe 400]
import { C, cycleValuation, targetSharePrice, calculateShareSale, BN_CORP } from "./corp-formeln.mjs";

// kleiner deterministischer Zufallsgenerator (mulberry32), damit das Ergebnis reproduzierbar ist
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ein Lauf: Gruendung, privat warten bis die Bewertungsliste voll ist,
 * goPublic(0), warten bis der Kurs den Zielkurs erreicht, alles bis auf
 * 1 Mio Anteile verkaufen.
 * @returns {{tSaleMin:number, proceeds:number, cost:number}}
 */
function oneRun({ seedFunded, valMult, rand, ipoAfterCycles = 10, sellFracOfTarget = 0.99, maxCycles = 5000, ipoAtCreation = false }) {
  const corp = {
    funds: 150e9,
    totalShares: C.initialShares + (seedFunded ? 500e6 : 0),
    numShares: C.initialShares,
    investorShares: seedFunded ? 500e6 : 0,
    issuedShares: 0,
    isPublic: false,
    valuationsList: [0],
    valuation: 0,
    sharePrice: 0,
    shareSalesUntilPriceUpdate: C.sharesPerPriceUpdate,
    totalAssets: 150e9,
    previousTotalAssets: 150e9,
  };
  if (ipoAtCreation) {
    // FALLE: goPublic vor dem ersten START-Zyklus - valuation ist noch 0 (valuationsList [0]),
    // also Kurs 0 -> updateSharePrice klemmt auf 0,01 und steigt nur ~0,5 %/Zyklus.
    corp.sharePrice = targetSharePrice(corp.valuation, corp.numShares, corp.totalShares);
    corp.isPublic = true;
  }
  for (let cyc = 1; cyc <= maxCycles; cyc++) {
    // START-Zustand (Corporation.ts:137-176), ohne Divisionen: Umsatz/Kosten 0
    corp.previousTotalAssets = corp.totalAssets;
    corp.totalAssets = corp.funds; // updateTotalAssets ohne Divisionen
    const assetDelta = (corp.totalAssets - corp.previousTotalAssets) / C.secondsPerMarketCycle;
    const cv = cycleValuation({ funds: corp.funds, assetDelta, isPublic: corp.isPublic, nOffWh: 0, valMult });
    corp.valuationsList.push(cv);
    if (corp.valuationsList.length > C.valuationLength) corp.valuationsList.shift();
    corp.valuation = corp.valuationsList.reduce((a, b) => a + b) / corp.valuationsList.length;
    // updateSharePrice
    const target = targetSharePrice(corp.valuation, corp.numShares, corp.totalShares);
    if (corp.sharePrice <= target) corp.sharePrice *= 1 + rand() * 0.01;
    else corp.sharePrice *= 1 - rand() * 0.01;
    if (corp.sharePrice <= 0.01) corp.sharePrice = 0.01;

    // Spieleraktionen zwischen den Zyklen
    if (!corp.isPublic && cyc >= ipoAfterCycles) {
      // goPublic(0): Kurs = Zielkurs mit der aktuellen (gemittelten) Bewertung
      corp.sharePrice = targetSharePrice(corp.valuation, corp.numShares, corp.totalShares);
      corp.isPublic = true;
      continue;
    }
    if (corp.isPublic) {
      const tgt = targetSharePrice(corp.valuation, corp.numShares, corp.totalShares);
      if (corp.sharePrice >= sellFracOfTarget * tgt && corp.valuationsList.every((v) => v === corp.valuationsList[0])) {
        const n = corp.numShares - 1e6;
        const [profit] = calculateShareSale(corp, n);
        return {
          tSaleMin: (cyc * C.secondsPerMarketCycle) / 60,
          proceeds: profit,
          cost: seedFunded ? 0 : 150e9,
          priceAtSale: corp.sharePrice,
          target: tgt,
        };
      }
    }
  }
  return { tSaleMin: NaN, proceeds: 0, cost: seedFunded ? 0 : 150e9 };
}

function stats(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { mean: s.reduce((a, b) => a + b, 0) / s.length, p05: q(0.05), p50: q(0.5), p95: q(0.95) };
}

const runs = Number((process.argv.find((a) => a.startsWith("--laeufe=")) || "--laeufe=400").split("=")[1]);
const fmt = (x) => (x / 1e9).toFixed(1) + " Mrd";

console.log(`Monte Carlo, ${runs} Laeufe je Fall, Saat fest.\n`);
const cases = [
  { name: "BN3, Seed (gratis)", seedFunded: true, valMult: 1 },
  { name: "BN3, Seed, IPO sofort (FALLE)", seedFunded: true, valMult: 1, ipoAtCreation: true },
  { name: "BN3, Seed, Verkauf ohne Warten", seedFunded: true, valMult: 1, sellFracOfTarget: 0 },
  { name: "BN3, selbst bezahlt", seedFunded: false, valMult: 1 },
  ...[6, 7, 11, 13, 14, 15].map((bn) => ({
    name: `BN${bn} mit SF3, selbst bezahlt`,
    seedFunded: false,
    valMult: BN_CORP[bn].Valuation,
  })),
];
for (const c of cases) {
  const t = [],
    p = [];
  const rand = rng(12345);
  for (let i = 0; i < runs; i++) {
    const r = oneRun({ ...c, rand });
    t.push(r.tSaleMin);
    p.push(r.proceeds - r.cost);
  }
  const st = stats(t),
    sp = stats(p);
  console.log(
    `${c.name.padEnd(30)} Verkauf nach ${st.p50.toFixed(1)} min (p05 ${st.p05.toFixed(1)} / p95 ${st.p95.toFixed(1)})  ` +
      `netto an den Spieler ${fmt(sp.mean)} (p05 ${fmt(sp.p05)} / p95 ${fmt(sp.p95)})`,
  );
}

// Analytische Gegenprobe: Kurs folgt dem Zielkurs (+-0,5 % je 1 Mio Anteile),
// Erloes = Integral des Zielkurses ueber die verkauften Anteile.
function integralProceeds(valuation, total, owned) {
  // int_0^owned valuation/total * (0.5 + sqrt(n/total)) dn
  return (valuation / total) * (0.5 * owned + (2 / 3) * Math.pow(owned, 1.5) / Math.sqrt(total));
}
console.log(
  `\nGegenprobe analytisch (Integral des Zielkurses): BN3 Seed ${fmt(integralProceeds(150e9, 1.5e9, 1e9 - 1e6))}, ` +
    `selbst bezahlt ${fmt(integralProceeds(150e9, 1e9, 1e9 - 1e6) - 150e9)} netto`,
);
