// Audit 03.10.2026, Gruppe BN14-13: Kaltstart in BN13/BN14 - reicht das Geld
// fuer das Beitrittstor, und wie lang ist das Tor?
//
// Formeln 1:1 aus reference/bitburner-src/src:
//   Hash-Rate   Hacknet/formulas/HacknetServers.ts:4-17
//               0,001*level * 1,07^log2(maxRam) * (1+(cores-1)/5) * (1-ramUsed/maxRam)
//               * hacknet_node_money * HacknetNodeMoney
//   Gratis-Server SF9.3: level 100, cores 10, cache 5 (Prestige.ts:329-338)
//   Verkauf     4 Hashes -> 1 Mio $ (Hacknet/data/HashUpgradesMetadata.tsx, "Sell for Money")
//   Startgeld   BN13: CONSTANTS.TravelCost 200.000 (Prestige.ts:341-342), sonst 1000+262
//   Gym         Powerhouse 2.400 $/s (src/bbtrain.js:245 gemessen), 10 exp/s * strength_exp (Work/Formulas.ts:108-121)
//   Stufen      PersonObjects/formulas/skill.ts (calculateSkill/calculateExp)
//
// Eichung: Hash-Rate des Gratis-Servers gegen den Spielstand BN2L1 09:59
// (hashRate im AllServersSave). ClassGymExpGain wird in 3.0.2 nirgends
// angewandt (grep ueber src/: nur BitNodeMultipliers.ts:28, BitNode.tsx,
// UI-Text) - das Gym ist in BN13 also NICHT halbiert.
//
// Aufruf: node tools/audit/bn1413-kalt.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { full } from "./bn1413-mults.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FILE = path.join(root, "backups", "LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz");

export function hashRate(level, ramUsed, maxRam, cores, mult, hnm) {
  return 0.001 * level * Math.pow(1.07, Math.log2(maxRam)) * (1 + (cores - 1) / 5) * (1 - ramUsed / maxRam) * mult * hnm;
}
const calcExp = (skill, mult) => Math.max(0, Math.exp((skill / mult + 200) / 32) - 534.6);

const s = JSON.parse(zlib.gunzipSync(fs.readFileSync(FILE)).toString("utf8"));
const all = JSON.parse(s.data.AllServersSave);
const p = JSON.parse(s.data.PlayerSave).data;
const hs = all["hacknet-server-0"].data;
const mult = p.mults.hacknet_node_money;
const ist = hs.hashRate;
const soll = hashRate(hs.level, hs.ramUsed || 0, hs.maxRam, hs.cores, mult, full(2).HacknetNodeMoney);
console.log(`Eichung Hash-Rate Gratis-Server (BN2L1 09:59): Spielstand ${ist.toFixed(6)}  gerechnet ${soll.toFixed(6)}  `
  + (Math.abs(soll / ist - 1) < 1e-9 ? "OK" : "ABWEICHUNG"));

console.log("\nKaltstart je Knoten (Gratis-Server 1 GB beim Eintritt, hacknet_node_money " + mult.toFixed(3) + " wie BN2.1):");
for (const n of [2, 13, 14]) {
  const m = full(n);
  const r = hashRate(100, 0, 1, 10, mult, m.HacknetNodeMoney);
  const dollar = r / 4 * 1e6;
  const start = n === 13 ? 200000 : 1262;
  const bis = (ziel) => Math.max(0, (ziel - start) / dollar) / 60;
  const gymAlle = 2400 * 4; // Spieler + 3 Sleeves im Powerhouse
  console.log(`  BN${n}: ${r.toFixed(4)} Hashes/s = ${(dollar / 1000).toFixed(1)} k$/s; 5 Mio (bbtrain-Tor) nach ${bis(5e6).toFixed(1)} min, `
    + `50 Mio (hashes.js Gym-Stufen) nach ${bis(50e6).toFixed(1)} min; Gym fuer 4 Koerper ${gymAlle} $/s = ${(100 * gymAlle / dollar).toFixed(0)} % der Hash-Einnahme`);
}

console.log("\nBeitrittstor 4 x Stufe 100 (Spieler allein, Gym 10 exp/s * strength_exp, ohne Hash-Gym-Stufen):");
const augMult = p.mults.strength, expMult = p.mults.strength_exp;
for (const n of [2, 13, 14]) {
  const lm = full(n).StrengthLevelMultiplier;
  const e = 4 * calcExp(100, augMult * lm);
  const h = e / (10 * expMult) / 3600;
  console.log(`  BN${n}: LM ${lm}  Exp ${Math.round(e)}  = ${h.toFixed(2)} h Gym; mit 6 Hash-Gym-Stufen (x2,2) ${(h / 2.2).toFixed(2)} h`);
}
console.log(`  (aug-mult ${augMult.toFixed(3)}, strength_exp ${expMult.toFixed(3)} aus dem Spielstand; ClassGymExpGain 0,5 in BN13 ist im Spiel ohne Wirkung)`);
