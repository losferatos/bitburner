// Gegenpruefung G05 (04.10.2026): Preise fuer home-RAM, home-Kerne und Cloud-Server
// UNABHAENGIG aus dem Spielquellcode nachgebaut und gegen echte Spielstandwerte geeicht.
//
// Formeln (reference/bitburner-src/src/):
//   home-RAM   PlayerObjectServerMethods.ts:30-40   R * 32000 * 1,58^log2(R) * HomeComputerRamCost
//   home-Kern  PlayerObjectServerMethods.ts:42-44   1e9 * 7,5^Kerne (kein BN-Faktor)
//   Cloud      Server/ServerPurchases.ts:24-44      ram * 55000 * Cost * Softcap^max(0, log2(ram)-6)
//   Ausbau     Server/ServerPurchases.ts:46-54      cost(neu) - cost(alt)
//   BN-Faktoren BitNode/BitNode.tsx (je case): Softcap 2:1,3 3:1,3(Cost 2) 6:2 7:2 8:4 11:2 13:1,6 14:1 15:1
//
// Eichung (Soll = Spielstandwert, Ist = Rechner):
//  E1 data/preise.json (vom Spiel, BN2.2) gegen cloudCost
//  E2 Delta moneySourceB.servers zwischen zwei Staenden = home-Schritt + Kern + Park-Delta
//
// Aufruf: node tools/audit/verify-g05-preise.mjs
import fs from "node:fs";
import { loadSave, textFile } from "./hack-save.mjs";

export const homeRamCost = (R, mult = 1) => R * 32000 * Math.pow(1.58, Math.log2(R)) * mult;
export const homeCoreCost = (k) => 1e9 * Math.pow(7.5, k);
export const cloudCost = (ram, cost = 1, soft = 1) =>
  ram * 55000 * cost * Math.pow(soft, Math.max(0, Math.log2(ram) - 6));
export const cloudUp = (from, to, cost = 1, soft = 1) => cloudCost(to, cost, soft) - cloudCost(from, cost, soft);

const BN = { 2: { cost: 1, soft: 1.3, home: 1 }, 3: { cost: 2, soft: 1.3, home: 1.5 }, 6: { cost: 1, soft: 2, home: 1 },
  7: { cost: 1, soft: 2, home: 1 }, 8: { cost: 1, soft: 4, home: 1 }, 11: { cost: 1, soft: 2, home: 1 },
  13: { cost: 1, soft: 1.6, home: 1 }, 14: { cost: 1, soft: 1, home: 1 }, 15: { cost: 1, soft: 1, home: 1 } };
export { BN };

function parkCost(p, servers, bn) {
  let sum = 0;
  for (const h of p.purchasedServers || []) { const s = servers[h]; if (s) sum += cloudCost(s.maxRam, bn.cost, bn.soft); }
  return sum;
}

if (process.argv[1] && process.argv[1].endsWith("verify-g05-preise.mjs")) {
  const rel = (a, b) => (b === 0 ? NaN : (a - b) / b);
  const fmt = (x) => (x / 1e9).toFixed(4) + " Mrd";
  console.log("=== E1: Cloud-Preise aus data/preise.json (BN2.2, Spiel) gegen cloudCost(BN2)");
  const f2 = "backups/LIVE_197f4d61481686_BN2L2_2026-10-04T12-17_hourly.json.gz";
  const { servers: sv2 } = loadSave(f2);
  const pj = JSON.parse(textFile(sv2.home, "data/preise.json"));
  let maxRel = 0;
  for (const [ram, preis] of Object.entries(pj.preise)) {
    const ist = cloudCost(Number(ram), BN[2].cost, BN[2].soft);
    maxRel = Math.max(maxRel, Math.abs(rel(ist, preis)));
  }
  console.log("  " + Object.keys(pj.preise).length + " Preise, max rel. Abweichung Soll(preise.json) gegen Ist(Rechner):", maxRel.toExponential(2));

  console.log("\n=== E2: Delta moneySourceB.servers zwischen zwei Staenden = home-Schritt + Kern + Park-Delta");
  const dir = "backups/";
  const L = (n) => dir + "LIVE_197f4d61481686_BN2L1_2026-10-" + n + ".json.gz";
  const pairs = [
    { a: L("03T06-33_hourly"), b: L("03T07-33_hourly"), name: "BN2.1 03.10. 06:33->07:33 (home 512->1024)" },
    { a: L("03T08-33_hourly"), b: L("03T09-19_pre-hotswap"), name: "BN2.1 03.10. 08:33->09:19 (Kern 1->2)" },
    { a: L("03T18-39_connect"), b: L("03T18-45_connect"), name: "BN2.1 03.10. 18:39->18:45 (home 2048->4096)" },
  ];
  for (const pr of pairs) {
    const A = loadSave(pr.a), B = loadSave(pr.b);
    const msA = (A.p.moneySourceB.data || A.p.moneySourceB).servers;
    const msB = (B.p.moneySourceB.data || B.p.moneySourceB).servers;
    const soll = -(msB - msA);
    const bn = BN[2];
    const hA = A.servers.home, hB = B.servers.home;
    let ist = 0;
    for (let R = hA.maxRam; R < hB.maxRam; R *= 2) ist += homeRamCost(R, bn.home);
    for (let k = hA.cpuCores; k < hB.cpuCores; k++) ist += homeCoreCost(k);
    // Park: Servernamen bleiben; neue Server voll, bestehende als Ausbau
    const pa = new Map((A.p.purchasedServers || []).map((h) => [h, A.servers[h].maxRam]));
    for (const h of B.p.purchasedServers || []) {
      const rb = B.servers[h].maxRam;
      ist += pa.has(h) ? cloudUp(pa.get(h), rb, bn.cost, bn.soft) : cloudCost(rb, bn.cost, bn.soft);
    }
    console.log("  " + pr.name + ": Soll " + fmt(soll) + "  Ist " + fmt(ist) + "  rel " + rel(ist, soll).toExponential(2));
  }

  console.log("\n=== Preis je neuem GB, home gegen Cloud (gleiche Gesamtkapazitaet, nicht gleiche Einzelgroesse)");
  console.log("BN | home 512/1024/2048/4096 GB: Preis je GB | Cloud-Park 25 x r: Schritt r->2r je GB");
  for (const n of [2, 3, 6, 7, 11, 13, 14, 15]) {
    const b = BN[n];
    const h = [512, 1024, 2048, 4096].map((R) => homeRamCost(R, b.home) / R);
    const c = [128, 256, 512, 1024, 2048].map((r) => cloudUp(r, 2 * r, b.cost, b.soft) / r);
    const ratio = [[1024, 256], [2048, 512], [4096, 1024]].map(([R, r]) => (homeRamCost(R, b.home) / R) / (cloudUp(r, 2 * r, b.cost, b.soft) / r));
    console.log("BN" + n + " | home " + h.map((x) => x.toExponential(2)).join(" ") + " | cloud r=128..2048 " + c.map((x) => x.toExponential(2)).join(" ")
      + " | Verhaeltnis (home 1T/2T/4T gegen park 256/512/1024 je Server = 6,4/12,8/25,6 TB) " + ratio.map((x) => x.toFixed(1)).join("/"));
  }

  console.log("\n=== Leiter home 128->4096 und Kern 1->2, BN2 (Summe)");
  let s = 0;
  for (let R = 128; R < 4096; R *= 2) { const c = homeRamCost(R); s += c; console.log("  " + R + "->" + 2 * R + ": " + fmt(c) + "  je neuem GB " + (c / R).toExponential(3)); }
  console.log("  Summe 128->4096: " + fmt(s) + "   Kern 1->2: " + fmt(homeCoreCost(1)) + "  Kern 2->3: " + fmt(homeCoreCost(2)));
}
