// Hacknet-/Hash-Rechner fuer das Audit 03.10.2026 (Bereich HASH). Nur lesen.
// Aufruf: node tools/audit/hash-calc.mjs
//
// Formeln 1:1 aus dem Spielquellcode 3.0.2 (reference/bitburner-src/src):
//   Hacknet/formulas/HacknetServers.ts:4-118   Rate und Ausbaukosten
//   Hacknet/data/Constants.ts:32-52            HacknetServerConstants
//   Hacknet/HashUpgrade.ts:72-81               Stufenpreis costPerLevel*(L+1)
//   Hacknet/data/HashUpgradesMetadata.tsx      Preise/Werte der 11 Upgrades
//   Hacknet/HacknetServer.ts:121-123           hashCapacity = 32*2^cache
// Eichung gegen den Spielstand BN2L1 03.10.2026 09:59 (pre-hotswap):
//   hashRate je Server, moneySourceA.hacknet_expenses, Hash-Bilanz,
//   Kapazitaet, naechster Rangpreis (hashes.json bedarfKapazitaet).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hacknetState } from "./hash-save.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SAVE = path.join(root, "backups", "LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz");
const SAVE_EARLY = path.join(root, "backups", "LIVE_197f4d61481686_BN2L1_2026-10-03T05-33_hourly.json.gz");

// --- Konstanten (Hacknet/data/Constants.ts:32-52) ---
export const HS = {
  HashesPerLevel: 0.001, BaseCost: 50e3, RamBaseCost: 200e3, CoreBaseCost: 1e6, CacheBaseCost: 10e6,
  PurchaseMult: 3.2, UpgradeLevelMult: 1.1, UpgradeRamMult: 1.4, UpgradeCoreMult: 1.55, UpgradeCacheMult: 1.85,
  MaxServers: 20, MaxLevel: 300, MaxRam: 8192, MaxCores: 128, MaxCache: 15,
};

// --- Formeln (Hacknet/formulas/HacknetServers.ts) ---
export function hashRate(level, ramUsed, maxRam, cores, mult, bnHacknet) {
  const baseGain = HS.HashesPerLevel * level;
  const ramMultiplier = Math.pow(1.07, Math.log2(maxRam));
  const coreMultiplier = 1 + (cores - 1) / 5;
  const ramRatio = 1 - ramUsed / maxRam;
  return baseGain * ramMultiplier * coreMultiplier * ramRatio * mult * bnHacknet;
}
export function levelCost(start, extra = 1, costMult = 1) {
  if (start + extra > HS.MaxLevel) return Infinity;
  let t = 0, c = start;
  for (let i = 0; i < extra; i++) { t += Math.pow(HS.UpgradeLevelMult, c); c++; }
  return 10 * HS.BaseCost * t * costMult;
}
export function ramCost(startRam, extra = 1, costMult = 1) {
  if (startRam * Math.pow(2, extra) > HS.MaxRam) return Infinity;
  let total = 0, n = Math.round(Math.log2(startRam)), r = startRam;
  for (let i = 0; i < extra; i++) { total += r * HS.RamBaseCost * Math.pow(HS.UpgradeRamMult, n); r *= 2; n++; }
  return total * costMult;
}
export function coreCost(start, extra = 1, costMult = 1) {
  if (start + extra > HS.MaxCores) return Infinity;
  let t = 0, c = start;
  for (let i = 0; i < extra; i++) { t += Math.pow(HS.UpgradeCoreMult, c - 1); c++; }
  return t * HS.CoreBaseCost * costMult;
}
// Cache ohne Kostenmultiplikator (HacknetServers.ts:72-92)
export function cacheCost(start, extra = 1) {
  if (start + extra > HS.MaxCache) return Infinity;
  let t = 0, c = start;
  for (let i = 0; i < extra; i++) { t += Math.pow(HS.UpgradeCacheMult, c - 1); c++; }
  return t * HS.CacheBaseCost;
}
export function serverCost(n, mult = 1) {
  if (n - 1 >= HS.MaxServers) return Infinity;
  return HS.BaseCost * Math.pow(HS.PurchaseMult, n - 1) * mult;
}
export const capacityOf = (cache) => 32 * Math.pow(2, cache);
// HashUpgrade.ts:72-81: Summe von count Stufen ab currentLevel
export const upgCost = (perLevel, cur, count = 1) => perLevel * 0.5 * count * (count + 2 * cur + 1);

// Stufen, die man mit H Hashes ab Stufe L0 kaufen kann (perLevel*(L+1) je Stufe)
export function levelsFor(H, perLevel, L0 = 0) {
  let L = L0, rest = H;
  while (rest >= perLevel * (L + 1)) { rest -= perLevel * (L + 1); L++; }
  return { levels: L - L0, rest, next: perLevel * (L + 1) };
}

const fmt = (x, d = 3) => (Math.abs(x) >= 1e9 ? (x / 1e9).toFixed(d) + "e9" : Math.abs(x) >= 1e6 ? (x / 1e6).toFixed(d) + "e6" : x.toFixed(d));
const line = (s = "") => console.log(s);

// ===========================================================================
// 1. EICHUNG
// ===========================================================================
const st = hacknetState(SAVE);
const stE = hacknetState(SAVE_EARLY);
const M = st.mults.hacknet_node_money;           // Spielermult (SF9.3 * Augs)
const CM = st.mults.hacknet_node_level_cost;     // = ram/core/purchase cost mult
const BN2_HN = 1;                                // BitNode.tsx:568-591: HacknetNodeMoney nicht gesetzt -> 1
line("=== 1. EICHUNG gegen " + path.basename(SAVE) + " ===");
let maxAbs = 0;
for (const f of [...st.fleet, ...stE.fleet]) {
  const r = hashRate(f.level, f.ramUsed || 0, f.maxRam, f.cores, M, BN2_HN);
  const d = Math.abs(r - f.hashRate);
  maxAbs = Math.max(maxAbs, d);
  line(`  ${f.name.padEnd(17)} L${String(f.level).padStart(3)} C${String(f.cores).padStart(2)} RAM${String(f.maxRam).padStart(2)} `
    + `Soll(Save) ${f.hashRate.toPrecision(16)}  Ist(Formel) ${r.toPrecision(16)}  diff ${d.toExponential(2)}`);
}
line(`  -> max. Abweichung hashRate: ${maxAbs.toExponential(2)} ${maxAbs < 1e-15 ? "OK" : "PRUEFEN"}`);

// Ausgaben netburn.js (data/netburn.txt: 5 Knoten, Level 105, RAM 10, Cores 14):
// Server 2..5 gekauft, alle 5 RAM 1->2, Server 1 Level 1->2. Server 0 = SF9.3-Gratisserver.
const expPurchase = [2, 3, 4, 5].reduce((a, n) => a + serverCost(n, CM), 0);
const expRam = 5 * ramCost(1, 1, CM);
const expLvl = levelCost(1, 1, CM);
const expSum = expPurchase + expRam + expLvl;
const expSave = -st.moneySince.hacknet_expenses;
line(`  hacknet_expenses: Soll(Save) ${expSave.toFixed(2)}  Ist(Formel: Kauf ${expPurchase.toFixed(0)} + RAM ${expRam.toFixed(0)} + Level ${expLvl.toFixed(0)}) ${expSum.toFixed(2)}  diff ${(expSum - expSave).toExponential(2)}`);

// Hash-Bilanz: erzeugt = 4*Verkaeufe + Rangstufen 0..4 + Vorrat
const gen = st.fleet.reduce((a, f) => a + f.total, 0);
const sells = st.upgrades["Sell for Money"] || 0, rankLv = st.upgrades["Exchange for Bladeburner Rank"] || 0;
const spent = 4 * sells + upgCost(250, 0, rankLv);
line(`  Hash-Bilanz: erzeugt ${gen.toFixed(4)} | Verkauf 4*${sells} + Rang ${upgCost(250, 0, rankLv)} + Vorrat ${st.hashes.toFixed(4)} = ${(spent + st.hashes).toFixed(4)}  diff ${(gen - spent - st.hashes).toFixed(4)}`);
line(`  moneySource.hacknet ${st.moneySince.hacknet} = Verkaeufe*1e6 ${sells * 1e6} -> kein Ueberlauf-Autoverkauf`);
const cap = st.fleet.reduce((a, f) => a + capacityOf(f.cache), 0);
line(`  Kapazitaet: Save ${st.capacity}  Formel ${cap}`);
line(`  naechster Rangpreis: Formel ${upgCost(250, rankLv)}  hashes.json bedarfKapazitaet ${st.hashesJson && st.hashesJson.bedarfKapazitaet}`);

// ===========================================================================
// 2. BN2.1 JETZT: Rangtausch blockiert (Kapazitaet 1280 < 1500)
// ===========================================================================
line("\n=== 2. BN2.1: Rangtausch mit/ohne Cache-Ausbau (Rate " + st.fleet.reduce((a, f) => a + f.hashRate, 0).toFixed(4) + " H/s) ===");
const R = st.fleet.reduce((a, f) => a + f.hashRate, 0);
// Verlust seit dem Stau: Verkaeufe zwischen 08:33 (723) und 09:59 (1357)
const lostH = 4 * (1357 - 723);
const lostLv = levelsFor(lostH, 250, 5);
line(`  seit 08:33 verkauft statt getauscht: ${lostH} Hashes = ${lostLv.levels} Rangstufen (${lostLv.levels * 100} Rang, ~${Math.round(lostLv.levels * 100 / 3)} SP), Rest ${lostLv.rest}; Verkaufserloes ${fmt(lostH / 4 * 1e6)} $`);
// guenstigster Kapazitaetsausbau: Cache 1->2 auf einem L1-Server (+64) oder Server 0 Cache 5->6 (+1024)
line(`  Cache 1->2: ${fmt(cacheCost(1))} $ (+64)   Cache 5->6 auf Server 0: ${fmt(cacheCost(5))} $ (+1024)`);
line("  Stufe L braucht 250*(L+1) Speicher; Kapazitaet je Ausbaupfad:");
for (const L of [5, 8, 12, 16, 20]) {
  const need = 250 * (L + 1);
  line(`    Stufe ${L}: ${need} Hashes - Server0 Cache ${Math.ceil(Math.log2((need - 4 * 64) / 32))} reicht (Kosten ab Cache 5: ${fmt(cacheCost(5, Math.max(0, Math.ceil(Math.log2((need - 4 * 64) / 32)) - 5)))} $)`);
}
line("  Rang aus Hashes in der Restzeit T des Zyklus (ab Stufe 5, Rate unveraendert):");
for (const T of [1, 2, 4, 6, 10]) {
  const H = R * 3600 * T;
  const lv = levelsFor(H, 250, 5);
  line(`    T=${String(T).padStart(2)} h: ${Math.round(H)} Hashes -> mit Cache ${lv.levels} Stufen = ${lv.levels * 100} Rang + ${Math.round(lv.levels * 100 / 3)} SP | ohne Cache 0 Rang, Verkauf ${fmt(H / 4 * 1e6)} $`);
}

// ===========================================================================
// 3. AUSBAU DES GRATIS-SERVERS (gierig nach Rate je $), BN2
// ===========================================================================
line("\n=== 3. Gratis-Server ausbauen (BN2, mult " + M.toFixed(4) + ", Kostenmult " + CM.toFixed(4) + ") ===");
function greedy(srv, budget, mult, bn, cm, maxSteps = 400) {
  const s = { ...srv }; let spentG = 0; const steps = [];
  const rate = (x) => hashRate(x.level, 0, x.maxRam, x.cores, mult, bn);
  for (let k = 0; k < maxSteps; k++) {
    const r0 = rate(s);
    const opts = [
      { w: "RAM", c: ramCost(s.maxRam, 1, cm), n: { ...s, maxRam: s.maxRam * 2 } },
      { w: "Kern", c: coreCost(s.cores, 1, cm), n: { ...s, cores: s.cores + 1 } },
      { w: "Level", c: levelCost(s.level, 1, cm), n: { ...s, level: s.level + 1 } },
    ].filter((o) => Number.isFinite(o.c)).map((o) => ({ ...o, dr: rate(o.n) - r0 }));
    opts.sort((a, b) => b.dr / b.c - a.dr / a.c);
    const o = opts[0];
    if (!o || spentG + o.c > budget) break;
    spentG += o.c; Object.assign(s, o.n);
    steps.push({ w: o.w, c: o.c, rate: rate(s), payH: o.c / (o.dr * 0.25e6 * 3600), spent: spentG });
  }
  return { s, spent: spentG, steps };
}
const free = { level: 100, cores: 10, maxRam: 2 };
const g = greedy(free, 5e9, M, BN2_HN, CM);
let shown = 0;
for (const x of g.steps) {
  if (shown < 14 || x === g.steps[g.steps.length - 1]) {
    line(`    +${x.w.padEnd(5)} ${fmt(x.c).padStart(10)} $ -> Rate ${x.rate.toFixed(4)} H/s, Amortisation bei Verkaufspreis ${x.payH.toFixed(2)} h, kumuliert ${fmt(x.spent)}`);
  }
  shown++;
}
for (const B of [0.1e9, 0.3e9, 1e9, 3e9]) {
  const r = greedy(free, B, M, BN2_HN, CM);
  const r0 = hashRate(100, 0, 2, 10, M, BN2_HN);
  const rr = hashRate(r.s.level, 0, r.s.maxRam, r.s.cores, M, BN2_HN);
  line(`  Budget ${fmt(B)}: L${r.s.level} C${r.s.cores} RAM${r.s.maxRam} -> ${rr.toFixed(4)} H/s (x${(rr / r0).toFixed(2)}), Mehrertrag ${((rr - r0) * 0.25e6 * 3600 / 1e6).toFixed(0)} Mio $/h bei Verkauf, Amortisation ${(r.spent / ((rr - r0) * 0.25e6 * 3600)).toFixed(2)} h`);
}

// ===========================================================================
// 4. JE KNOTEN DER RESTROUTE: Gratis-Server, erster Zyklus
// ===========================================================================
line("\n=== 4. Restroute: SF9.3-Gratis-Server (L100/C10/RAM1) und Rang aus Hashes im ersten Zyklus ===");
// BitNode.tsx: HacknetNodeMoney / BladeburnerRank / BladeburnerSkillCost / ScriptHackMoney
const ROUTE = [
  { bn: 2, hn: 1, br: 1, sc: 1, shm: 1 }, { bn: 3, hn: 0.25, br: 1, sc: 1, shm: 0.2 },
  { bn: 11, hn: 0.1, br: 1, sc: 1, shm: 1 }, { bn: 6, hn: 0.2, br: 1, sc: 1, shm: 0.75 },
  { bn: 7, hn: 0.2, br: 0.6, sc: 2, shm: 0.5 }, { bn: 14, hn: 0.25, br: 0.6, sc: 2, shm: 0.3 },
  { bn: 13, hn: 0.4, br: 0.45, sc: 2, shm: 0.2 }, { bn: 15, hn: 1, br: 0.2, sc: 3, shm: 1 },
  { bn: 8, hn: 0, br: 0, sc: 1, shm: 0.3 },
];
const T_RANK = 4;  // Stunden Rangtausch im ersten Zyklus (BN2.1: ab ~1,5 h bis Einbau >5,3 h)
line("  BN | HN-Mult | Rate H/s | $/h Verkauf | Rang+SP in " + T_RANK + " h Tausch | Rang-Aequivalent Aktion (Rang/BladeburnerRank)");
for (const b of ROUTE) {
  const r = hashRate(100, 0, 1, 10, M, b.hn);
  const H = r * 3600 * T_RANK;
  const lv = levelsFor(H, 250, 0).levels;
  line(`  ${String(b.bn).padStart(2)} | ${b.hn.toFixed(2).padStart(4)} | ${r.toFixed(4)} | ${fmt(r * 0.25e6 * 3600, 0).padStart(6)} | ${String(lv * 100).padStart(5)} Rang ${String(Math.round(lv * 100 / 3)).padStart(4)} SP`
    + ` | ${b.br > 0 ? Math.round(lv * 100 / b.br) : "-"} (Aktionsrang x${b.br})`);
}

// ===========================================================================
// 5. SP-TAUSCH GEGEN RANGTAUSCH
// ===========================================================================
line("\n=== 5. Exchange for Bladeburner SP gegen Rank (gleiche Hashes, SP-Ertrag) ===");
for (const H of [5000, 17640, 50000]) {
  const nr = levelsFor(H, 250, 0).levels;
  const spRank = nr * 100 / 3;
  // optimale Mischung fuer reine SP: Grenzertrag 33,3/(L_r+1) = 10/(L_s+1)
  let best = { sp: 0 };
  for (let ls = 0; ls < 60; ls++) {
    const hs = upgCost(250, 0, ls);
    if (hs > H) break;
    const lr = levelsFor(H - hs, 250, 0).levels;
    const sp = lr * 100 / 3 + ls * 10;
    if (sp > best.sp) best = { sp, lr, ls };
  }
  line(`  H=${H}: nur Rang ${nr} Stufen = ${nr * 100} Rang/${spRank.toFixed(0)} SP | SP-optimal Rang ${best.lr} + SP ${best.ls} Stufen = ${best.lr * 100} Rang/${best.sp.toFixed(0)} SP (+${((best.sp / spRank - 1) * 100).toFixed(1)} % SP, -${(nr - best.lr) * 100} Rang)`);
}

// ===========================================================================
// 6. GENERATE CODING CONTRACT gegen Verkauf (BN2)
// ===========================================================================
line("\n=== 6. Generate Coding Contract (25*(L+1) Hashes) gegen Verkauf ===");
// ContractGenerator.ts:72-91 (maxDif = 2*SF-Summe+1 = 39 -> alle Typen), 172-190 (Belohnung gleichverteilt),
// PlayerObjectGeneralMethods.ts:501-567 (Geld 75e6*diff*CodingContractMoney/3, Ruf 2500*diff/3)
const DIFFS = { 1: 5, 2: 7, 3: 4, 4: 2, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1, 10: 3 };  // grep difficulty in contracts/*.ts
let nT = 0, sD = 0; for (const [d, n] of Object.entries(DIFFS)) { nT += n; sD += Number(d) * n; }
const meanD = sD / nT;
// Belohnung (PlayerObjectGeneralMethods.ts:501-567), Typ gleichverteilt ueber 4 (ContractGenerator.ts:179-190):
//   Faktion (1/4): 2500*d/3 an EINE zufaellige Hacking-Faktion
//   Faktion-alle (1/4): 2500*d/3 geteilt auf alle Hacking-Faktionen
//   Firma (1/4): ohne Job Rueckfall auf Faktion/Faktion-alle MIT nochmal /3 (Rekursion reicht adjustedScaling weiter) -> 2500*d/9
//   Geld (1/4): 75e6*d*CodingContractMoney/3
const moneyEV = 0.25 * 75e6 * meanD / 3;
const repEV = 2500 * meanD * (0.25 / 3 + 0.25 / 3 + 0.25 / 9);
line(`  EICHUNG Vertragslohn gegen data/contracts.txt/moneySource im Save BN2L1 09:59:`);
line(`    Array Jumping Game II (d=3, ArrayJumpingGame.ts:74) Faktion: Formel ${2500 * 3 / 3} | Save "Gained 2500 faction reputation for Aevum"`);
line(`    Unique Paths in a Grid I (d=3, UniquePathsInAGrid.ts:25) Firma->Faktion ohne Job: Formel ${(2500 * 3 / 9).toFixed(4)} | Save "Gained 833.3333333333333 ... The Black Hand"`);
line(`    Geldvertrag: moneySourceA.codingcontract ${st.moneySince.codingcontract} = 75e6*3/3 -> d=3 passt`);
line(`  ${nT} Typen, mittlere Schwierigkeit ${meanD.toFixed(3)}; Erwartung je Vertrag ${fmt(moneyEV)} $ + ${repEV.toFixed(0)} Faktionsruf gesamt (${(repEV / 7).toFixed(0)} je Hacking-Faktion bei 7)`);
for (const L of [0, 1, 2, 3, 4, 6, 9]) {
  const h = 25 * (L + 1);
  line(`    Stufe ${L}: ${h} Hashes = ${fmt(h / 4 * 1e6)} $ Verkauf | Vertrag ${fmt(moneyEV)} $ + ${repEV.toFixed(0)} Ruf`);
}
for (const H of [1375, 3528, 7057]) {
  const n = levelsFor(H, 25, 0).levels;
  line(`  ${H} Hashes: ${n} Vertraege = ${fmt(n * moneyEV)} $ + ${Math.round(n * repEV)} Ruf (${Math.round(n * repEV / 7)} je Faktion) | Rang ab Stufe 5: ${levelsFor(H, 250, 5).levels * 100} | ab Stufe 0: ${levelsFor(H, 250, 0).levels * 100}`);
}

// ===========================================================================
// 7. INCREASE MAXIMUM MONEY gegen Verkauf (BN2, Batchziel omega-net)
// ===========================================================================
line("\n=== 7. Increase Maximum Money (50*(L+1)) auf das staerkste Stapelziel, BN2 ===");
let erw = null;
try {
  const { loadSave, homeTextFile } = await import("./hash-save.mjs");
  const { servers } = loadSave(SAVE);
  const bn = JSON.parse(homeTextFile(servers, "data/bn4net.json"));
  erw = bn.stapel.ziele.map((z) => ({ ziel: z.ziel, erw: z.erwartetProS }));
} catch { erw = null; }
const top = erw ? erw.sort((a, b) => b.erw - a.erw)[0] : { ziel: "?", erw: 1.6e6 };
line(`  Stapelziele (bn4net.json im Save): ${JSON.stringify(erw)}`);
for (const T of [0.5, 1, 2, 4]) {
  const H = R * 3600 * T;
  // Stufen sofort kaufen, sobald bezahlbar; Ertrag integriert ueber T
  let L = 0, acc = 0, extra = 0; const dt = 60;
  for (let t = 0; t < T * 3600; t += dt) {
    acc += R * dt;
    while (acc >= 50 * (L + 1)) { acc -= 50 * (L + 1); L++; }
    extra += top.erw * (Math.pow(1.02, L) - 1) * dt;
  }
  line(`    T=${T} h: ${Math.round(H)} Hashes -> ${L} Stufen auf ${top.ziel} (x${Math.pow(1.02, L).toFixed(3)}), Mehrertrag ${fmt(extra)} $ | Verkauf ${fmt(H / 4 * 1e6)} $ | Rang ab Stufe 5: ${levelsFor(H, 250, 5).levels * 100}`);
}

// ===========================================================================
// 8. netburn.js-Flotte nach einem Einbau (5 Server, Level-Summe 105, RAM 10)
// ===========================================================================
line("\n=== 8. netburn.js nach einem Einbau (kein Gratis-Server) ===");
const nbCost = [1, 2, 3, 4, 5].reduce((a, n) => a + serverCost(n, CM), 0) + 5 * ramCost(1, 1, CM) + 5 * levelCost(1, 20, CM);
const nbRate = 5 * hashRate(21, 0, 2, 1, M, 1);
line(`  Kosten ${fmt(nbCost)} $ je Zyklus; Rate ${nbRate.toFixed(4)} H/s (BN2) -> Ueberlauf-Autoverkauf ${fmt(nbRate * 0.25e6 * 3600)} $/h, Amortisation ${(nbCost / (nbRate * 0.25e6 * 3600)).toFixed(2)} h`);
for (const b of ROUTE) {
  if (b.hn === 0) continue;
  const rr = 5 * hashRate(21, 0, 2, 1, M, b.hn);
  line(`    BN${b.bn}: ${rr.toFixed(4)} H/s, Amortisation ${(nbCost / (rr * 0.25e6 * 3600)).toFixed(1)} h`);
}

// ===========================================================================
// 9. FLOTTE NACH EINEM EINBAU (ohne Gratis-Server): Budget -> Rate -> Rang
//    Gierig nach Rate je $, Optionen: neuer Server, Level/RAM/Kern je Server.
//    Obergrenze: Flotte steht zu Zyklusbeginn (in Wahrheit erst nach Geld).
// ===========================================================================
line("\n=== 9. Flotte nach Einbau: Budget -> Rate -> Rang in T h (Obergrenze: Flotte ab t=0) ===");
function fleetGreedy(budget, mult, bn, cm) {
  const fl = []; let spentF = 0;
  const rate = (x) => hashRate(x.level, 0, x.maxRam, x.cores, mult, bn);
  for (let k = 0; k < 5000; k++) {
    const opts = [];
    if (fl.length < HS.MaxServers) opts.push({ c: serverCost(fl.length + 1, cm), dr: rate({ level: 1, maxRam: 1, cores: 1 }), apply: () => fl.push({ level: 1, maxRam: 1, cores: 1 }) });
    fl.forEach((s) => {
      const r0 = rate(s);
      opts.push({ c: ramCost(s.maxRam, 1, cm), dr: rate({ ...s, maxRam: s.maxRam * 2 }) - r0, apply: () => { s.maxRam *= 2; } });
      opts.push({ c: coreCost(s.cores, 1, cm), dr: rate({ ...s, cores: s.cores + 1 }) - r0, apply: () => { s.cores += 1; } });
      opts.push({ c: levelCost(s.level, 1, cm), dr: rate({ ...s, level: s.level + 1 }) - r0, apply: () => { s.level += 1; } });
    });
    const ok = opts.filter((o) => Number.isFinite(o.c) && o.c > 0 && spentF + o.c <= budget);
    if (!ok.length) break;
    ok.sort((a, b) => b.dr / b.c - a.dr / a.c);
    spentF += ok[0].c; ok[0].apply();
  }
  return { fl, spent: spentF, rate: fl.reduce((a, s) => a + rate(s), 0) };
}
for (const b of [ROUTE[0], ROUTE[7], ROUTE[6], ROUTE[2]]) {
  for (const B of [0.1e9, 1e9, 5e9]) {
    const f = fleetGreedy(B, M, b.hn, CM);
    const T = 8, H = f.rate * 3600 * T;
    const lv = levelsFor(H, 250, 0).levels;
    const lvl = f.fl.map((s) => s.level), cores = f.fl.map((s) => s.cores), ram = f.fl.map((s) => s.maxRam);
    line(`  BN${b.bn} Budget ${fmt(B, 1)}: ${f.fl.length} Server, Level ${Math.min(...lvl)}-${Math.max(...lvl)}, Kerne ${Math.min(...cores)}-${Math.max(...cores)}, RAM ${Math.min(...ram)}-${Math.max(...ram)}`
      + ` -> ${f.rate.toFixed(3)} H/s; ${T} h: ${Math.round(H)} H = ${lv * 100} Rang + ${Math.round(lv * 100 / 3)} SP (Aktionsrang-Aequivalent ${Math.round(lv * 100 / b.br)}) | Verkauf ${fmt(H / 4 * 1e6, 1)} $, Amortisation ${(B / (f.rate * 0.25e6 * 3600)).toFixed(1)} h`);
  }
}

// ===========================================================================
// 10. Wert von Hash-Rang in Knotenzeit (Offset-Modell, untere Schranke)
//     Rangrate haengt nicht am Rang (calculateActionRankGain, Bladeburner/Formulas.ts:9-28,
//     kennt den Spielerrang nicht) -> +D Rang verkuerzt den Knoten um D / r_Ende.
//     r_Ende aus BN9L3: Rang 24.184 (41,43 h) -> 623.300 (53,57 h, pre-jump).
// ===========================================================================
line("\n=== 10. Hash-Rang in Knotenzeit (Offset-Modell) ===");
const rEnd9 = (623300 - 24184) / (53.57 - 41.43);
line(`  r_Ende BN9L3 = ${Math.round(rEnd9)} Rang/h (BladeburnerRank 0,9); auf BN2 (1,0): ${Math.round(rEnd9 / 0.9)}, BN15 (0,2): ${Math.round(rEnd9 / 0.9 * 0.2)}`);
for (const [bn, d, br] of [[2, 700, 1], [2, 2000, 1], [15, 600, 0.2], [15, 2600, 0.2]]) {
  const rE = rEnd9 / 0.9 * br;
  line(`  BN${bn}: +${d} Hash-Rang -> ${(d / rE * 60).toFixed(1)} min frueher fertig (nur Offset; SP-Zinseszins nicht enthalten)`);
}
