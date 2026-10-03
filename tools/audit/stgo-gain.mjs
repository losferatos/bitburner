// Audit 03.10.2026, Bereich STGO: grobe Stundenrechnung fuer die Restroute.
//
// GESCHAETZT, nicht geeicht. Annahmen stehen als Konstanten oben und im Bericht.
// Modell (bewusst konservativ): In der chance-begrenzten Vorphase waechst die
// competence ungefaehr log-linear in der Zeit (Stufen ~ ln(exp), Skills ~ Rang).
// Ein statischer Faktor k auf die competence spart dann den Anteil
// ln(k) / ln(K) der chance-begrenzten Zeit, wobei K der noch fehlende
// competence-Faktor ist. Untere Schranke - die Exp-Aequivalenz aus
// stgo-go.mjs (Abschnitt 4) zeigt, dass ein Stufen-Faktor in Wahrheit einem
// Vielfachen an Kampf-Exp entspricht.
//
// Eingangsgroessen und ihre Quelle:
//   K = 0,9 / 0,0867 = 10,4   Typhoon-Chance im Spielstand BN2.1 09:59 (geeicht,
//                             stgo-blade.mjs) gegen die Feuerschwelle 0,90 (ENTSCHIEDEN)
//   Anteil Vorphase 0,67      doku/rangkurve-bn10.json: Rang 2.500 erst bei 46,6 h von 69,7 h
//   Laufdauer T               backups/INDEX.tsv: V2-Laeufe BN9 104/81/54 h, BN10 59/97 h
//   k (Chance-Faktor)         stgo-go.mjs Abschnitt 2+4, stgo-stanek.mjs Abschnitt 4
//
// Aufruf: node tools/audit/stgo-gain.mjs
const K = 0.9 / 0.0867;
const SHARE = 46.6 / 69.7;

const rows = [
  // [Massnahme, Knoten, Laeufe, T in h, k niedrig, k hoch]
  ["Go Tetrads (normal), mittel 12h-Mittel +29%", "BN2.2-2.3,3,11,6.2-6.3,7", 13, 60, 1.10, 1.20],
  ["Go Tetrads BN14 (GoPower 4), Mittel +66..116%", "BN14.1-14.3", 3, 60, 1.40, 1.65],
  ["Go Tetrads mit SF14 (x2), Mittel +33..58%", "BN13,BN15", 6, 85, 1.20, 1.33],
  ["Stanek BN13 (250-1000 Faeden)", "BN13.1-13.3", 3, 80, 1.34, 1.45],
  ["Stanek BN15 (250-1000 Faeden, Power 0,7)", "BN15.1-15.3", 3, 94, 1.07, 1.10],
];
let sumLo = 0, sumHi = 0;
console.log(`K = ${K.toFixed(2)}, Vorphasenanteil ${SHARE.toFixed(2)}`);
for (const [m, n, runs, T, kLo, kHi] of rows) {
  const lo = SHARE * T * Math.log(kLo) / Math.log(K);
  const hi = SHARE * T * Math.log(kHi) / Math.log(K);
  sumLo += lo * runs; sumHi += hi * runs;
  console.log(`${m.padEnd(50)} ${n.padEnd(26)} ${runs} Laeufe x T ${T} h: je Lauf ${lo.toFixed(1)}-${hi.toFixed(1)} h, zusammen ${(lo * runs).toFixed(0)}-${(hi * runs).toFixed(0)} h`);
}
console.log(`Summe (untere Schranke des Modells): ${sumLo.toFixed(0)}-${sumHi.toFixed(0)} h`);
// Beitrittstor BN14 (stgo-blade.mjs: 3,09 h Gym allein, f 1,31 -> -65 %)
console.log(`Zusatz BN14 Beitrittstor: 3,09 h x 0,4..0,65 = ${(3.09 * 0.4).toFixed(1)}-${(3.09 * 0.65).toFixed(1)} h je Lauf (Spieler allein; Sleeves verkuerzen die Basis)`);

// Zweite Klammer, GEMESSEN: Wachstumsrate von ln(Typhoon-Chance) im laufenden
// BN2.1 aus den Spielstaenden (geeichte Kette stgo-blade.mjs). Ersparnis eines
// statischen Faktors k = ln(k) / Rate - bei konstanter Rate; die Rate faellt
// im Lauf (Stufen ~ ln exp), deshalb ist das eine untere Schranke fuer
// BN2-artige Knoten.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadState, blackOpChance, TYPHOON } from "./stgo-blade.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const idx = fs.readFileSync(path.join(root, "backups", "INDEX.tsv"), "utf8").split("\n").slice(1)
  .map((l) => l.split("\t")).filter((c) => c[4] === "2" && c[5] === "1").map((c) => c[1]);
const pts = [];
for (const f of idx) {
  const { p, bb } = loadState(path.join(root, "backups", f));
  if (!bb) continue;
  const team = bb.blackOperations?.["Operation Typhoon"]?.data?.teamCount ?? 0;
  const c = blackOpChance(TYPHOON, p.skills, bb.skills, p.mults, bb.maxStamina, bb.maxStamina, team);
  pts.push({ h: p.playtimeSinceLastBitnode / 3.6e6, lnC: Math.log(c) });
}
pts.sort((a, b) => a.h - b.h);
const last = pts[pts.length - 1];
for (const first of pts.filter((q) => q.h >= 2.5 && q.h <= 4)) {
  const rate = (last.lnC - first.lnC) / (last.h - first.h);
  console.log(`gemessen BN2.1 ${first.h.toFixed(2)}-${last.h.toFixed(2)} h: d ln(Chance)/dt = ${rate.toFixed(3)}/h -> Ersparnis je Lauf bei k 1,10/1,20/1,45: ${(Math.log(1.1) / rate).toFixed(1)} / ${(Math.log(1.2) / rate).toFixed(1)} / ${(Math.log(1.45) / rate).toFixed(1)} h`);
}
