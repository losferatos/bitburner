// Audit 03.10.2026, Gruppe BN3/BN11: Verbrechensgeld je Sleeve in BN11
// (CrimeMoney 3) und BN3 (0,25) bei den Werten, mit denen die Sleeves in V2
// tatsaechlich herumlaufen (Spielstand BN2.1: Kampf ~40, cha 2, int 24-37).
//
// Formeln (wortgleich):
//   Erfolg  Crime/Crime.ts:120-136  (Summe Gewicht*Skill + 0,025*int) / 975
//           / difficulty * crime_success * CrimeSuccessRate * (1 + int^0,8/600)
//   Geld    Work/Formulas.ts:58-79  money * crime_money * CrimeMoney (nicht schockskaliert:
//           SleeveCrimeWork.ts:29-31 scaleWorkStats(..., false))
//   Abschluss SleeveCrimeWork.ts:36-50: Misserfolg -> money 0; Dauer crime.time
//   Sleeve-Mults ohne SF-Boni (Sleeve.ts resetMultipliers; Spielstand: crime_money 1, crime_success 1)
// Daten: Crime/Crimes.ts (geparst).
// Eichung: Homicide-Chance gegen sleeve-bb.mjs/Spielstand-Rechnung des Sleeve-Pruefers (0,21).
//
// Aufruf: node tools/audit/bn311-crime.mjs
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "../../reference/bitburner-src/src/Crime/Crimes.ts");

export function parseCrimes() {
  const t = fs.readFileSync(SRC, "utf8");
  const out = {};
  const re = /\[CrimeType\.(\w+)\]:\s*new Crime\(\s*"[^"]*",\s*"[^"]*",\s*CrimeType\.\w+,\s*([\d.e]+),\s*([\d.e]+),\s*([\d./ ]+),\s*([\d.]+),\s*\{([\s\S]*?)\}/g;
  for (const m of t.matchAll(re)) {
    const params = {};
    for (const p of m[6].matchAll(/(\w+):\s*([\d.]+)/g)) params[p[1]] = Number(p[2]);
    // eslint-disable-next-line no-eval
    out[m[1]] = { time: Number(m[2]), money: Number(m[3]), difficulty: eval(m[4]), karma: Number(m[5]), ...params };
  }
  return out;
}

export function successRate(c, sk, mults = { crime_success: 1 }, bnCSR = 1) {
  let ch = (c.hacking_success_weight || 0) * sk.hacking + (c.strength_success_weight || 0) * sk.strength
    + (c.defense_success_weight || 0) * sk.defense + (c.dexterity_success_weight || 0) * sk.dexterity
    + (c.agility_success_weight || 0) * sk.agility + (c.charisma_success_weight || 0) * sk.charisma
    + 0.025 * sk.intelligence;
  ch /= 975; ch /= c.difficulty; ch *= mults.crime_success; ch *= bnCSR;
  ch *= 1 + Math.pow(sk.intelligence, 0.8) / 600;
  return Math.min(ch, 1);
}

function main() {
  const C = parseCrimes();
  const sk = { hacking: 1, strength: 40, defense: 40, dexterity: 41, agility: 41, charisma: 2, intelligence: 24 };
  console.log("Gefundene Verbrechen:", Object.keys(C).length);
  const hom = successRate(C.homicide, sk);
  console.log("Eichung Homicide-Chance Sleeve Kampf 40, int 24: Soll 0,21 (Sleeve-Pruefer), Ist", hom.toFixed(3));
  for (const [bn, cm] of [["BN11", 3], ["BN3", 0.25], ["BN2", 3]]) {
    const rows = Object.entries(C).map(([n, c]) => {
      const p = successRate(c, sk);
      const perS = (p * c.money * cm) / (c.time / 1000);
      return { n, p, perS };
    }).sort((a, b) => b.perS - a.perS);
    const best = rows[0];
    console.log(`${bn} (CrimeMoney ${cm}): bestes ${best.n} p=${best.p.toFixed(2)} ${Math.round(best.perS)} $/s je Sleeve = ${(best.perS * 3600 * 3 / 1e9).toFixed(3)} Mrd/h fuer 3 Sleeves;`
      + "  naechste: " + rows.slice(1, 4).map((r) => `${r.n} ${Math.round(r.perS)}`).join(", "));
  }

  // Spieler-Karmaphase fuer eine Gang ausserhalb BN2 (Karma <= -54.000,
  // PlayerObjectGangMethods.ts:19-27, Gang/data/Constants.ts:27) - in BN11 nach SF2.3:
  // crime_success und crime_money je x1,42 (SourceFile/applySourceFile.ts case 2: 24+12+6 %).
  // Karma je Erfolg = crime.karma (Crime/Crime.ts commit -> CrimeWork; Homicide 3).
  const sf2 = 1.42;
  for (const [name, psk] of [["Kampf 100 (nach Beitritt-Gym)", { hacking: 300, strength: 100, defense: 100, dexterity: 100, agility: 100, charisma: 50, intelligence: 153 }],
    ["Kampf 190 (BN2.1-Stand)", { hacking: 408, strength: 186, defense: 185, dexterity: 181, agility: 181, charisma: 57, intelligence: 153 }]]) {
    for (const cn of ["homicide", "mug"]) {
      const c = C[cn];
      const pr = successRate(c, psk, { crime_success: sf2 });
      const karmaH = pr * c.karma / (c.time / 1000) * 3600;
      const geldH = pr * c.money * 3 * sf2 / (c.time / 1000) * 3600;   // BN11 CrimeMoney 3
      console.log(`Spieler BN11 ${name}, ${cn}: p=${pr.toFixed(2)}  Karma ${karmaH.toFixed(0)}/h -> -54.000 in ${(54000 / karmaH).toFixed(1)} h,  Geld ${(geldH / 1e9).toFixed(3)} Mrd/h`);
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith("bn311-crime.mjs")) main();
