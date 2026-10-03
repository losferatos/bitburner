// Audit 03.10.2026, Gruppe BN3/BN11: Kaltstart nach dem Sprung - traegt das
// Geld heute (SF9.3: Gratis-Hashserver, home 128 GB) oder gilt noch die alte
// Warnung "BN3 87 h / BN11 17 h bis zur Werkbank" (nodes/audit-2026-09-02/knoten.md:24-25,59-63)?
//
// Formeln (wortgleich):
//   Hashrate  0,001*level * 1,07^log2(ram) * (1+(cores-1)/5) * (1-ramUsed/ram) * mult * HacknetNodeMoney
//             (Hacknet/formulas/HacknetServers.ts:4-17)
//   Verkauf   4 Hashes -> 1 Mio $ (HashUpgrades "Sell for Money", hashes.js-Kopf)
//   Mietrechner r*55000*CloudServerCost*CloudServerSoftcap^max(0,log2 r-6)
//             (Server/ServerPurchases.ts:22-41)
//   Gym 2.400 $/s je Person (Work/Formulas.ts:100-105, Powerhouse costMult 20 x 120)
// Eichung: Hashrate des Gratis-Servers im BN2.1-Spielstand 05:33 (Spiel: hashRate-Feld).
// Hackgeld der ersten 0,85 h aus BN2.1 (moneySourceB.hacking) x Knotenfaktor
// (bn311-hack.mjs Fruehstand: BN3 0,119, BN11 0,025).
//
// Aufruf: node tools/audit/bn311-kaltstart.mjs
import { loadSave } from "./player-save.mjs";

const { save, player: p } = loadSave("backups/LIVE_197f4d61481686_BN2L1_2026-10-03T05-33_hourly.json.gz");
const all = JSON.parse(save.data.AllServersSave);
const hs = all["hacknet-server-0"].data || all["hacknet-server-0"];
const rate = (lvl, ram, cores, used, mult, hnm) => 0.001 * lvl * Math.pow(1.07, Math.log2(ram)) * (1 + (cores - 1) / 5) * (1 - used / ram) * mult * hnm;
const ist = rate(hs.level, hs.maxRam, hs.cores, hs.ramUsed || 0, p.mults.hacknet_node_money, 1);
console.log(`EICHUNG Hashrate Gratis-Server BN2.1: Soll (Spielstand) ${hs.hashRate.toFixed(6)}/s  Ist ${ist.toFixed(6)}/s  (mult ${p.mults.hacknet_node_money.toFixed(4)})`);

const s = p.moneySourceB.data || p.moneySourceB;
const tH = p.playtimeSinceLastBitnode / 3.6e6;
const hackRateEarly = (s.hacking || 0) / (tH * 3600);   // $/s Mittel 0-0,85 h
console.log(`BN2.1 erste ${tH.toFixed(2)} h: Hack ${(hackRateEarly).toFixed(0)} $/s im Mittel, Hacknet-Verkauf ${((s.hacknet || 0) / (tH * 3600)).toFixed(0)} $/s`);

const cloud = (r, csc, css) => r * 55000 * csc * Math.pow(css, Math.max(0, Math.log2(r) - 6));
const K = {
  BN2: { hnm: 1, hack: 1, csc: 1, css: 1.3 },
  BN3: { hnm: 0.25, hack: 0.119, csc: 2, css: 1.3 },
  BN11: { hnm: 0.1, hack: 0.025, csc: 1, css: 2 },
};
console.log("\nKnoten  Hash $/s  Hack $/s  Summe   32-GB-Rechner  bis 5 Mio (Gym)  bis 50 Mio (Hash->Gym)   alt (knoten.md)");
for (const [bn, k] of Object.entries(K)) {
  const h$ = (ist * k.hnm / 4) * 1e6;     // 4 Hashes = 1 Mio
  const hk = hackRateEarly * k.hack;
  const sum = h$ + hk;
  const c32 = cloud(32, k.csc, k.css);
  const alt = bn === "BN3" ? "87 h" : bn === "BN11" ? "17 h" : "4,4 h";
  console.log(`${bn.padEnd(6)} ${h$.toFixed(0).padStart(8)} ${hk.toFixed(0).padStart(9)} ${sum.toFixed(0).padStart(7)}   ${(c32 / 1e6).toFixed(2)} Mio = ${(c32 / sum / 60).toFixed(1)} min`
    + `   ${(5e6 / sum / 60).toFixed(1).padStart(6)} min   ${(50e6 / sum / 60).toFixed(1).padStart(8)} min            ${alt}`);
}
console.log("\nGym-Kosten bis Kampf 100 (4 Werte, Powerhouse 2.400 $/s, 10 exp/s x str_exp-Mult):");
const exp100 = (mult) => Math.exp((100 / mult + 200) / 32) - 534.6;   // skill.ts umgestellt
for (const m of [1.43]) {
  const e = exp100(m * 1);   // StrengthLevelMultiplier BN3/BN11 = 1 (BitNode.tsx case 3/11 ohne Eintrag)
  const sec = 4 * e / (10 * p.mults.strength_exp);
  console.log(`  Kampf-Mult ${m}: ${e.toFixed(0)} exp je Wert -> ${(sec / 60).toFixed(0)} min Gym = ${(sec * 2400 / 1e6).toFixed(1)} Mio $`);
}
