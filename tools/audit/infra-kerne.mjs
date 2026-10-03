// Audit 03.10.2026 (INFRA): Was bringt ein home-Kern, und ab welcher
// home-Groesse lohnt er ueberhaupt?
//
// Formeln (reference/bitburner-src/src/):
//   Preis   PlayerObjectServerMethods.ts:42-44   1e9 * 7.5^Kerne (geeicht in
//           infra-costs.mjs, Eichung 2 und 3: 7,5e9 exakt in moneySourceB)
//   Bonus   Server/ServerHelpers.ts:315-323      1 + (k-1)/16 auf grow/weaken
//           NetworkShare/Share.ts:22-25           dto. auf share-Faeden
//           Share-Bonus 1 + ln(n)/25              (Share.ts:41-47)
//   Int-Exp NetscriptFunctions/Singularity.ts:584-588  +3 je Kauf
//
// Bot: bn4net.js:2395-2409 plant grow/weaken mit cores = 1 ("Der Kernbonus
// kommt als ungeplanter Ueberschuss an"); homegrow.js:88-98 kauft Kerne bis
// 3e13, sobald Geld > 1,2 x Preis.
//
// Rechnung A (heute): Faeden werden ohne Kerne geplant -> der Bonus erhoeht
//   nur ein ohnehin volles Guthaben bzw. eine ohnehin minimale Sicherheit.
//   Ertrag Geld = 0. Rest: share auf home.
// Rechnung B (falls bn4net die Kerne einplante): eingesparter RAM =
//   homeRam * f_gw * (1 - b(k)/b(k+1)), bewertet mit dem gemessenen Ertrag
//   y $/GB*s (208 in BN2.1, infra-throttle.mjs).
//
// Aufruf: node tools/audit/infra-kerne.mjs
import { coreCost, coreBonus } from "./infra-costs.mjs";

const y = 208;        // $/GB*s, geeicht BN2.1
const fGw = 0.9;      // Obergrenze: Anteil grow+weaken am home-RAM
console.log("Rechnung B: Amortisation eines EINGEPLANTEN Kerns (y = " + y + " $/GB*s, f_gw = " + fGw + ")");
console.log("Kern | Preis | home 1 TB | 8 TB | 64 TB | 512 TB  (Stunden bis zur Amortisation)");
for (let c = 1; c < 7; c++) {
  const gain = 1 - coreBonus(c) / coreBonus(c + 1);
  const cells = [1024, 8192, 65536, 524288].map((R) => {
    const savedGb = R * fGw * gain;
    return (coreCost(c) / (savedGb * y) / 3600).toFixed(1);
  });
  console.log("  " + c + "->" + (c + 1) + " | " + coreCost(c).toExponential(2) + " | " + cells.join(" | "));
}

// Break-even-home-RAM fuer eine Amortisation in 10 h
console.log("\nhome-RAM, ab dem ein eingeplanter Kern sich in 10 h bezahlt (y = " + y + "):");
for (let c = 1; c < 7; c++) {
  const gain = 1 - coreBonus(c) / coreBonus(c + 1);
  const R = coreCost(c) / (fGw * gain * y * 36000);
  console.log("  " + c + "->" + (c + 1) + ": " + Math.round(R).toLocaleString("de-DE") + " GB");
}

// share: Obergrenze, alle share-Faeden auf home
console.log("\nshare (Obergrenze: alle share-Faeden auf home):");
for (const n of [1000, 10000, 100000]) {
  const b1 = 1 + Math.log(n * coreBonus(1)) / 25, b2 = 1 + Math.log(n * coreBonus(2)) / 25;
  console.log("  n=" + n + ": Bonus " + b1.toFixed(4) + " -> " + b2.toFixed(4) + " = Ruf x" + (b2 / b1).toFixed(4));
}
console.log("\nInt-Erfahrung je Kauf: 3 (Singularity.ts:586); Intelligenz 153 hat ~62.900 exp, naechste Stufe ~840 exp entfernt.");

// Was der Kauf im echten Lauf kostete
console.log("\nEchte Kaeufe (aus Spielstaenden, moneySourceB geeicht):");
console.log("  BN2.1 08:36:52: Kern 1->2 fuer 7,50 Mrd = " + (7.5e9 / 24.47e9 * 100).toFixed(0)
  + " % der Hacking-Einnahmen bis 09:59 (24,47 Mrd), " + (7.5e9 / 6.39e9).toFixed(2) + " h Einnahmen zur letzten Rate 6,39 Mrd/h");
console.log("  BN9.3 bis 23.09. 08:45: Kern 1->2 fuer 7,50 Mrd bei 14,33 Mrd Aug-Ausgaben bis dahin; Guthaben 3,57 Mrd bei 9 wartenden Augs (Geld bindend)");
console.log("  BN10.2: Kern 5->6 fuer " + coreCost(5).toExponential(3) + " zwischen 57 h und 87 h; Aug-Ausgaben des ganzen Knotens 2,28e13");
