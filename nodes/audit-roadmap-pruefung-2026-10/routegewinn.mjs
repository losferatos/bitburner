// Laufzeit je offenem Knoten (V2) und Gewinn der Umstellung "BN6.2/6.3 + BN7 vor BN11".
// Modell (geldwert.md Abschnitt 2, geeicht auf BN2.3): Rangrate ~ BladeburnerRank * K^beta,
// K = Kampfwert-Faktor; Stat-Level ~ StrengthLevelMultiplier (Person.ts:62-145), Rang ~ BladeburnerRank (Bladeburner/Formulas.ts:9-28).
const beta = [1.44, 1.77];                      // geldwert.md:89 (a 0,7 ... 0,5)
const S = [12.4, 18.6];                         // langsame Phase rank 1.0: BN2.3 Tor bei 12,4 h; BN3.1 Einbau bei 18,6 h (Backups)
const sweep = [1.5, 3.1];                       // Endspurt nach Einbau: BN2.3 12,4->14,5 h; BN3.1 18,6->21,7 h
const nodes = { // BitNode.tsx Zeilen
  11: { rank: 1.0, stat: 1.0, z: "883-916" }, 6: { rank: 1.0, stat: 1.0, z: "688-721" }, 7: { rank: 0.6, stat: 1.0, z: "722-763" },
  14: { rank: 0.6, stat: 0.5, z: "1040-1083" }, 13: { rank: 0.45, stat: 0.7, z: "991-1039" }, 15: { rank: 0.2, stat: 0.7, z: "1085-1118" },
  9: { rank: 0.9, stat: 0.45, z: "795-837" },
};
const dauer = (n, s, b, w) => s / (n.rank * Math.pow(n.stat, b)) + w;
console.log("Eichprobe BN9 (gemessen BN9.3 53,6 h):", dauer(nodes[9], S[0], beta[0], sweep[0]).toFixed(1), "-", dauer(nodes[9], S[0], beta[1], sweep[1]).toFixed(1), "h (BN2.3-Basis)");
for (const k of [11, 6, 7, 14, 13, 15]) {
  const n = nodes[k]; const lo = dauer(n, S[0], beta[0], sweep[0]), hi = dauer(n, S[1], beta[1], sweep[1]);
  console.log(`BN${k}: ${lo.toFixed(0)}-${hi.toFixed(0)} h je Lauf (rank ${n.rank}, Stat-Level ${n.stat}, BitNode.tsx:${n.z})`);
}
// Umstellung: BN11 x3 bekommt SF6.3 statt 6.1 (Kampf 1,14/1,08, applySourceFile.ts:93-108) und SF7.3 (bb_success 1,14, :110-122)
const r6 = (b) => Math.pow(1.14 / 1.08, b);
const r7 = [1.0, 1.14];
const f = [0.5, 0.85];                          // Anteil der Laufzeit, der mit der Rate skaliert (Rest: Stillstand/Endspurt)
const T11 = [dauer(nodes[11], S[0], beta[0], sweep[0]), dauer(nodes[11], S[1], beta[1], sweep[1])];
const gewinnLo = 3 * T11[0] * f[0] * (1 - 1 / (r6(beta[0]) * r7[0]));
const gewinnHi = 3 * T11[1] * f[1] * (1 - 1 / (r6(beta[1]) * r7[1]));
// Verlust: BN6 x2 + BN7 x3 laufen ohne SF11.3 (Preiskette 1,767 statt 1,9, AugmentationHelpers.ts:30); je Lauf 0-0,5 h (geschaetzt, im Ruf-Deckel ~0)
const verlustHi = 5 * 0.5;
console.log(`Gewinn BN11x3: ${gewinnLo.toFixed(1)}-${gewinnHi.toFixed(1)} h; Verlust BN6/7 ohne SF11: 0-${verlustHi} h; netto ${(gewinnLo - verlustHi).toFixed(1)} bis ${gewinnHi.toFixed(1)} h`);
