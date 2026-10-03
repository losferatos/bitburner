// Audit 03.10.2026 (INFRA): Kostenformeln aus dem Spielquellcode nachgebaut
// und gegen echte Spielstandwerte geeicht.
//
// Quellen (reference/bitburner-src/src/):
//   Cloud:  Server/ServerPurchases.ts:22-41 getCloudServerCost
//           r * 55000 * CloudServerCost * CloudServerSoftcap^max(0, log2 r - 6)
//           Upgrade = Differenz (ServerPurchases.ts:43-53)
//           Limit 25 * CloudServerLimit, MaxRam 2^20 * CloudServerMaxRam (:92-101)
//   home RAM: PersonObjects/Player/PlayerObjectServerMethods.ts:30-40
//           R * 32000 * 1.58^log2(R) * HomeComputerRamCost
//   Kerne:  PlayerObjectServerMethods.ts:42-44  1e9 * 7.5^Kerne (KEIN BN-Faktor)
//   Kernbonus: Server/ServerHelpers.ts:315-323  1 + (k-1)/16
//   BN-Faktoren: BitNode/BitNode.tsx:563-1120
//
// Eichung 1: data/preise.json im Spielstand BN2.1 09:59 (vom Spiel ueber
//            ns.cloud.getServerCost geschrieben) - alle 19 Groessen.
// Eichung 2: moneySourceB.servers im selben Spielstand gegen die aus Log und
//            Spielstand rekonstruierte Kaufliste (home 128->1024, 1 Kern,
//            Park 4x256 + 21x128).
// Eichung 3: BN9.3 (HomeComputerRamCost 5): moneySourceB.servers 23.09. 08:45
//            gegen home 128->512 + 1 Kern.
//
// Aufruf: node tools/audit/infra-costs.mjs
import { readSave } from "./infra-save.mjs";

export const BN_MULTS = {
  // nur die Infrastruktur-Felder; Quelle BitNode.tsx (Zeilen im Bericht)
  1: {}, 2: { CloudServerSoftcap: 1.3 },
  3: { HomeComputerRamCost: 1.5, CloudServerCost: 2, CloudServerSoftcap: 1.3 },
  4: { CloudServerSoftcap: 1.2 }, 5: { CloudServerSoftcap: 1.2 },
  6: { CloudServerSoftcap: 2 }, 7: { CloudServerSoftcap: 2 },
  8: { CloudServerSoftcap: 4 },
  9: { HomeComputerRamCost: 5, CloudServerLimit: 0 },
  10: { HomeComputerRamCost: 1.5, CloudServerCost: 5, CloudServerSoftcap: 1.1, CloudServerLimit: 0.6, CloudServerMaxRam: 0.5 },
  11: { CloudServerSoftcap: 2 }, 13: { CloudServerSoftcap: 1.6 }, 14: {}, 15: {},
};
const m = (bn, k) => (BN_MULTS[bn] && BN_MULTS[bn][k] !== undefined ? BN_MULTS[bn][k] : 1);

export function cloudCost(ram, bn) {
  const upg = Math.max(0, Math.log(ram) / Math.log(2) - 6);
  return ram * 55000 * m(bn, "CloudServerCost") * Math.pow(m(bn, "CloudServerSoftcap"), upg);
}
export function homeRamCost(curRam, bn) {
  return curRam * 32000 * Math.pow(1.58, Math.log2(curRam)) * m(bn, "HomeComputerRamCost");
}
export function coreCost(curCores) {
  return 1e9 * Math.pow(7.5, curCores);
}
export const coreBonus = (c) => 1 + (c - 1) / 16;

function fmt(x) { return x.toExponential(4); }

if (process.argv[1] && process.argv[1].endsWith("infra-costs.mjs")) {
  // --- Eichung 1: Preistabelle aus dem Spiel ------------------------------
  const f2 = "backups/LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz";
  const { player, servers } = readSave(f2);
  const tf = servers.home.data.textFiles.data.find(([n]) => n === "data/preise.json")[1];
  const preise = JSON.parse((tf.data || tf).text).preise;
  let maxRel = 0;
  for (const [gb, p] of Object.entries(preise)) {
    const mine = cloudCost(Number(gb), 2);
    maxRel = Math.max(maxRel, Math.abs(mine - p) / p);
  }
  console.log("Eichung 1 (Cloud-Preise BN2, 19 Groessen 2..2^20): max. rel. Abweichung", maxRel.toExponential(2));

  // --- Eichung 2: moneySourceB.servers BN2.1 --------------------------------
  const msB = (player.moneySourceB.data || player.moneySourceB).servers;
  let home = 0;
  for (let r = 128; r < 1024; r *= 2) home += homeRamCost(r, 2);
  const core = coreCost(1);
  const park = 4 * cloudCost(256, 2) + 21 * cloudCost(128, 2);
  const soll = home + core + park;
  console.log("Eichung 2 (BN2.1 09:59): home 128->1024", fmt(home), "+ Kern 1->2", fmt(core),
    "+ Park 4x256+21x128", fmt(park), "=", fmt(soll), "| Spielstand servers", fmt(-msB),
    "| rel.", ((soll + msB) / -msB).toExponential(2));

  // --- Eichung 3: BN9.3 ------------------------------------------------------
  const f9 = "backups/LIVE_197f4d61481686_BN9L3_2026-09-23T08-45_pre-hotswap.json.gz";
  try {
    const s9 = readSave(f9);
    const ms9 = (s9.player.moneySourceB.data || s9.player.moneySourceB).servers;
    let h9 = 0;
    for (let r = 128; r < 512; r *= 2) h9 += homeRamCost(r, 9);
    const soll9 = h9 + coreCost(1);
    console.log("Eichung 3 (BN9.3 08:45, HRC 5): home 128->512", fmt(h9), "+ Kern", fmt(coreCost(1)),
      "=", fmt(soll9), "| Spielstand servers", fmt(-ms9), "| rel.", ((soll9 + ms9) / -ms9).toExponential(2));
  } catch (e) { console.log("Eichung 3 nicht moeglich:", String(e)); }

  // --- Tabellen fuer die Restroute -----------------------------------------
  console.log("\nKerne (kein BN-Faktor): Kauf k->k+1 | Preis | relativer Gewinn grow/weaken auf home");
  for (let c = 1; c < 8; c++) {
    console.log("  " + c + "->" + (c + 1), fmt(coreCost(c)), "+" + ((coreBonus(c + 1) / coreBonus(c) - 1) * 100).toFixed(2) + " %");
  }
  console.log("\n$/GB: home-Verdopplung ab R | Cloud-Schritt r->2r (Preis/zusaetzliches GB) je BN der Restroute");
  const route = [2, 3, 11, 6, 7, 14, 13, 15, 8];
  const sizes = [128, 1024, 8192, 65536, 524288];
  for (const bn of route) {
    const homeRow = sizes.map((R) => (homeRamCost(R, bn) / R).toExponential(2)).join(" ");
    const cloudRow = [64, 256, 1024, 8192, 65536, 524288]
      .map((r) => ((cloudCost(2 * r, bn) - cloudCost(r, bn)) / r).toExponential(2)).join(" ");
    console.log("  BN" + bn + " home@" + sizes.join("/") + ": " + homeRow + " | cloud@64/256/1k/8k/64k/512k: " + cloudRow);
  }
  // Wo kreuzen sich home- und Cloud-GB-Preis? (nur Preis, ohne Lebensdauer)
  console.log("\nKreuzung: kleinstes home R, ab dem eine home-Verdopplung je GB teurer ist als der teuerste Cloud-Schritt 2^19->2^20");
  for (const bn of route) {
    const cloudTop = (cloudCost(1048576, bn) - cloudCost(524288, bn)) / 524288;
    let R = 128;
    while (R < 2 ** 30 && homeRamCost(R, bn) / R < cloudTop) R *= 2;
    console.log("  BN" + bn + ": Cloud-Top " + cloudTop.toExponential(2) + " $/GB, home ab " + R + " GB teurer");
  }
}
