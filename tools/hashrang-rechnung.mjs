// Hash-Rang nach dem ersten Einbau (Befund B7, Auftrag 07.10.2026): RECHNUNG, kein Bot-Code.
// Aufruf: node tools/hashrang-rechnung.mjs
//
// Formeln 1:1 aus dem Spielquellcode (reference/v301/src):
//   Hacknet/formulas/HacknetServers.ts   Rate und Ausbaukosten
//   Hacknet/data/Constants.ts:32-52      HacknetServerConstants
//   Hacknet/HashUpgrade.ts:72-81         Stufenpreis 250*(L+1)
//   Hacknet/HacknetServer.ts:121-123     Kapazitaet 32*2^cache
// Eichung gegen BN2L1 03.10.2026 09:59 (tools/audit/hash-calc.mjs, Abschnitt 1): zwei Ratenwerte
// und die Rangpreise aus dem Auftrag. Erst wenn die Eichung stimmt, wird mit den Formeln argumentiert.
//
// ZWEI MASSE FUER DEN WERT VON RANG (siehe nodes/HASH-RANG-2026-10.md):
//   (a) Offset: die Rangrate der Aktionen kennt den Spielerrang nicht (Bladeburner/Formulas.ts:9-28).
//       +D Rang verkuerzt den Knoten um D / r_Ende. UNTERE Schranke.
//   (b) Skillpunkte: 1 SP je 3 Rang (RanksPerSkillPoint). Die SP-Wirkung wird mit dem Rangmodell
//       tools/bbrank/sim.mjs gemessen (gleiche Startlage, mit und ohne die Zusatz-SP).
import { simulate } from "./bbrank/sim.mjs";
import { skillMultipliers } from "./bbrank/bbmodel.mjs";

const HS = {
  HashesPerLevel: 0.001, BaseCost: 50e3, RamBaseCost: 200e3, CoreBaseCost: 1e6, CacheBaseCost: 10e6,
  PurchaseMult: 3.2, UpgradeLevelMult: 1.1, UpgradeRamMult: 1.4, UpgradeCoreMult: 1.55, UpgradeCacheMult: 1.85,
  MaxServers: 20, MaxLevel: 300, MaxRam: 8192, MaxCores: 128, MaxCache: 15,
};
export const hashRate = (level, ram, cores, mult) =>
  HS.HashesPerLevel * level * Math.pow(1.07, Math.log2(ram)) * (1 + (cores - 1) / 5) * mult;
const levelStep = (lvl, cm) => 10 * HS.BaseCost * Math.pow(HS.UpgradeLevelMult, lvl) * cm;
const ramStep = (ram, cm) => ram * HS.RamBaseCost * Math.pow(HS.UpgradeRamMult, Math.round(Math.log2(ram))) * cm;
const coreStep = (cores, cm) => Math.pow(HS.UpgradeCoreMult, cores - 1) * HS.CoreBaseCost * cm;
const cacheStep = (c) => Math.pow(HS.UpgradeCacheMult, c - 1) * HS.CacheBaseCost;
const serverCost = (n, cm) => HS.BaseCost * Math.pow(HS.PurchaseMult, n - 1) * cm;
const rankPrice = (L) => 250 * (L + 1);
const rankCum = (L) => 250 * 0.5 * L * (L + 1);          // Summe der Stufen 0..L-1

let bad = 0;
const check = (name, ist, soll) => {
  const ok = Math.abs(ist - soll) <= 1e-12 * Math.max(1, Math.abs(soll));
  if (!ok) bad++;
  console.log(`  ${ok ? "OK    " : "FEHLER"} ${name}: ${ist} (Soll ${soll})`);
};
console.log("=== EICHUNG ===");
const M_SAVE = 1.6069463718401764;                        // mults.hacknet_node_money im Spielstand (SF9.3 x1,21 mal Augs)
check("hashRate Server 0 (L100 C10 RAM2)", hashRate(100, 2, 10, M_SAVE), 0.4814411330033169);
check("hashRate Server 1 (L2 C1 RAM2)", hashRate(2, 2, 1, M_SAVE), 0.003438865235737977);
check("Rangpreis Stufe 5 (naechster)", rankPrice(5), 1500);
check("Kosten 10 Stufen = 1000 Rang", rankCum(10), 13750);
check("Kosten 100 Stufen = 10000 Rang", rankCum(100), 1262500);
if (bad) { console.log("EICHUNG GESCHEITERT - keine Schluesse."); process.exit(1); }

// ---------------------------------------------------------------------------
// Ausbau nach Grenznutzen (Rate je $), ab leeren Servern, bis das Budget verbraucht ist.
// ramUsed = 0 (Obergrenze: laufende Skripte auf den Hacknet-Servern senkten die Rate).
// ---------------------------------------------------------------------------
function build(budget, mult, cm) {
  const sv = [];
  let spent = 0;
  for (;;) {
    let best = null;
    const rateOf = (s) => hashRate(s.level, s.ram, s.cores, mult);
    if (sv.length < HS.MaxServers) {
      const c = serverCost(sv.length + 1, cm), r = hashRate(1, 1, 1, mult);
      best = { kind: "new", cost: c, gain: r };
    }
    sv.forEach((s, i) => {
      const r0 = rateOf(s);
      const opts = [
        ["level", levelStep(s.level, cm), s.level < HS.MaxLevel ? hashRate(s.level + 1, s.ram, s.cores, mult) - r0 : 0],
        ["ram", ramStep(s.ram, cm), s.ram * 2 <= HS.MaxRam ? hashRate(s.level, s.ram * 2, s.cores, mult) - r0 : 0],
        ["core", coreStep(s.cores, cm), s.cores < HS.MaxCores ? hashRate(s.level, s.ram, s.cores + 1, mult) - r0 : 0],
      ];
      for (const [kind, cost, gain] of opts) {
        if (gain > 0 && (!best || gain / cost > best.gain / best.cost)) best = { kind, cost, gain, i };
      }
    });
    if (!best || spent + best.cost > budget) break;
    spent += best.cost;
    if (best.kind === "new") sv.push({ level: 1, ram: 1, cores: 1, cache: 1 });
    else if (best.kind === "level") sv[best.i].level++;
    else if (best.kind === "ram") sv[best.i].ram *= 2;
    else sv[best.i].cores++;
  }
  const rate = sv.reduce((a, s) => a + hashRate(s.level, s.ram, s.cores, mult), 0);
  return { sv, rate, spent };
}
// Cache-Kosten, damit der Speicher den Preis der Zielstufe fasst (billigster Weg, Server mit kleinstem Cache zuerst).
function cacheFor(sv, needHashes) {
  const caches = sv.map((s) => s.cache);
  let cost = 0, cap = caches.reduce((a, c) => a + 32 * Math.pow(2, c), 0);
  while (cap < needHashes) {
    let bi = 0, bv = Infinity;
    caches.forEach((c, i) => { const v = cacheStep(c) / (32 * Math.pow(2, c)); if (v < bv) { bv = v; bi = i; } });
    cost += cacheStep(caches[bi]); cap += 32 * Math.pow(2, caches[bi]); caches[bi]++;
    if (caches[bi] > HS.MaxCache) return Infinity;
  }
  return cost;
}
// Beste Zielstufe fuer Budget B und Laufzeit T (h): Produktion und Cache teilen sich B.
function bestRank(B, T, mult, cm) {
  let best = { L: 0, rank: 0, rate: 0, prodSpent: 0, cache: 0, hashes: 0 };
  for (let Lt = 1; Lt <= 400; Lt++) {
    // Produktion mit Restbudget; Cache so, dass Preis Stufe Lt-1 in den Speicher passt
    let lo = 0, hi = B, res = null;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2, b = build(mid, mult, cm);
      const cc = cacheFor(b.sv, rankPrice(Lt - 1));
      if (b.spent + cc <= B) { res = { b, cc }; lo = mid; } else hi = mid;
    }
    if (!res) continue;
    const H = res.b.rate * T * 3600;
    const Lh = Math.floor((Math.sqrt(1 + 4 * (2 * H / 250)) - 1) / 2);   // groesstes L mit rankCum(L) <= H
    const L = Math.min(Lt, Lh);
    if (L * 100 > best.rank) best = { L, rank: L * 100, rate: res.b.rate, prodSpent: res.b.spent, cache: res.cc, hashes: H, servers: res.b.sv.length };
  }
  return best;
}

// ---------------------------------------------------------------------------
// Knoten (BitNode.tsx der Spielquelle): Rangfaktor, HacknetNodeMoney
// ---------------------------------------------------------------------------
const NODES = {
  BN15: { brank: 0.2, hn: 1.0, skillCost: 3 },     // BitNode.tsx:1112 / kein HacknetNodeMoney (Default 1)
  BN13: { brank: 0.45, hn: 0.4, skillCost: 2 },    // BitNode.tsx:1031 / :1012
};
const SF9 = 1.21;                                    // SF9.3 (applySourceFile.ts:133-147), wie im Spielstand
const R_END9 = (623300 - 24184) / (53.57 - 41.43);   // BN9L3, Rang/h am Ende (hash-calc.mjs Abschnitt 10)

console.log("\n=== (a) HASH-YIELD UND OFFSET-GEWINN (untere Schranke) ===");
console.log("Budget = Gesamtausgabe Hacknet+Cache in $, Ausgabe zu Beginn; T = Stunden Laufzeit danach; Kostenmult 1,0 (Augs koennten ~0,6 geben).");
const rows = [];
for (const [bn, nd] of Object.entries(NODES)) {
  const rEnd = R_END9 / 0.9 * nd.brank;
  console.log(`\n${bn}: Rangfaktor ${nd.brank}, HacknetNodeMoney ${nd.hn}, r_Ende ${Math.round(rEnd)} Rang/h`);
  console.log("  Budget      T[h]  Server  Rate[H/s]  Hashes     Stufen  Hash-Rang  Gewinn Offset[h]");
  for (const B of [3e7, 1e8, 3e8, 1e9, 3e9, 1e10]) {
    for (const T of [20, 60, 100]) {
      const r = bestRank(B, T, nd.hn * SF9, 1.0);
      const gain = r.rank / rEnd;
      rows.push({ bn, B, T, ...r, gain });
      console.log(`  ${(B / 1e6).toFixed(0).padStart(6)} M ${String(T).padStart(5)}  ${String(r.servers ?? 0).padStart(5)}  ${r.rate.toFixed(3).padStart(9)}  ${r.hashes.toExponential(2).padStart(9)}  ${String(r.L).padStart(6)}  ${String(r.rank).padStart(9)}  ${gain.toFixed(2).padStart(8)}`);
    }
  }
}

