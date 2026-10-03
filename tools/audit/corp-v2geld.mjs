// Audit 03.10.2026, Bereich CORP: Was ist Geld in einem V2-Lauf wert, und wie
// viel haette der Bot in BN3 OHNE Corporation? (Die "beste Alternative".)
//
// Gemessen (aus Spielstaenden, moneySourceB = seit Knotenbeginn,
// PlayerObject moneySourceB, Prestige.ts setzt es bei prestigeSourceFile zurueck):
//   Einnahmen nach Quelle, Augmentierungsausgaben, Stunden im Knoten.
// Hochgerechnet (UNGEEICHT): BN3-Hackeinkommen = gemessenes Einkommen eines
// Referenzlaufs x (ServerMaxMoney * ScriptHackMoney)_BN3 / (..)_Ref
// (BitNode.tsx:563ff). Die Wachstumsrate (BN3 0,2) ist NICHT eingerechnet -
// die Hochrechnung ist daher eine OBERE Schranke fuer BN3.
//
// Aufruf: node tools/audit/corp-v2geld.mjs
import { summary } from "./corp-save.mjs";

const B = "backups/";
const RUNS = [
  { f: "LIVE_197f4d61481686_BN4L3_2026-09-14T16-44_pre-install.json.gz", note: "BN4.3 bis 17 Black Ops" },
  { f: "LIVE_197f4d61481686_BN9L2_2026-09-22T10-51_pre-jump.json.gz", note: "BN9.2 ganzer Lauf" },
  { f: "LIVE_197f4d61481686_BN9L3_2026-09-24T16-25_pre-jump.json.gz", note: "BN9.3 ganzer Lauf" },
  { f: "LIVE_197f4d61481686_BN10L3_2026-09-10T08-17_pre-install.json.gz", note: "BN10.3 bis 19 Black Ops" },
  { f: "LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz", note: "BN2.1 laufend" },
];
// BitNode.tsx:563ff (fehlend = 1)
const BN = {
  2: { smm: 0.08, shm: 1, aug: 1 },
  3: { smm: 0.04, shm: 0.2, aug: 3 },
  4: { smm: 0.1125, shm: 0.2, aug: 1 },
  6: { smm: 0.2, shm: 0.75, aug: 1 },
  7: { smm: 0.2, shm: 0.5, aug: 3 },
  9: { smm: 0.01, shm: 0.1, aug: 1 },
  10: { smm: 1, shm: 0.5, aug: 5 },
  11: { smm: 0.01, shm: 1, aug: 2 },
  13: { smm: 0.3375, shm: 0.2, aug: 1 },
  14: { smm: 0.7, shm: 0.3, aug: 1.5 },
  15: { smm: 0.8, shm: 1, aug: 3 },
};
const g = (x) => (x / 1e9).toFixed(1);

console.log("1) GEMESSEN - Geldfluss der V2-Laeufe (moneySourceB, Mrd $)");
console.log("Lauf                     h     Einnahmen  davon Hack  Hacknet  Sleeves  Augs-Ausgabe  Augs/Einnahmen  Augs inst+wart");
const meas = {};
for (const r of RUNS) {
  const s = summary(B + r.f);
  const b = s.msB;
  const inc = Object.entries(b)
    .filter(([k, v]) => k !== "total" && v > 0)
    .reduce((a, [, v]) => a + v, 0);
  const aug = -(b.augmentations || 0);
  meas[`${s.bitNodeN}.${s.lauf}`] = { h: s.hInNode, inc, hack: b.hacking || 0, aug };
  console.log(
    `${r.note.padEnd(24)} ${s.hInNode.toFixed(1).padStart(5)}  ${g(inc).padStart(9)}  ${g(b.hacking || 0).padStart(10)}  ${g(b.hacknet || 0).padStart(7)}  ${g(b.sleeves || 0).padStart(7)}  ${g(aug).padStart(12)}  ${((aug / inc) * 100).toFixed(0).padStart(13)} %  ${s.augsInstalled}+${s.augsQueued}`,
  );
}

console.log("\n2) Kaufkraft-Index je Knoten der Restroute: (ServerMaxMoney*ScriptHackMoney)/AugmentationMoneyCost");
for (const n of [2, 3, 11, 6, 7, 14, 13, 15, 4, 9, 10]) {
  const v = BN[n];
  console.log(`   BN${String(n).padEnd(3)} ${((v.smm * v.shm) / v.aug).toFixed(4)}`);
}

console.log("\n3) HOCHRECHNUNG BN3 ohne Corporation (obere Schranke, ungeeicht)");
const ref = meas["4.3"];
const fac = (BN[3].smm * BN[3].shm) / (BN[4].smm * BN[4].shm);
const bn3Hack = ref.hack * fac;
console.log(
  `   Referenz BN4.3: Hack ${g(ref.hack)} Mrd in ${ref.h.toFixed(1)} h; Faktor BN3/BN4 = ${fac.toFixed(3)} -> BN3 ~${g(bn3Hack)} Mrd im gleichen Zeitraum`,
);
console.log(`   in BN4-Kaufkraft (Augs x3 in BN3): ~${g(bn3Hack / 3)} Mrd gegen ${g(ref.aug)} Mrd Augs-Ausgabe in BN4.3`);
const b2 = meas["2.1"];
const fac2 = (BN[3].smm * BN[3].shm) / (BN[2].smm * BN[2].shm);
console.log(
  `   Gegenprobe BN2.1: Hack ${g(b2.hack)} Mrd in ${b2.h.toFixed(1)} h = ${g(b2.hack / b2.h)} Mrd/h; x${fac2.toFixed(2)} -> BN3 ~${g((b2.hack / b2.h) * fac2)} Mrd/h`,
);
console.log("\n4) Corporation in BN3 (corp-cashout.mjs / corp-agri.mjs) gegen diese Alternative");
for (const [name, x] of [
  ["Seed-Auszahlung ohne Geschaeft (Min. 32)", 104.4e9],
  ["Agriculture, IPO nach 3 h (Modell)", 434e9],
  ["Agriculture, IPO nach 24 h (Modell)", 700e9],
]) {
  console.log(
    `   ${name.padEnd(42)} ${g(x).padStart(6)} Mrd = ${(x / bn3Hack).toFixed(1)}x das hochgerechnete BN3-Hackeinkommen eines ganzen ${ref.h.toFixed(0)}-h-Laufs`,
  );
}
