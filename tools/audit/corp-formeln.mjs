// Audit 03.10.2026, Bereich CORP: Formeln der Corporation als ausfuehrbarer Code.
//
// Quelle (Spiel 3.0.2, nur gelesen):
//   reference/bitburner-src/src/Corporation/helpers.ts        (Upgrade-, Bueroausbaukosten)
//   reference/bitburner-src/src/Corporation/Actions.ts        (Lagerausbau, Anteile, IPO, Investoren)
//   reference/bitburner-src/src/Corporation/Corporation.ts    (Bewertung, Kurs, Dividende)
//   reference/bitburner-src/src/Corporation/Division.ts       (Produktion, Platzgrenze)
//   reference/bitburner-src/src/Corporation/data/Constants.ts (Konstanten)
//   reference/bitburner-src/src/Corporation/data/CorporationUpgrades.ts
//
// Eichung: Es gibt KEINEN Spielstand mit einer Corporation (der Bot hatte nie
// eine, SF3 fehlt). Geeicht wird deshalb gegen die unabhaengigen Sollwerte der
// spieleigenen Testsuite:
//   reference/bitburner-src/test/jest/Corporation.test.ts
//   reference/bitburner-src/test/jest/__snapshots__/Corporation.test.ts.snap
// Aufruf: node tools/audit/corp-formeln.mjs --eich
import fs from "node:fs";

// ---------------------------------------------------------------- Konstanten
// data/Constants.ts
export const C = {
  initialShares: 1e9,
  sharesPerPriceUpdate: 1e6,
  issueNewSharesCooldown: 72e3,
  sellSharesCooldown: 18e3,
  gameCyclesPerMarketCycle: 50,
  milliPerCycle: 200, // Constants.ts:19
  warehouseInitialCost: 5e9,
  warehouseInitialSize: 100,
  warehouseSizeUpgradeCostBase: 1e9,
  officeInitialCost: 4e9,
  officeInitialSize: 3,
  bribeThreshold: 100e12,
  bribeAmountPerReputation: 1e9,
  dividendMaxRate: 1,
  fundingRoundShares: [0.1, 0.35, 0.25, 0.2],
  fundingRoundMultiplier: [3, 2, 2, 1.5],
  valuationLength: 10,
  teaCostPerEmployee: 500e3,
};
C.secondsPerMarketCycle = (C.gameCyclesPerMarketCycle * C.milliPerCycle) / 1000; // = 10

// data/CorporationUpgrades.ts
export const UPGRADES = {
  "Smart Factories": { basePrice: 2e9, priceMult: 1.06, benefit: 0.03 },
  "Smart Storage": { basePrice: 2e9, priceMult: 1.06, benefit: 0.1 },
  "Wilson Analytics": { basePrice: 4e9, priceMult: 2, benefit: 0.005 },
  "Nuoptimal Nootropic Injector Implants": { basePrice: 1e9, priceMult: 1.06, benefit: 0.1 },
  "Speech Processor Implants": { basePrice: 1e9, priceMult: 1.06, benefit: 0.1 },
  "Neural Accelerators": { basePrice: 1e9, priceMult: 1.06, benefit: 0.1 },
  FocusWires: { basePrice: 1e9, priceMult: 1.06, benefit: 0.1 },
  "ABC SalesBots": { basePrice: 1e9, priceMult: 1.07, benefit: 0.01 },
  "Project Insight": { basePrice: 5e9, priceMult: 1.07, benefit: 0.05 },
};

// data/CorporationUnlocks.ts
export const UNLOCKS = {
  Export: 20e9,
  "Smart Supply": 25e9,
  "Market Research - Demand": 5e9,
  "Market Data - Competition": 5e9,
  "Shady Accounting": 500e12,
  "Government Partnership": 2e15,
  "Warehouse API": 50e9,
  "Office API": 50e9,
};

// MaterialInfo.ts (size, baseCost)
export const MAT = {
  Water: { size: 0.05, baseCost: 1500 },
  Ore: { size: 0.01, baseCost: 500 },
  Minerals: { size: 0.04, baseCost: 500 },
  Food: { size: 0.03, baseCost: 5000 },
  Plants: { size: 0.05, baseCost: 3000 },
  Metal: { size: 0.1, baseCost: 2650 },
  Hardware: { size: 0.06, baseCost: 8e3 },
  Chemicals: { size: 0.05, baseCost: 9e3 },
  Drugs: { size: 0.02, baseCost: 40e3 },
  Robots: { size: 0.5, baseCost: 75e3 },
  "AI Cores": { size: 0.1, baseCost: 15e3 },
  "Real Estate": { size: 0.005, baseCost: 80e3 },
};
export const MAT_ORDER = Object.keys(MAT); // Reihenfolge wie Enums.ts CorpMaterialName

// BitNode.tsx:563ff - Corporation-Multiplikatoren je Knoten (fehlend = 1)
export const BN_CORP = {
  1: { Valuation: 1, Softcap: 1, Divisions: 1 },
  2: { Valuation: 1, Softcap: 0.9, Divisions: 0.9 },
  3: { Valuation: 1, Softcap: 1, Divisions: 1 },
  6: { Valuation: 0.2, Softcap: 0.9, Divisions: 0.8 },
  7: { Valuation: 0.2, Softcap: 0.9, Divisions: 0.8 },
  8: { Valuation: 0, Softcap: 0, Divisions: 0 },
  11: { Valuation: 0.1, Softcap: 0.9, Divisions: 0.9 },
  13: { Valuation: 0.001, Softcap: 0.4, Divisions: 0.4 },
  14: { Valuation: 0.4, Softcap: 0.9, Divisions: 0.8 },
  15: { Valuation: 0.2, Softcap: 0.4, Divisions: 0.4 },
};

// ------------------------------------------------------------------ Kosten
// helpers.ts:96-105
export function calculateUpgradeCost(basePrice, priceMult, fromLevel, amount) {
  const baseCost = basePrice * Math.pow(priceMult, fromLevel);
  const cost = (baseCost * (1 - Math.pow(priceMult, amount))) / (1 - priceMult);
  return cost;
}

// helpers.ts:107-114
export function calculateOfficeSizeUpgradeCost(currentSize, sizeIncrease) {
  if (sizeIncrease <= 0) throw new Error("Invalid value for sizeIncrease");
  const baseCostDivisor = 0.09;
  const baseCostMultiplier = 1 + baseCostDivisor;
  const currentSizeFactor = baseCostMultiplier ** (currentSize / 3);
  const sizeIncreaseFactor = baseCostMultiplier ** (sizeIncrease / 3) - 1;
  return (C.officeInitialCost / baseCostDivisor) * currentSizeFactor * sizeIncreaseFactor;
}

// Actions.ts:418-423
export function upgradeWarehouseCost(level, amt) {
  return Array.from(Array(amt).keys()).reduce(
    (acc, index) => acc + C.warehouseSizeUpgradeCostBase * Math.pow(1.07, level + 1 + index),
    0,
  );
}

// Division.ts getAdVertCost
export const adVertCost = (numAdVerts) => 1e9 * Math.pow(1.06, numAdVerts);

// ---------------------------------------------------------- Bewertung/Kurs
// Corporation.ts:54 (+ purchaseUnlock: Shady -0,05, Government -0,1)
export const tributeModifier = (softcap, shady = false, gov = false) =>
  1 - softcap + 0.15 - (shady ? 0.05 : 0) - (gov ? 0.1 : 0);

// Corporation.ts:196-221 determineCycleValuation (assetDelta je Sekunde)
export function cycleValuation({ funds, assetDelta, isPublic, dividendRate = 0, nOffWh = 0, valMult = 1 }) {
  let val;
  if (isPublic) {
    let ad = assetDelta;
    if (dividendRate > 0) ad *= 1 - dividendRate;
    val = funds + ad * 85e3;
    val *= Math.pow(1.0079741404289038, nOffWh);
    val = Math.max(val, 0);
  } else {
    val = 10e9 + funds / 3;
    if (assetDelta > 0) val += assetDelta * 315e3;
    val *= Math.pow(1.0079741404289038, nOffWh);
    val -= val % 1e6;
  }
  if (val < 10e9) val = 10e9;
  return val * valMult;
}

// Corporation.ts:253-262
export function targetSharePrice(valuation, numShares, totalShares, ceoOwnership = null) {
  if (ceoOwnership === null) ceoOwnership = numShares / totalShares;
  const ceoConfidence = 0.5 + Math.sqrt(Math.max(0, ceoOwnership));
  return (valuation * ceoConfidence) / totalShares;
}

// Corporation.ts:283-322 calculateShareSale (deterministisch)
export function calculateShareSale(corp, numShares) {
  let sharesRemaining = numShares;
  let sharesUntilUpdate = corp.shareSalesUntilPriceUpdate;
  let sharePrice = corp.sharePrice;
  let sharesSold = 0;
  let profit = 0;
  const sharesPerStep = Math.sign(numShares || 1) * C.sharesPerPriceUpdate;
  const maxIterations = Math.ceil(numShares / sharesPerStep);
  for (let i = 0; i < maxIterations; ++i) {
    if (Math.abs(sharesRemaining) < Math.abs(sharesUntilUpdate)) {
      profit += sharePrice * sharesRemaining;
      sharesUntilUpdate -= sharesRemaining;
      break;
    } else {
      profit += sharePrice * sharesPerStep;
      sharesRemaining -= sharesPerStep;
      sharesSold += sharesPerStep;
      const ceoOwnership = (corp.numShares - sharesSold) / corp.totalShares;
      const targetPrice = targetSharePrice(corp.valuation, corp.numShares, corp.totalShares, ceoOwnership);
      if (sharePrice <= targetPrice) sharePrice *= 1 + 0.5 * 0.01;
      else sharePrice *= 1 - 0.5 * 0.01;
      sharesUntilUpdate = C.sharesPerPriceUpdate;
    }
  }
  return [profit, sharePrice, sharesUntilUpdate];
}

// Corporation.ts:224-231 Dividende je Marktzyklus an den Spieler
export function cycleDividends({ revenue, expenses, dividendRate, numShares, totalShares, tribute }) {
  const profit = revenue - expenses;
  const cycleProfit = profit * C.secondsPerMarketCycle;
  const totalDividends = dividendRate * cycleProfit;
  const dividendsPerShare = totalDividends / totalShares;
  const dividends = numShares * dividendsPerShare;
  return Math.pow(dividends, 1 - tribute);
}

// Corporation.ts:325-345 / Actions.ts:191-209
export function investmentOffer(valuation, fundingRound) {
  if (fundingRound >= C.fundingRoundShares.length) return { funds: 0, shares: 0 };
  const percShares = C.fundingRoundShares[fundingRound];
  const roundMultiplier = C.fundingRoundMultiplier[fundingRound];
  return { funds: valuation * percShares * roundMultiplier, shares: Math.floor(C.initialShares * percShares) };
}

// ------------------------------------------------- Produktion (Platzgrenze)
// Division.ts:556-690 PRODUCTION fuer eine Material-Industrie, nur die
// Mengenlogik (Qualitaet/Durchschnittspreis weggelassen). stored wird veraendert.
export function productionStep({ stored, size, rawProdPerCycle, required, produced, limits }) {
  const sizeUsedBefore = sizeUsedOf(stored);
  let prod = rawProdPerCycle;
  let totalMatSize = 0;
  for (const m of produced) totalMatSize += MAT[m].size;
  for (const [m, q] of Object.entries(required)) totalMatSize -= MAT[m].size * q;
  if (totalMatSize > 0) {
    const maxAmt = Math.floor((size - sizeUsedBefore) / totalMatSize);
    prod = Math.min(maxAmt, prod);
  }
  if (prod < 0) prod = 0;
  let producibleFrac = 1;
  for (const [m, q] of Object.entries(required)) {
    const req = q * prod;
    if (stored[m] < req) producibleFrac = Math.min(producibleFrac, stored[m] / req);
  }
  if (producibleFrac <= 0) {
    producibleFrac = 0;
    prod = 0;
  }
  if (producibleFrac > 0 && prod > 0) {
    for (const [m, q] of Object.entries(required)) {
      stored[m] = Math.max(0, stored[m] - q * prod * producibleFrac);
    }
    for (const m of produced) {
      let out = prod * producibleFrac;
      const lim = limits ? limits[m] : null;
      if (lim !== null && lim !== undefined) out = Math.min(out, lim * C.secondsPerMarketCycle);
      if (out === 0) continue;
      stored[m] += out;
    }
  }
  return { prod, freeAfter: size - sizeUsedOf(stored) };
}
export function sizeUsedOf(stored) {
  let s = 0;
  for (const m of MAT_ORDER) s += (stored[m] || 0) * MAT[m].size;
  return s;
}

// ------------------------------------------------------------------ Eichung
function eich() {
  let ok = 0,
    bad = 0;
  const check = (name, soll, ist, tol = 0) => {
    const good = tol === 0 ? soll === ist : Math.abs(soll - ist) < tol;
    if (good) ok++;
    else bad++;
    if (!good || process.argv.includes("--laut")) console.log(`${good ? "OK  " : "FAIL"} ${name}: soll ${soll} ist ${ist}`);
  };

  // (1) Snapshot calculateUpgradeCost: 135 Werte, exakt (Zeichenkette == String(Zahl))
  const snap = fs.readFileSync(
    new URL("../../reference/bitburner-src/test/jest/__snapshots__/Corporation.test.ts.snap", import.meta.url),
    "utf8",
  );
  const re = /formula: (.+?): from (\d+) to (\d+) 1`\] = `([^`]+)`/g;
  let m,
    n = 0;
  while ((m = re.exec(snap))) {
    const [, name, from, to, val] = m;
    const u = UPGRADES[name];
    // Test ruft calculateUpgradeCost(base, mult, current, target) - target ist "amount"
    const ist = calculateUpgradeCost(u.basePrice, u.priceMult, Number(from), Number(to));
    check(`UpgradeCost ${name} ${from}->${to}`, val, String(ist));
    n++;
  }
  console.log(`(1) calculateUpgradeCost gegen ${n} Snapshot-Werte: exakt verglichen`);

  // (2) Bueroausbau: 9 dokumentierte Faelle (toBeCloseTo(x,1) => |d| < 0,05)
  const office = [
    [3, 3, 4360000000.0],
    [3, 15, 26093338259.6],
    [3, 150, 3553764305895.24902],
    [6, 3, 4752400000.0],
    [6, 15, 28441738702.964],
    [6, 150, 3873603093425.821],
    [9, 3, 5180116000.0],
    [9, 15, 31001495186.23076],
    [9, 150, 4222227371834.145],
  ];
  for (const [from, inc, soll] of office)
    check(`OfficeSize ${from}+${inc}`, soll, calculateOfficeSizeUpgradeCost(from, inc), 0.05);
  console.log("(2) calculateOfficeSizeUpgradeCost gegen 9 Jest-Sollwerte (Toleranz 0,05 wie toBeCloseTo(.,1))");

  // (3) Produktions-Platzgrenze: Jest "limitMaterialProduction 3/4" (exakte Gleichheit)
  const cases = [
    { lim: { Plants: 20, Food: 10 }, free: 45, cons: [500, 200], out: [200, 100], rest: 67 },
    { lim: { Plants: null, Food: 0 }, free: 22.5, cons: [250, 100], out: [500, 0], rest: 15 },
  ];
  for (const c of cases) {
    const stored = Object.fromEntries(MAT_ORDER.map((k) => [k, 0]));
    stored.Chemicals = 1e6;
    stored.Water = 1e6;
    stored["Real Estate"] = 1e6;
    const size = sizeUsedOf(stored) + c.free;
    const r = productionStep({
      stored,
      size,
      rawProdPerCycle: 1e12, // 4000 Angestellte: Produktion weit ueber der Platzgrenze
      required: { Water: 0.5, Chemicals: 0.2 },
      produced: ["Plants", "Food"],
      limits: c.lim,
    });
    check(`Prod free=${c.free} Water`, 1e6 - c.cons[0], stored.Water);
    check(`Prod free=${c.free} Chemicals`, 1e6 - c.cons[1], stored.Chemicals);
    check(`Prod free=${c.free} Plants`, c.out[0], stored.Plants);
    check(`Prod free=${c.free} Food`, c.out[1], stored.Food);
    check(`Prod free=${c.free} Restplatz`, c.rest, r.freeAfter);
  }
  console.log("(3) Produktions-Platzgrenze gegen Jest limitMaterialProduction 3/4: 10 exakte Werte");

  // (4) Anteils-Buchhaltung (Jest "totalShares"): Summe bleibt erhalten
  const corp = { numShares: 1e9, totalShares: 1.5e9, investorShares: 5e8, issuedShares: 0 };
  check("Seed: total == num+inv+issued", corp.totalShares, corp.numShares + corp.investorShares + corp.issuedShares);
  console.log(`\nEICHUNG: ${ok} OK, ${bad} FEHLER`);
  return bad === 0;
}

if (process.argv[1] && process.argv[1].endsWith("corp-formeln.mjs")) {
  if (process.argv.includes("--eich")) process.exit(eich() ? 0 : 1);
  // Kurzuebersicht: Tribut, Dividendenexponent je Knoten der Restroute
  console.log("Knoten | Valuation | Softcap | tribute | Dividende = x^(1-tribute) | Corp moeglich");
  for (const [bn, v] of Object.entries(BN_CORP)) {
    const t = tributeModifier(v.Softcap);
    console.log(
      `BN${bn.padEnd(3)} | ${String(v.Valuation).padEnd(9)} | ${String(v.Softcap).padEnd(7)} | ${t.toFixed(2)}    | x^${(1 - t).toFixed(2)}                  | ${v.Softcap >= 0.15 ? "ja" : "NEIN (Softcap < 0,15)"}`,
    );
  }
}
