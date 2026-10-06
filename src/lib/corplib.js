/**
 * Corporation-Gewerk (BN3), reine Rechenbibliothek - KEIN ns-Aufruf hier drin.
 *
 * WARUM REIN: Bitburner berechnet den RAM eines Skripts aus ALLEN Bezeichnern
 * des Modulgraphen (tools/ram.js, RamCalculations.ts). Ein Bezeichner wie
 * `research` oder `bribe` irgendwo in dieser Datei wuerde jedem Importeur
 * 20 GB aufbuerden. Deshalb stehen hier nur Formeln, Tabellen und Planungs-
 * logik, und die Funktionsnamen der Corp-API kommen nur als Kurzcodes vor.
 *
 * Jede Formel ist aus reference/v301 abgeschrieben (Datei:Zeile im Kommentar)
 * und wird im Simulator gegen den echten Spielcode geeicht
 * (nodes/corp-2026-10-05/bau/tests/botsim.test.ts, Abschnitt EICHUNG).
 */

export const CORP_VERSION = "corp-e3c-2026-10-06";
export const CITIES = ["Aevum", "Chongqing", "Sector-12", "New Tokyo", "Ishima", "Volhaven"];
export const MAIN_CITY = "Aevum";
export const JOBS = ["Operations", "Engineer", "Business", "Management", "Research & Development", "Intern"];
export const RESULT_PORT = 3031;

// Dateien (alle auf home)
export const STATE_FILE = "data/corp-state.txt";
export const TELEMETRY_FILE = "data/corp.json";
export const EVENT_FILE = "data/corp-log.txt";

// Kurzcode -> Ausfuehrungsskript. Die Skripte enthalten die echten Namen.
// Familien seit corp-e2c mit hoechstens 2 Aktionen (je Kind <= 51,6 GB; nach dem ersten Einbau am
// 06.10.2026 gab es keinen freien Wirt > 64 GB)
export const FAMILY = {
  he: "corp-act-office.js", sj: "corp-act-office.js",
  uo: "corp-act-size.js", ad: "corp-act-size.js",
  te: "corp-act-care.js", pa: "corp-act-care.js",
  ei: "corp-act-build.js", ec: "corp-act-build.js",
  pw: "corp-act-wh.js", uw: "corp-act-wh.js",
  lu: "corp-act-up.js", ul: "corp-act-up.js",
  rs: "corp-act-rs.js", t2: "corp-act-rs.js",
  cc: "corp-act-new.js",
  io: "corp-act-fin.js", ai: "corp-act-fin.js",
  mp: "corp-act-prod.js", dp: "corp-act-prod.js",
  ex: "corp-act-route.js", cx: "corp-act-route.js",
  sl: "corp-act-cash.js",
  bb: "corp-act-bribe.js",
};
export const TICK_SCRIPT = "corp-tick.js";
export const TICKB_SCRIPT = "corp-tickb.js";
export const TICKP_SCRIPT = "corp-tickp.js";
export const ALL_SCRIPTS = [...new Set([...Object.values(FAMILY), TICK_SCRIPT, TICKB_SCRIPT, TICKP_SCRIPT])];
export const LIBS = ["lib/corplib.js", "lib/corpact.js", "lib/corptick.js"];

// ---------------------------------------------------------------- Spieldaten (v301)
// MaterialInfo.ts: Groesse und baseMarkup (Material.getMarkupLimit = quality / baseMarkup, Material.ts:85-87)
export const MAT = {
  Water: { size: 0.05, markup: 6 },
  Food: { size: 0.03, markup: 3 },
  Plants: { size: 0.05, markup: 3.75 },
  Hardware: { size: 0.06, markup: 1 },
  Chemicals: { size: 0.05, markup: 2 },
  Robots: { size: 0.5, markup: 1 },
  "AI Cores": { size: 0.1, markup: 0.5 },
  "Real Estate": { size: 0.005, markup: 1.5 },
};
// IndustryData.ts:8-22 (Agriculture), :267-290 (Tobacco), :95 (Restaurant)
export const INDUSTRY = {
  Agriculture: {
    cost: 40e9,
    req: { Water: 0.5, Chemicals: 0.2 },
    prod: ["Plants", "Food"],
    factors: { "Real Estate": 0.72, Hardware: 0.2, Robots: 0.3, "AI Cores": 0.3 },
    products: false,
  },
  Chemical: {
    cost: 70e9,
    req: { Plants: 1, Water: 0.5 },
    prod: ["Chemicals"],
    factors: { "Real Estate": 0.25, Hardware: 0.2, Robots: 0.25, "AI Cores": 0.2 },
    products: false,
  },
  Restaurant: { cost: 10e9, req: {}, prod: [], factors: {}, products: true },
  Tobacco: {
    cost: 20e9,
    req: { Plants: 1 },
    prod: [],
    factors: { "Real Estate": 0.15, Hardware: 0.15, Robots: 0.2, "AI Cores": 0.15 },
    products: true,
  },
};
// data/CorporationUpgrades.ts: basePrice, priceMult, benefit
export const UPGRADES = {
  "Smart Factories": { base: 2e9, mult: 1.06, benefit: 0.03 },
  "Smart Storage": { base: 2e9, mult: 1.06, benefit: 0.1 },
  "Wilson Analytics": { base: 4e9, mult: 2, benefit: 0.005 },
  "Nuoptimal Nootropic Injector Implants": { base: 1e9, mult: 1.06, benefit: 0.1 },
  "Speech Processor Implants": { base: 1e9, mult: 1.06, benefit: 0.1 },
  "Neural Accelerators": { base: 1e9, mult: 1.06, benefit: 0.1 },
  FocusWires: { base: 1e9, mult: 1.06, benefit: 0.1 },
  "ABC SalesBots": { base: 1e9, mult: 1.07, benefit: 0.01 },
  "Project Insight": { base: 5e9, mult: 1.07, benefit: 0.05 },
};
export const UNLOCK_COST = { Export: 20e9, "Smart Supply": 25e9 };
// ResearchMap.ts: Kosten (RP) und Multiplikatoren; Baum BaseResearchTree.ts (Eltern muessen zuerst)
export const RESEARCH = {
  "Hi-Tech R&D Laboratory": { cost: 5e3 },
  AutoBrew: { cost: 12e3, parent: "Hi-Tech R&D Laboratory" },
  AutoPartyManager: { cost: 15e3, parent: "Hi-Tech R&D Laboratory" },
  "Market-TA.I": { cost: 20e3, parent: "Hi-Tech R&D Laboratory" },
  "Market-TA.II": { cost: 50e3, parent: "Market-TA.I" },
  "uPgrade: Fulcrum": { cost: 10e3, parent: "Hi-Tech R&D Laboratory", productProd: 1.05 },
  "uPgrade: Capacity.I": { cost: 20e3, parent: "uPgrade: Fulcrum" },
  "uPgrade: Capacity.II": { cost: 30e3, parent: "uPgrade: Capacity.I" },
  Overclock: { cost: 15e3, parent: "Hi-Tech R&D Laboratory" },
  "Sti.mu": { cost: 30e3, parent: "Overclock" },
  "Self-Correcting Assemblers": { cost: 25e3, parent: "Hi-Tech R&D Laboratory", prod: 1.1 },
  Drones: { cost: 5e3, parent: "Hi-Tech R&D Laboratory" },
  "Drones - Assembly": { cost: 25e3, parent: "Drones", prod: 1.2 },
  "Drones - Transport": { cost: 30e3, parent: "Drones" },
  "Automatic Drug Administration": { cost: 10e3, parent: "Hi-Tech R&D Laboratory" },
  "CPH4 Injections": { cost: 25e3, parent: "Automatic Drug Administration" },
  "Go-Juice": { cost: 25e3, parent: "Automatic Drug Administration" },
};
/** Forschungsreihenfolge je Division (corpsim.ts productTick), Market-TA vorn fuer Tobacco (Skeptiker 5) */
export const RESEARCH_ORDER = {
  Tob: ["Hi-Tech R&D Laboratory", "AutoBrew", "AutoPartyManager", "Market-TA.I", "Market-TA.II", "uPgrade: Fulcrum", "Overclock", "uPgrade: Capacity.I", "Self-Correcting Assemblers", "Drones", "Drones - Assembly", "uPgrade: Capacity.II", "Automatic Drug Administration", "CPH4 Injections", "Drones - Transport", "Sti.mu", "Go-Juice"],
  Agri: ["Hi-Tech R&D Laboratory", "AutoBrew", "AutoPartyManager", "Overclock", "Drones", "Drones - Assembly", "Self-Correcting Assemblers", "Drones - Transport"],
  Chem: ["Hi-Tech R&D Laboratory", "AutoBrew", "AutoPartyManager", "Overclock", "Drones", "Drones - Assembly", "Self-Correcting Assemblers"],
};
/** Produktions-Multiplikatoren aus Forschung (ResearchTree.getMultiplierHelper, im Simulator geeicht) */
export function researchMults(done) {
  let prod = 1, productProd = 1;
  for (const r of done || []) {
    const x = RESEARCH[r];
    if (!x) continue;
    if (x.prod) prod *= x.prod;
    if (x.productProd) productProd *= x.productProd;
  }
  return { prod, productProd };
}
export const OFFICE_INITIAL_COST = 4e9; // Constants.ts officeInitialCost (expandCity)
export const WAREHOUSE_INITIAL_COST = 5e9; // Constants.ts warehouseInitialCost

// ---------------------------------------------------------------- Kostenformeln
/** helpers.ts:53-62 calculateUpgradeCost, ein Level */
export function upgradeCost(name, level) {
  const u = UPGRADES[name];
  return u.base * Math.pow(u.mult, level);
}
/** helpers.ts:64-71 calculateOfficeSizeUpgradeCost */
export function officeUpCost(size, by) {
  if (by <= 0) return 0;
  return (OFFICE_INITIAL_COST / 0.09) * Math.pow(1.09, size / 3) * (Math.pow(1.09, by / 3) - 1);
}
/** Actions.ts:437-442 upgradeWarehouseCost, ein Level */
export function warehouseUpCost(level) {
  return 1e9 * Math.pow(1.07, level + 1);
}
/** Division.ts:975-977 getAdVertCost */
export function adCost(numAdVerts) {
  return 1e9 * Math.pow(1.06, numAdVerts);
}

// ---------------------------------------------------------------- Produktion
/** Division.ts:991-1015 getOfficeProductivity aus getOffice().employeeProductionByJob */
export function officeProductivity(epbj, forProduct = false) {
  const op = epbj.Operations || 0, eng = epbj.Engineer || 0, mg = epbj.Management || 0;
  const total = op + eng + mg;
  if (total <= 0) return 0;
  const mgmtFactor = 1 + mg / (1.2 * total);
  const prod = (Math.pow(op, 0.4) + Math.pow(eng, 0.3)) * mgmtFactor;
  return forProduct ? 0.5 * 0.05 * prod : 0.05 * prod;
}
/** Division.ts:123-137 calculateProductionFactors: Summe ueber ALLE Lager der Division */
export function productionMultFromBoosts(factors, boostByCity) {
  let sum = 0;
  for (const st of Object.values(boostByCity)) {
    let m = 1;
    for (const [mat, f] of Object.entries(factors)) m *= Math.pow(0.002 * (st[mat] || 0) + 1, f);
    sum += Math.pow(m, 0.73);
  }
  return sum < 1 ? 1 : sum;
}
/** Lagerplatz fuer den Durchfluss eines Zyklus (x2 Sicherheit), wie corpsim.ts flowSpace */
export function flowSpace(ind, units) {
  let per = 0;
  for (const [m, q] of Object.entries(ind.req)) per += q * MAT[m].size;
  if (ind.products) per *= 2;
  else for (const m of ind.prod) per += MAT[m].size;
  return 2 * units * per;
}

// ---------------------------------------------------------------- Boost-Ziel (Lagrange, Doku boost-material.md)
/**
 * Optimale Boost-Mischung fuer eine Stadt, wie corpsim.ts setBoost.
 * @param {object} f      Faktoren der Branche
 * @param {object} cur    bisheriges Ziel {mat: menge}
 * @param {object} stored Lagerbestand {mat: menge}
 * @param {object} price  Marktpreise {mat: preis}
 * @param {number} S      Platz (Groesse) fuer Boosts
 * @param {number} budget Geld fuer diese Stadt
 * @returns {{target: object, cost: number}}
 */
export function boostTarget(f, cur, stored, price, S, budget) {
  const size = (n) => MAT[n].size;
  const solve = (space) => {
    let names = Object.keys(f).filter((n) => f[n] > 0);
    for (let it = 0; it < 4; it++) {
      const sf = names.reduce((a, n) => a + f[n], 0);
      const ss = names.reduce((a, n) => a + size(n), 0);
      const x = {};
      for (const n of names) x[n] = (f[n] * (space + 500 * ss)) / (size(n) * sf) - 500;
      const neg = names.filter((n) => x[n] < 0);
      if (!neg.length) return x;
      names = names.filter((n) => x[n] >= 0);
    }
    return {};
  };
  const costOf = (x) =>
    Object.entries(x).reduce((a, [n, q]) => a + Math.max(0, q - Math.max(cur[n] || 0, stored[n] || 0)) * price[n], 0);
  let x = solve(S);
  if (costOf(x) > budget) {
    let lo = 0, hi = S;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (costOf(solve(mid)) > budget) hi = mid;
      else lo = mid;
    }
    x = solve(lo);
  }
  const cost = costOf(x);
  const target = { ...cur };
  for (const n of Object.keys(x)) target[n] = Math.max(target[n] || 0, x[n]);
  return { target, cost };
}

// ---------------------------------------------------------------- Verkaufspreis nur aus API-Daten
/**
 * Verkaufsmenge je s fuer Preis P (helpers.ts:133-153 calculateMarkupMultiplier,
 * Division.ts:418-434): verkauft = min(Angebot, D * m(P)).
 */
export function markupMult(P, MP, ML) {
  if (P > MP) return P > MP + ML ? Math.pow(ML / (P - MP), 2) : 1;
  return P <= 0 ? 1e12 : MP / P;
}
/**
 * Preisfindung fuer ein Material ohne Spielinterna.
 *
 * Unbekannt ist nur D (Absatzgrenze je s bei m = 1). Aus dem letzten Verkauf
 * gilt: blieb Ware liegen (gedeckelt), ist D = verkauft / m(P_alt) EXAKT; wurde
 * alles verkauft, ist das nur eine Untergrenze, dann wird D um 30 % hoeher
 * angenommen. Ziel: 98 % des Angebots verkaufen, damit der naechste Zyklus
 * wieder gedeckelt ist und D exakt misst. Das ist die TA2-Formel
 * (Division.ts:363-389) mit gemessenem statt gerechnetem D.
 *
 * Der Preis geht als Ausdruck relativ zu MP ins Spiel ("MP+x" oder "MP*x"),
 * damit er bei Skripttod (Einbau, F8) mit dem Marktpreis mitwandert.
 *
 * @param {object|undefined} prev  {d, kind, x} vom letzten Zyklus
 * @param {object} now  {mp, mpLast, quality, stored, sold, offer} sold/offer je s
 * @param {string} markup baseMarkup des Materials
 */
export function priceMaterial(prev, now, baseMarkup) {
  const ML = Math.max(now.quality, 0.001) / baseMarkup;
  let D = prev && prev.d > 0 ? prev.d : 0;
  if (prev && prev.kind && now.sold > 0 && Number.isFinite(now.mpLast)) {
    const Plast = prev.kind === "add" ? now.mpLast + prev.x : now.mpLast * prev.x;
    const m = markupMult(Plast, now.mpLast, ML);
    const dObs = now.sold / m;
    // gedeckelt nur bei echtem Rest (> 1 % der verkauften Menge), sonst ist dObs nur eine Untergrenze
    const capped = now.stored > 0.01 * now.sold * 10;
    const dNew = capped ? dObs : Math.max(D, dObs * 1.3);
    // Daempfung: D faellt je Zyklus hoechstens auf 70 % (eine Fehlmessung darf den Preis nicht in
    // eine Abwaertsspirale schicken - im Simulator am 06.10. beobachtet: D halbierte sich 30 Zyklen lang)
    D = D > 0 ? Math.max(dNew, 0.7 * D) : dNew;
  }
  // Angebot im naechsten SALE (je s): Rest + geschaetzte Produktion - geplanter Export (now.offer,
  // vom Takt-Skript gerechnet; EXPORT liegt vor SALE, Division.ts:722)
  const s = now.offer;
  if (!(D > 0) || !(s > 0)) return { d: D, kind: "mul", x: 1 };
  const T = 0.98 * s;
  if (T <= D) {
    const delta = ML * Math.sqrt(D / T);
    return { d: D, kind: "add", x: delta };
  }
  // unter MP nie tiefer als 30 % (Notbremse; der Erloes ist in diesem Bereich ohnehin ~ D * MP)
  return { d: D, kind: "mul", x: Math.max(0.3, D / T) };
}
export function priceExpr(p) {
  if (p.kind === "add") return "MP+" + p.x.toPrecision(10);
  return "MP*" + p.x.toPrecision(10);
}

// ---------------------------------------------------------------- Bewertung / Liquidation
/** Erloes eines Verkaufs aller Anteile ausser einem: V * g(f), g(f) = 0,5 f + 2/3 f^1,5 (strategie.md K2) */
export function liquidationValue(valuation, owned, total) {
  const f = total > 0 ? owned / total : 0;
  return valuation * (0.5 * f + (2 / 3) * Math.pow(f, 1.5));
}

// ---------------------------------------------------------------- Investorenrunden ohne Getter
// Constants.ts fundingRoundShares / fundingRoundMultiplier; Corporation.ts:333-354 getInvestmentOffer,
// Actions.ts:199-207 acceptInvestmentOffer (investorShares += floor(1e9 * Anteil)). Im Simulator geeicht.
const ROUND_SHARES = [0.1, 0.35, 0.25, 0.2];
const ROUND_MULT = [3, 2, 2, 1.5];
/** Zahl der angenommenen Runden aus getCorporation(): investorShares minus Seed-Anteile. Die Seed-Gruendung
 *  in BN3 legt 500 Mio auf investorShares UND totalShares (PlayerObjectCorporationMethods.ts:25-28), also
 *  Seed = totalShares - 1e9 (Constants.ts initialShares). Annahme: der Bot gibt nie neue Anteile aus
 *  (issueNewShares wuerde totalShares erhoehen). */
export function roundsFromCorp(corp) {
  const investorShares = corp.investorShares - Math.max(0, corp.totalShares - 1e9);
  let cum = 0, k = 0;
  for (const p of ROUND_SHARES) {
    cum += Math.floor(1e9 * p);
    if (investorShares >= cum) k++;
  }
  return k;
}
/** Angebot der naechsten Runde wie getInvestmentOffer (0 nach Runde 4 oder nach dem Boersengang) */
export function offerFromCorp(corp) {
  const k = roundsFromCorp(corp);
  if (k >= 4 || corp.public) return { funds: 0, shares: 0, round: k + 1 };
  return { funds: corp.valuation * ROUND_SHARES[k] * ROUND_MULT[k], shares: Math.floor(1e9 * ROUND_SHARES[k]), round: k + 1 };
}

// ---------------------------------------------------------------- Anteilsverkauf (Etappe 3)
/**
 * Corporation.ts:251-262 getTargetSharePrice: Marktwert = V * (0,5 + sqrt(Eigenanteil)), je Anteil.
 */
export function targetSharePrice(valuation, owned, total) {
  return (valuation * (0.5 + Math.sqrt(Math.max(0, owned / total)))) / total;
}
/**
 * Corporation.ts:285-326 calculateShareSale, exakt nachgebaut (auch die Eigenheit: ist der Rest >= dem
 * Zaehler bis zur naechsten Preisstufe, zahlt das Spiel einen VOLLEN Schritt von 1e6 Anteilen zum
 * aktuellen Kurs, auch wenn weniger verkauft werden). shareSalesUntilPriceUpdate liefert die API nicht;
 * corp.js fuehrt ihn selbst mit (Startwert 1e6, Corporation.ts Feldvorgabe), weil nur eigene Verkaeufe
 * ihn aendern. Im Simulator 06.10. gefunden: ohne Zaehler lag die Vorhersage bei einem Verkauf um
 * Faktor 2,1 daneben (58 statt 123 Bio).
 * @returns {{profit: number, until: number}}
 */
export function shareSale(c, n, until0 = 1e6) {
  let remaining = n;
  let until = until0;
  let price = c.sharePrice;
  let sold = 0;
  let profit = 0;
  const steps = Math.ceil(n / 1e6);
  for (let i = 0; i < steps; i++) {
    if (Math.abs(remaining) < Math.abs(until)) {
      profit += price * remaining;
      until -= remaining;
      break;
    }
    profit += price * 1e6;
    remaining -= 1e6;
    sold += 1e6;
    const target = targetSharePrice(c.valuation, c.numShares - sold, c.totalShares);
    price *= price <= target ? 1.005 : 0.995;
    until = 1e6;
  }
  return { profit, until };
}
export function shareSaleProfit(c, n, until0 = 1e6) {
  return shareSale(c, n, until0).profit;
}
/** Kleinste Anteilszahl fuer mindestens `money` Erloes (Bisektion), hoechstens `maxN` */
export function sharesForMoney(c, money, maxN, until0 = 1e6) {
  if (!(maxN >= 1)) return 0;
  if (shareSaleProfit(c, maxN, until0) <= money) return Math.floor(maxN);
  let lo = 0, hi = Math.floor(maxN);
  for (let i = 0; i < 60 && hi - lo > 1; i++) {
    const mid = Math.floor((lo + hi) / 2);
    if (shareSaleProfit(c, mid, until0) >= money) hi = mid;
    else lo = mid;
  }
  return hi;
}
/**
 * Zuendung am GEGLAETTETEN Wert: das Minimum der letzten `n` Zyklusbewertungen (getCorporation().valuation
 * ist schon ein 10-Zyklen-Mittel, Corporation.ts:226-232) muss die Schwelle halten. Ein Einzelwert
 * reicht nicht: Saat 3 lag bei 10 h auf 3,7e14 und bei 12 h wieder auf 3,3e14 (gemessen 06.10.).
 */
export function ignitedSmooth(hist, threshold, n) {
  if (!hist || hist.length < n) return false;
  for (let i = hist.length - n; i < hist.length; i++) if (!(hist[i] >= threshold)) return false;
  return true;
}
/**
 * Oeffentliche Bewertung (Corporation.ts:200-212), aus API-Groessen geschaetzt: Fonds + 85.000 s *
 * Gewinn (revenue - expenses statt assetDelta, das die API nicht liefert), x 1,0079741^(Bueros+Lager).
 */
export function publicValuationEstimate(funds, profitPerSec, officesAndWarehouses) {
  return Math.max(0, funds + 85e3 * profitPerSec) * Math.pow(1.0079741404289038, officesAndWarehouses);
}

// ---------------------------------------------------------------- Jobs
export function agriMix(n) {
  if (n <= 4) return { Operations: 1, Engineer: 1, Business: 1, Management: 1 };
  if (n <= 9) return { Operations: 2, Engineer: 2, Business: 1, Management: 2, "Research & Development": 1 };
  return { Operations: 3, Engineer: 4, Business: 1.5, Management: 2.5, "Research & Development": 1 };
}
export const TOB_MAIN_MIX = { Operations: 2.5, Engineer: 3, Business: 1.5, Management: 3 };
export const TOB_SUP_MIX = { Operations: 2, Engineer: 2, Business: 1, Management: 2, "Research & Development": 3 };
export const CHEM_MIX = { Operations: 1, Engineer: 2, Business: 0.5, Management: 1, "Research & Development": 1.5 };

// ---------------------------------------------------------------- Produktpreis nur aus API-Daten
/**
 * Wie corpsim.ts "lagK" (Doku optimal-selling-price-market-ta2.md): K = verkauft * (P - MP)^2
 * aus dem Vorzyklus, Preis = MP + 1,05 * sqrt(K / Angebot). MP ist getProduct().productionCost.
 * Erster Zyklus: sehr hoher Preis (MP * 1e6), damit wenig verkauft wird und K messbar ist.
 */
export function priceProduct(prev, now) {
  let K = prev && prev.K > 0 ? prev.K : undefined;
  if (prev && now.sold > 0 && Number.isFinite(prev.P) && prev.P > now.mpLast) K = now.sold * Math.pow(prev.P - now.mpLast, 2);
  if (K === undefined) return { K: undefined, kind: "mul", x: 1e6 };
  const s = now.offer;
  if (!(s > 0)) return { K, kind: "add", x: 0 };
  return { K, kind: "add", x: 1.05 * Math.sqrt(K / s) };
}
/**
 * Produktionsgrenze ohne Interna, nur gegen Falle F9 (volles Lager = Stillstand). Skeptiker E2 F5:
 * die erste Fassung konnte haengen - im Probezyklus (Preis MP x 1e6) ist der Absatz ~0, die Grenze
 * waere ~0 geworden, haette sich selbst erhalten (kein Absatz ohne Ware) und einen Skripttod ueberlebt.
 * Jetzt:
 *   - TA2 aktiv oder Probezyklus -> keine Grenze (-1, bzw. aufheben, falls eine steht)
 *   - Lager > 80 % voll -> Grenze = max(Absatz x 1,05, halbe Produktionsrate, 1)
 *   - Lager < 50 % -> Grenze weg
 * Rueckgabe: neue Grenze (je s), -1 = keine Grenze, undefined = nichts aendern.
 */
export function productLimit(now) {
  const hasLimit = now.limit !== null && now.limit !== undefined;
  if (now.ta2 || now.isProbe) return hasLimit ? -1 : undefined;
  if (now.fill > 0.8 && now.sold > 0) return Math.max(now.sold * 1.05, 0.5 * (now.prod || 0), 1);
  if (now.fill < 0.5 && hasLimit) return -1;
  return undefined;
}

/** Kopfzahlen je Job, wie corpsim.ts setJobs (abrunden, Rest nach Gewicht) */
export function jobCounts(n, mix) {
  const keys = Object.keys(mix);
  const tot = keys.reduce((a, k) => a + mix[k], 0);
  const cnt = {};
  let rest = n;
  for (const k of keys) {
    cnt[k] = Math.floor((n * mix[k]) / tot);
    rest -= cnt[k];
  }
  const order = [...keys].sort((a, b) => mix[b] - mix[a]);
  for (let i = 0; rest > 0; i++, rest--) cnt[order[i % order.length]]++;
  return cnt;
}
/** Ops: Buero auf `size` bringen (upgrade, einstellen, Jobs neu setzen) */
export function officeOps(div, city, curSize, curEmployees, size, mix) {
  const ops = [];
  if (size > curSize) ops.push(["uo", div, city, size - curSize]);
  for (let i = curEmployees; i < size; i++) ops.push(["he", div, city, "Unassigned"]);
  for (const j of JOBS) ops.push(["sj", div, city, j, 0]);
  const cnt = jobCounts(size, mix);
  for (const [j, k] of Object.entries(cnt)) if (k > 0) ops.push(["sj", div, city, j, k]);
  return ops;
}

export function fmt(x) {
  const a = Math.abs(x);
  if (a >= 1e15) return x.toExponential(2);
  if (a >= 1e12) return (x / 1e12).toFixed(2) + " Bio";
  if (a >= 1e9) return (x / 1e9).toFixed(1) + " Mrd";
  if (a >= 1e6) return (x / 1e6).toFixed(2) + " Mio";
  return Number(x).toFixed(0);
}
