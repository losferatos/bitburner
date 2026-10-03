// Audit 03.10.2026, Gruppe BN14-13: Verbrechensleitern des Bots in BN14
// (CrimeSuccessRate 0,4, CrimeMoney 0,75 - BitNode.tsx case 14).
//
// Formel 1:1 aus reference/bitburner-src/src:
//   Chance   Crime/Crime.ts:120-136  (gewichtete Stufen /975 /difficulty
//            x crime_success x CrimeSuccessRate x intBonus, Deckel 1)
//   Daten    Crime/Crimes.ts:6-21 (Shoplift), :44-63 (Mug), :139-160 (Homicide)
//   Fehlversuch: Exp x 0,25, kein Geld (Work/CrimeWork.ts:66-75)
//   intBonus formulas/intelligence.ts: 1 + int^0,8/600 (Gewicht 1)
// Bot-Regeln:
//   Spieler  src/bn4life.js:536  kampfwert < 40 Shoplift, < 117 Mug, sonst Homicide
//   Sleeves  src/sleeve.js:927   sleeveMin < 40 Shoplift, sonst Mug (V2, Konto knapp)
//
// Ungeeicht (kein Spielstand mit Verbrechen in BN14); die Formel ist dieselbe,
// die bn4life.js:24-37 und sleeve.js:253-262 fuer CrimeSuccessRate 1 nachrechnen.
// Aufruf: node tools/audit/bn1413-crime.mjs
const CR = {
  Shoplift: { t: 2, money: 15e3, diff: 1 / 20, w: { dex: 1, agi: 1 }, exp: 4 },
  Mug: { t: 4, money: 36e3, diff: 1 / 5, w: { str: 1.5, def: 0.5, dex: 1.5, agi: 0.5 }, exp: 12 },
  Homicide: { t: 3, money: 45e3, diff: 1, w: { str: 2, def: 2, dex: 0.5, agi: 0.5 }, exp: 8 },
};

export function chance(c, s, { csr = 1, crimeSuccess = 1, int = 0 } = {}) {
  let x = 0;
  for (const [k, w] of Object.entries(c.w)) x += w * s[k];
  x += 0.025 * int; // CONSTANTS.IntelligenceCrimeWeight
  x = x / 975 / c.diff * crimeSuccess * csr * (1 + Math.pow(int, 0.8) / 600);
  return Math.min(1, x);
}

// Erwartung je Sekunde: Geld und Kampf-Exp (Summe der vier Werte)
export function rate(c, s, opt) {
  const p = chance(c, s, opt);
  return { p, money: p * c.money * opt.crimeMoney / c.t, exp: (p + (1 - p) * 0.25) * c.exp * opt.crimeExpGain / c.t };
}

const botPlayer = (s) => { const k = (s.str + s.def + s.dex + s.agi) / 4; return k < 40 ? "Shoplift" : k < 117 ? "Mug" : "Homicide"; };
const botSleeve = (s) => (Math.min(s.str, s.def, s.dex, s.agi) < 40 ? "Shoplift" : "Mug");

if (process.argv[1] && process.argv[1].endsWith("bn1413-crime.mjs")) {
  for (const [lab, csr, cm] of [["BN2 (Kontrolle, CSR 1)", 1, 3], ["BN14 (CSR 0,4, CrimeMoney 0,75)", 0.4, 0.75]]) {
    console.log("== " + lab);
    console.log("   Stufe  Bot-Spieler  $/s Bot   bestes $/s        Bot-Sleeve  $/s Bot   bestes $/s");
    for (const lv of [10, 20, 40, 50, 61, 80, 100, 117, 150, 200, 300]) {
      const s = { str: lv, def: lv, dex: lv, agi: lv };
      // Spieler: Int 153 (Spielstand BN2.1), Sleeve: Int 0 (Sleeves erben kein Int)
      const optP = { csr, crimeSuccess: 1, int: 153, crimeMoney: cm, crimeExpGain: 1 };
      const optS = { csr, crimeSuccess: 1, int: 0, crimeMoney: cm, crimeExpGain: 1 };
      const best = (opt) => Object.entries(CR).map(([n, c]) => [n, rate(c, s, opt).money]).sort((a, b) => b[1] - a[1])[0];
      const bp = botPlayer(s), bs = botSleeve(s);
      const rp = rate(CR[bp], s, optP).money, rs = rate(CR[bs], s, optS).money;
      const [nP, vP] = best(optP), [nS, vS] = best(optS);
      console.log("   " + String(lv).padStart(5) + "  " + bp.padEnd(11) + rp.toFixed(0).padStart(8) + "   " + (nP + " " + vP.toFixed(0)).padEnd(17)
        + (vP > rp * 1.001 ? "x" + (vP / rp).toFixed(2) : "ok   ") + "  " + bs.padEnd(10) + rs.toFixed(0).padStart(8) + "   " + (nS + " " + vS.toFixed(0)).padEnd(17)
        + (vS > rs * 1.001 ? "x" + (vS / rs).toFixed(2) : "ok"));
    }
  }
}
