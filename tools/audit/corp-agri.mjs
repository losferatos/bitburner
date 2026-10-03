// Audit 03.10.2026, Bereich CORP: Agriculture-Geschaeft in BN3 - Erwartungswert-Modell.
//
// UNGEEICHT: Es gibt keinen Spielstand mit einer Corporation. Die Einzelformeln
// stammen 1:1 aus dem Quellcode (Spiel 3.0.2), die Kostenformeln sind in
// corp-formeln.mjs gegen die Jest-Sollwerte geeicht. Vereinfachungen (alle
// zugunsten des Geschaefts, also eine OBERE Schranke fuer Agriculture allein):
//   - Angestelltenwerte = Erwartungswert 75 (OfficeSpace.ts:178-200, randint 50..100),
//     Moral/Energie = 100 (Bueros <= 8 Kopf steigen von selbst, perfMult 1,002, :73-110),
//     Erfahrung je Kopf 75 (Einstellung) - Zuwachs 0,0015/Zyklus vernachlaessigt.
//   - Marktpreise/Nachfrage/Konkurrenz = Basiswerte (MaterialInfo.ts), Verkauf zu MP.
//   - Forschung (RP) = 0, keine Produkte.
// Formeln:
//   Produktivitaet  OfficeSpace.ts:137-172, Division.ts:968-993 getOfficeProductivity
//   Boost-Mult      Division.ts:123-137 calculateProductionFactors (Summe ueber ALLE Lager)
//   Qualitaet       Division.ts:657-670
//   Verkaufsdeckel  Division.ts:259-462 processSaleState, :995-1021 Business/Werbung/Markt
//   Gehalt          OfficeSpace.ts:122-134 (5x je Marktzyklus gebucht: Division.ts:188, :465)
//   Bewertung       Corporation.ts:196-221; Investorenangebot Corporation.ts:325-345
//
// Aufruf: node tools/audit/corp-agri.mjs
import {
  C,
  calculateUpgradeCost,
  calculateOfficeSizeUpgradeCost,
  upgradeWarehouseCost,
  adVertCost,
  cycleValuation,
  investmentOffer,
  UPGRADES,
} from "./corp-formeln.mjs";

const AGRI = {
  startingCost: 40e9,
  f: { "Real Estate": 0.72, Hardware: 0.2, Robots: 0.3, "AI Cores": 0.3 },
  adv: 0.04,
  req: { Water: 0.5, Chemicals: 0.2 },
};
const SIZE = { "Real Estate": 0.005, Hardware: 0.06, Robots: 0.5, "AI Cores": 0.1, Water: 0.05, Chemicals: 0.05, Plants: 0.05, Food: 0.03 };
const PRICE = { "Real Estate": 80e3, Hardware: 8e3, Robots: 75e3, "AI Cores": 15e3, Water: 1500, Chemicals: 9e3, Plants: 3000, Food: 5000 };
const MARKET = { Plants: { demand: 70, comp: 50, markup: 3.75 }, Food: { demand: 80, comp: 60, markup: 3 } };
const CITIES = 6;

// Angestellten-Produktion je Job bei Werten 75, Moral/Energie 100 (prodBase 1)
function jobProd(job, exp = 75) {
  const I = 75, Ch = 75, Cr = 75, E = 75;
  switch (job) {
    case "ops": return 0.6 * I + 0.1 * Ch + exp + 0.5 * Cr + E;
    case "eng": return I + 0.1 * Ch + 1.5 * exp + E;
    case "bus": return 0.4 * I + Ch + 0.5 * exp;
    case "mgmt": return 2 * Ch + exp + 0.2 * Cr + 0.7 * E;
  }
}
// Aufteilung eines Bueros der Groesse n (einfache, skriptbare Regel)
function jobs(n) {
  // je 1 Business fuer den Verkaufsdeckel, Rest ops:eng:mgmt ~ 2:1:1 (mindestens je 1)
  const bus = 1;
  const rest = Math.max(0, n - bus);
  const mgmt = Math.max(1, Math.floor(rest / 4));
  const eng = Math.max(1, Math.floor(rest / 4));
  const ops = Math.max(0, rest - mgmt - eng);
  return { ops, eng, bus, mgmt };
}
function officeProductivity(n) {
  const j = jobs(n);
  const op = j.ops * jobProd("ops"), en = j.eng * jobProd("eng"), mg = j.mgmt * jobProd("mgmt");
  const total = op + en + mg;
  if (total <= 0) return { prod: 0, eng: en, bus: j.bus * jobProd("bus") };
  const mgmtFactor = 1 + mg / (1.2 * total);
  return { prod: 0.05 * (Math.pow(op, 0.4) + Math.pow(en, 0.3)) * mgmtFactor, eng: en, bus: j.bus * jobProd("bus") };
}
function salaryPerSec(n) {
  // OfficeSpace.ts:126-135: 3 * n * (int+cha+exp/n+cre+eff) je Aufruf; gebucht wird es
  // FUENFMAL je Marktzyklus (Division.ts:188 im START-Zustand, :465 in jedem der vier
  // uebrigen Zustaende) -> 5 * 3 * n * 375 / 10 s
  return (5 * 3 * n * (75 + 75 + 75 + 75 + 75)) / C.secondsPerMarketCycle;
}
// Optimale Boost-Mischung fuer Platz S und Geld G je Stadt (Lagrange, zwei Nebenbedingungen per Raster)
function bestBoost(S, G) {
  // maximiere sum f_i ln(1+0.002 x_i) mit sum s_i x_i <= S, sum p_i x_i <= G
  const names = Object.keys(AGRI.f);
  let best = { val: 0, x: Object.fromEntries(names.map((n) => [n, 0])) };
  // Gewicht w zwischen Platz- und Geldpreis: Kosten_i = s_i/S*w + p_i/G*(1-w)
  for (let wi = 0; wi <= 20; wi++) {
    const w = wi / 20;
    const cost = (n) => (SIZE[n] / S) * w + (PRICE[n] / G) * (1 - w);
    // bei linearer Budgetrestriktion sum cost_i x_i = 1: x_i = f_i/(lambda cost_i) - 500
    let lo = 1e-12, hi = 1e6;
    for (let it = 0; it < 70; it++) {
      const lam = Math.sqrt(lo * hi);
      const tot = names.reduce((a, n) => a + cost(n) * Math.max(0, AGRI.f[n] / (lam * cost(n)) - 500), 0);
      if (tot > 1) lo = lam; else hi = lam;
    }
    const x = Object.fromEntries(names.map((n) => [n, Math.max(0, AGRI.f[n] / (hi * cost(n)) - 500)]));
    // auf beide Grenzen zurechtstutzen
    const sUse = names.reduce((a, n) => a + SIZE[n] * x[n], 0), gUse = names.reduce((a, n) => a + PRICE[n] * x[n], 0);
    const k = Math.min(1, S / Math.max(sUse, 1e-9), G / Math.max(gUse, 1e-9));
    for (const n of names) x[n] *= k;
    const val = names.reduce((a, n) => a + AGRI.f[n] * Math.log(1 + 0.002 * x[n]), 0);
    if (val > best.val) best = { val, x };
  }
  return { M: Math.exp(best.val), x: best.x };
}
function adFactors(nAds) {
  let aw = 0, pop = 0;
  for (let i = 0; i < nAds; i++) { aw = (aw + 3) * 1.005; pop = (pop + 1) * (1 + 2 / 200); }
  const awF = Math.pow(aw + 1, AGRI.adv), popF = Math.pow(pop + 1, AGRI.adv);
  const ratio = aw === 0 ? 0.01 : Math.max((pop + 0.001) / aw, 0.01);
  return Math.pow(awF * popF * ratio, 0.85);
}

/** Stationaerer Gewinn je Sekunde fuer einen Ausbauzustand */
function steady(st) {
  const off = officeProductivity(st.office);
  const W = st.whLevel * 100 * (1 + 0.1 * st.smartStorage);
  // Platz fuer Boosts: Lager minus ein Zyklus Ein- und Ausgang (grob, iterativ)
  let prodOffice = 0, M = 1, boost = null;
  for (let it = 0; it < 12; it++) {
    const perCycle = prodOffice * C.secondsPerMarketCycle;
    const buffer = perCycle * (0.5 * SIZE.Water + 0.2 * SIZE.Chemicals + SIZE.Plants + SIZE.Food);
    const S = Math.max(0, W - buffer);
    boost = bestBoost(S, Math.max(1, st.boostBudget / CITIES));
    M = boost.M;
    const prodMult = CITIES * Math.pow(M, 0.73);
    const nprod = off.prod * prodMult * (1 + 0.03 * st.smartFactories);
    if (Math.abs(nprod - prodOffice) < 1e-9 * (1 + nprod)) { prodOffice = nprod; break; }
    prodOffice = nprod;
  }
  // Qualitaet und Verkaufsdeckel je Stadt und Material
  const tempQ = off.eng / 90;
  const q = tempQ > 1 ? Math.min(tempQ, Math.sqrt(tempQ)) : Math.max(1, tempQ);
  const bf = Math.pow(1 + off.bus, 0.26) + (1 + off.bus) / 10e3;
  const af = adFactors(st.ads);
  let rev = 0;
  for (const [m, mk] of Object.entries(MARKET)) {
    const mf = Math.max(0.1, (mk.demand * (100 - mk.comp)) / 100);
    const cap = (q + 0.001) * mf * bf * af; // Verkauf zu MP: markupMultiplier 1
    rev += Math.min(prodOffice, cap) * PRICE[m];
  }
  const inputs = prodOffice * (0.5 * PRICE.Water + 0.2 * PRICE.Chemicals);
  const perCity = rev - inputs - salaryPerSec(st.office);
  return { P: perCity * CITIES, prodOffice, M, q, cap: null, boost: boost.x, W };
}

// Grundausbau: Division + 5 Staedte + 5 Lager + 1 Werbung
function baseState() {
  return { office: 3, whLevel: 1, smartStorage: 0, smartFactories: 0, ads: 1, boostBudget: 0 };
}
const CAPEX_BASE = AGRI.startingCost + 5 * C.officeInitialCost + 5 * C.warehouseInitialCost + adVertCost(0);

/**
 * gieriger Ausbau: je Schritt die Option mit dem hoechsten dP/$.
 * Gekauft wird nur, was sich bis zum Verkaufszeitpunkt lohnt: Die oeffentliche
 * Bewertung ist funds + 85e3*assetDelta (Corporation.ts:203-209) - eine Ausgabe X
 * senkt funds um X (Boosts zaehlen dort NICHT, nur im privaten Lagerwert) und hebt
 * die Bewertung um 85e3*dP plus den bis dahin verdienten Gewinn dP*restSek.
 */
function invest(st, money, restSek = Infinity) {
  const spent = { capex: 0, boost: 0 };
  for (let step = 0; step < 400; step++) {
    const base = steady(st).P;
    const opts = [];
    const add = (name, cost, mut, isBoost = false) => {
      if (cost > money || cost <= 0) return;
      const s2 = { ...st }; mut(s2);
      const dP = steady(s2).P - base;
      if (dP > 0 && dP * (85e3 + restSek) > cost) opts.push({ name, cost, s2, r: dP / cost, isBoost });
    };
    add("Lager +1 (6 Staedte)", CITIES * upgradeWarehouseCost(st.whLevel, 1), (s) => s.whLevel++);
    add("Smart Storage +1", calculateUpgradeCost(UPGRADES["Smart Storage"].basePrice, 1.06, st.smartStorage, 1), (s) => s.smartStorage++);
    add("Smart Factories +1", calculateUpgradeCost(UPGRADES["Smart Factories"].basePrice, 1.06, st.smartFactories, 1), (s) => s.smartFactories++);
    add("Buero +3 (6 Staedte)", CITIES * calculateOfficeSizeUpgradeCost(st.office, 3), (s) => (s.office += 3));
    add("Werbung +1", adVertCost(st.ads), (s) => s.ads++);
    const chunk = Math.max(1e9, money * 0.1);
    add("Boost +" + (chunk / 1e9).toFixed(1) + " Mrd", Math.min(chunk, money), (s) => (s.boostBudget += Math.min(chunk, money)), true);
    if (!opts.length) break;
    opts.sort((a, b) => b.r - a.r);
    const o = opts[0];
    money -= o.cost;
    if (o.isBoost) spent.boost += o.cost; else spent.capex += o.cost;
    Object.assign(st, o.s2);
  }
  return { st, money, spent };
}

const fmt = (x) => (Math.abs(x) >= 1e12 ? (x / 1e12).toFixed(2) + " Bio" : (x / 1e9).toFixed(2) + " Mrd");

// --- Szenario A: BN3-Seed, alles in Agriculture, dann stationaer
console.log("A) BN3-Seed 150 Mrd: Grundausbau " + fmt(CAPEX_BASE) + ", Rest gierig investiert (Reserve 5 Mrd)");
{
  const st = baseState();
  const r = invest(st, 150e9 - CAPEX_BASE - 5e9, 24 * 3600);
  const s = steady(r.st);
  console.log(`   Ausbau: Buero ${r.st.office}, Lagerstufe ${r.st.whLevel}, SmartStorage ${r.st.smartStorage}, SmartFactories ${r.st.smartFactories}, Werbung ${r.st.ads}, Boost ${fmt(r.st.boostBudget)}`);
  console.log(`   Produktion je Buero ${s.prodOffice.toFixed(1)}/s, Boost-Mult je Stadt M=${s.M.toFixed(1)}, Qualitaet ${s.q.toFixed(2)}`);
  console.log(`   Gewinn ${(s.P / 1e6).toFixed(2)} Mio/s = ${fmt(s.P * 3600)}/h`);
  const funds = 5e9 + 0; // Boosts sind Lagerwert, aber NICHT in funds
  const priv = cycleValuation({ funds, assetDelta: s.P, isPublic: false, nOffWh: 12 });
  const pub = cycleValuation({ funds, assetDelta: s.P, isPublic: true, nOffWh: 12 });
  const off1 = investmentOffer(priv, 0);
  console.log(`   Bewertung privat ${fmt(priv)} -> Runde 1 bringt ${fmt(off1.funds)} (fuer 100 Mio Anteile)`);
  console.log(`   Bewertung oeffentlich ${fmt(pub)} -> Auszahlung an den Spieler (Integral, 66,7 % Anteil) ~${fmt(pub * 0.696)}`);
  console.log(`   Vergleich Seed-Auszahlung ohne Geschaeft: 104,4 Mrd (corp-cashout.mjs)`);
}

// --- Szenario B: Wachstum mit Wiederanlage, Runde 1 nach 2 h, IPO + Verkauf nach T Stunden
console.log("\nB) Wachstum: stuendlich Gewinn wieder anlegen; Runde 1 sobald 10 Zyklen ohne Investition; IPO nach T h");
for (const T of [3, 6, 12, 24, 48]) {
  const st = baseState();
  let money = 150e9 - CAPEX_BASE;
  let r = invest(st, money - 5e9, T * 3600); money = r.money + 5e9;
  let round = 0, ownedFrac = 1e9 / 1.5e9, totalShares = 1.5e9, numShares = 1e9;
  for (let h = 1; h <= T; h++) {
    const P = steady(st).P;
    money += P * 3600;
    if (h === 2 && round === 0) {
      // Runde 1 (eine Stunde ohne Investition davor ist im Modell erfuellt: Bewertung mit assetDelta = P)
      const priv = cycleValuation({ funds: money, assetDelta: P, isPublic: false, nOffWh: 12 });
      const off = investmentOffer(priv, 0);
      money += off.funds; numShares -= off.shares; round = 1;
    }
    if (h < T) { r = invest(st, money - 5e9, (T - h) * 3600); money = r.money + 5e9; }
  }
  const P = steady(st).P;
  const pub = cycleValuation({ funds: money, assetDelta: P, isPublic: true, nOffWh: 12 });
  const own = numShares / totalShares;
  const extract = pub * (0.5 * own + (2 / 3) * Math.pow(own, 1.5));
  console.log(`   T=${String(T).padStart(2)} h: Gewinn ${(P / 1e6).toFixed(2)} Mio/s, Ausbau B${st.office}/L${st.whLevel}/SS${st.smartStorage}/SF${st.smartFactories}/W${st.ads}/Boost ${fmt(st.boostBudget)}, Kasse ${fmt(money)}, Bewertung oeff. ${fmt(pub)}, Spieleranteil ${(own * 100).toFixed(1)} %, Auszahlung ~${fmt(extract)}`);
}
