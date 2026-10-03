// Audit 03.10.2026, Bereich FAKT: Reputationsformeln aus dem Spielquellcode
// (v3.0.2) als ausfuehrbarer Code, geeicht gegen echte Spielstaende.
//
//   Favor        Faction/formulas/favor.ts:12-24, Faction.ts:77-85
//   Faktionsarbeit PersonObjects/formulas/reputation.ts:8-52, Work/FactionWork.tsx:37-39
//   Firmenarbeit Work/Formulas.ts:124-158, Company/CompanyPosition.ts:156-172,
//                Work/CompanyWork.tsx:35-39
//   Spende       Faction/formulas/donation.ts:8-18
//   intBonus     PersonObjects/formulas/intelligence.ts (1 + w*int^0.8/600)
//
// Aufruf: node tools/audit/fakt-rep.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const BACKUPS = path.join(ROOT, "backups");

// --- Formeln ---------------------------------------------------------------
const LOG102 = 0.019802627296179712;                 // favor.ts:9
export const favorToRep = (f) => Math.max(0, 25000 * Math.expm1(LOG102 * f));
export const repToFavor = (r) => Math.min(35331, Math.max(0, Math.log1p(r / 25000) / LOG102));
export const addRepToFavor = (fav, rep) => repToFavor(favorToRep(fav) + rep);
export const intBonus = (int, w = 1) => 1 + (w * Math.pow(int, 0.8)) / 600;
const MAX_SKILL = 975;                                // Constants.ts:16
const CPS = 5;                                        // 1000 / MilliPerCycle 200

/** reputation.ts:8-52 - Rep je ZYKLUS (200 ms), ohne Fokusfaktor. */
export function factionRepPerCycle(type, sk, mults, favor, fwrg, share = 1, sf15cha = 0) {
  const fm = (1 + favor / 100) * fwrg;
  const ib = intBonus(sk.intelligence, 1);
  if (type === "hacking") {
    return ((sk.hacking + sk.intelligence / 3 + sf15cha * 0.1 * sk.charisma) / MAX_SKILL)
      * mults.faction_rep * ib * fm * share;
  }
  if (type === "security") {
    const t = (0.9 * (sk.strength + sk.defense + sk.dexterity + sk.agility + sf15cha * 0.3 * sk.charisma
      + (sk.hacking + sk.intelligence) * share)) / MAX_SKILL / 4.5;
    return t * mults.faction_rep * fm * ib;
  }
  // field
  const t = (0.9 * (sk.strength + sk.defense + sk.dexterity + sk.agility + sk.charisma
    + (sk.hacking + sk.intelligence + sf15cha * 0.3 * sk.charisma) * share)) / MAX_SKILL / 5.5;
  return t * mults.faction_rep * fm * ib;
}

/** CompanyPosition.ts:156-172 */
export function jobPerformance(pos, sk) {
  const e = pos.eff;
  const sum = (e.hacking || 0) * sk.hacking + (e.strength || 0) * sk.strength + (e.defense || 0) * sk.defense
    + (e.dexterity || 0) * sk.dexterity + (e.agility || 0) * sk.agility + (e.charisma || 0) * sk.charisma;
  return (pos.repMultiplier * (sum / MAX_SKILL)) / 100 + sk.intelligence / MAX_SKILL;
}
/** Work/Formulas.ts:154-156 - Firmenrep je ZYKLUS. Kein share-Bonus, kein FactionWorkRepGain. */
export function companyRepPerCycle(pos, sk, mults, companyFavor, cwrg = 1) {
  return jobPerformance(pos, sk) * mults.company_rep * (1 + companyFavor / 100) * cwrg;
}
/** donation.ts:8-10 */
export const repFromDonation = (amt, mults, fwrg) => (amt / 1e6) * mults.faction_rep * fwrg;

// Stellen aus Company/data/CompanyPositionsMetadata.ts
export const POS = {
  "IT Intern":       { repMultiplier: 0.9, eff: { hacking: 90, charisma: 10 } },            // :113-124
  "IT Analyst":      { repMultiplier: 1.1, eff: { hacking: 85, charisma: 15 } },            // :125-136
  "Software Engineering Intern": { repMultiplier: 0.9, eff: { hacking: 85, charisma: 15 } }, // :7-18
  "Security Guard":  { repMultiplier: 1, eff: { hacking: 5, strength: 20, defense: 20, dexterity: 20, agility: 20, charisma: 15 } }, // :284-307
};

// --- Spielstand lesen -----------------------------------------------------------
function load(file) {
  const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(BACKUPS, file))).toString());
  const p = JSON.parse(save.data.PlayerSave).data;
  const F = JSON.parse(save.data.FactionsSave);
  const C = JSON.parse(save.data.CompaniesSave);
  const fac = (n) => { const d = F[n] && (F[n].data || F[n]); return { rep: d ? (d.playerReputation || 0) : 0, favor: d ? (d.favor || 0) : 0 }; };
  const com = (n) => { const d = C[n] && (C[n].data || C[n]); return { rep: d ? (d.playerReputation || 0) : 0, favor: d ? (d.favor || 0) : 0 }; };
  return { p, fac, com };
}
const F = (x, n = 4) => Number(x).toFixed(n);

if (process.argv[1] && process.argv[1].endsWith("fakt-rep.mjs")) {
  console.log("=== EICHUNG 1: Favor beim Einbau (favor.ts addRepToFavor) ===");
  // Paare: pre-install-Sicherung (Rep, Favor vorher) -> naechste Sicherung (Favor nachher)
  const paare = [
    ["LIVE_197f4d61481686_BN12L3_2026-10-02T20-00_pre-install.json.gz", "LIVE_197f4d61481686_BN12L3_2026-10-02T20-33_hourly.json.gz", "The Black Hand"],
    ["LIVE_197f4d61481686_BN12L3_2026-10-03T02-26_pre-install.json.gz", "LIVE_197f4d61481686_BN12L3_2026-10-03T02-33_hourly.json.gz", "BitRunners"],
    ["LIVE_197f4d61481686_BN12L3_2026-10-03T02-26_pre-install.json.gz", "LIVE_197f4d61481686_BN12L3_2026-10-03T02-33_hourly.json.gz", "Sector-12"],
    ["LIVE_197f4d61481686_BN12L3_2026-10-03T02-26_pre-install.json.gz", "LIVE_197f4d61481686_BN12L3_2026-10-03T02-33_hourly.json.gz", "CyberSec"],
  ];
  for (const [a, b, f] of paare) {
    const A = load(a).fac(f), B = load(b).fac(f);
    const ist = addRepToFavor(A.favor, A.rep);
    console.log(`  ${f.padEnd(15)} vorher Favor ${F(A.favor)} + Rep ${F(A.rep, 1)} -> Formel ${F(ist)} | Spielstand ${F(B.favor)} | Abw ${F(B.favor - ist, 6)}`);
  }

  console.log("\n=== EICHUNG 2: Firmenarbeit (Formulas.ts:124-158) gegen Clarke 04:33 BN12L3 ===");
  {
    const { p, com } = load("LIVE_197f4d61481686_BN12L3_2026-10-03T04-33_hourly.json.gz");
    const w = p.currentWork.data || p.currentWork;
    const c = com("Clarke Incorporated");
    // BN12 setzt kein CompanyWorkRepGain (BitNode.tsx case 12) -> 1. Fokus true, IT Intern nicht Teilzeit.
    const perCyc = companyRepPerCycle(POS["IT Intern"], p.skills, p.mults, c.favor, 1);
    // Die Favor im Spielstand ist der NACH dem Einbau gesetzte Wert (Einbau 04:32), Rep ist ab 0 gezaehlt.
    console.log(`  Stelle ${p.jobs["Clarke Incorporated"]}, Zyklen ${w.cyclesWorked}, Favor ${F(c.favor)}, hack ${p.skills.hacking}, int ${p.skills.intelligence}, cha ${p.skills.charisma}, company_rep ${F(p.mults.company_rep)}`);
    console.log(`  Formel ${F(perCyc)} je Zyklus x ${w.cyclesWorked} = ${F(perCyc * w.cyclesWorked, 2)} | Spielstand ${F(c.rep, 2)} | Abw ${F(100 * (c.rep / (perCyc * w.cyclesWorked) - 1), 3)} %`);
  }

  console.log("\n=== EICHUNG 3: Faktionsarbeit hacking (reputation.ts:16-24), implizierter share-Bonus ===");
  // Stundenpaare mit durchgehender Arbeit fuer dieselbe Faktion (fokussiert). Unbekannt ist nur der
  // share-Bonus (Share.ts:46-52, 1 + ln(threads)/25) und Coding-Contract-Zufluesse. Die Formel gilt als
  // geeicht, wenn der implizierte share-Bonus in allen Paaren gleich und plausibel (1..1,4) ist.
  const BN12_3 = 1 / Math.pow(1.02, 3);                // BitNode.tsx:918ff dec fuer Stufe 3
  const stunden = [
    ["2026-10-02T21-33_hourly", "2026-10-02T22-33_hourly", "The Black Hand"],
    ["2026-10-03T00-33_hourly", "2026-10-03T01-33_hourly", "BitRunners"],
  ];
  for (const [a, b, f] of stunden) {
    const A = load("LIVE_197f4d61481686_BN12L3_" + a + ".json.gz"), B = load("LIVE_197f4d61481686_BN12L3_" + b + ".json.gz");
    const wa = A.p.currentWork.data || A.p.currentWork, wb = B.p.currentWork.data || B.p.currentWork;
    const cyc = wb.cyclesWorked - wa.cyclesWorked;
    const fa = A.fac(f), fb = B.fac(f);
    // Hacking-Level waechst im Intervall: Mittel der beiden Endpunkte
    const sk = { ...A.p.skills, hacking: (A.p.skills.hacking + B.p.skills.hacking) / 2 };
    const ohneShare = factionRepPerCycle("hacking", sk, A.p.mults, fa.favor, BN12_3, 1) * (A.p.focus ? 1 : 0.8);
    const real = (fb.rep - fa.rep) / cyc;
    console.log(`  ${f.padEnd(15)} ${cyc} Zyklen, hack ${A.p.skills.hacking}->${B.p.skills.hacking}, Favor ${F(fa.favor, 2)}: Formel ohne share ${F(ohneShare)} | real ${F(real)} je Zyklus -> share-Bonus implizit ${F(real / ohneShare, 3)}`);
  }

  console.log("\n=== BN2.1 Lage (Sicherung 03.10. 09:59): Rep je Stunde nach Arbeitsart ===");
  {
    const { p } = load("LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz");
    const sk = p.skills, m = p.mults;
    const FW = 0.5;                                    // BitNode.tsx:582 FactionWorkRepGain BN2
    console.log(`  Werte hack ${sk.hacking} str/def/dex/agi ${sk.strength}/${sk.defense}/${sk.dexterity}/${sk.agility} cha ${sk.charisma} int ${sk.intelligence}, faction_rep ${F(m.faction_rep)}, company_rep ${F(m.company_rep)}`);
    for (const t of ["hacking", "security", "field"]) {
      const r = factionRepPerCycle(t, sk, m, 0, FW, 1) * CPS * 3600;
      console.log(`  Faktionsarbeit ${t.padEnd(8)} Favor 0, fokussiert, share 1: ${F(r, 0).padStart(6)} rep/h`);
    }
    for (const [n, pos] of Object.entries(POS)) {
      const r = companyRepPerCycle(pos, sk, m, 0, 1) * CPS * 3600;
      console.log(`  Firmenarbeit ${n.padEnd(28)} Favor 0: ${F(r, 0).padStart(6)} rep/h (CompanyWorkRepGain BN2 = 1)`);
    }
    const it = companyRepPerCycle(POS["IT Intern"], sk, m, 0, 1) * CPS * 3600;
    console.log(`  -> 300.000 Firmenrep (400k x 0,75 Backdoor-Rabatt, Company/utils.ts:15-19) als IT Intern: ${F(300000 / it, 1)} h Spielerzeit`);
    // Wendepunkt hacking vs security: 0.2*(C+H+I) > H + I/3 (share 1)
    const C = sk.strength + sk.defense + sk.dexterity + sk.agility;
    console.log(`  Wendepunkt security > hacking bei Kampfsumme > 4*hack + 0,667*int = ${F(4 * sk.hacking + 0.6667 * sk.intelligence, 0)} (jetzt ${C})`);
  }

  console.log("\n=== BN2.1: Coding-Contract-Reputation je Faktion (gemessen, keine Arbeit, FactionPassiveRepGain 0) ===");
  {
    const files = fs.readdirSync(BACKUPS).filter((f) => /BN2L1/.test(f)).sort();
    const first = load(files[0]), last = load(files[files.length - 1]);
    const h = (last.p.playtimeSinceLastBitnode - first.p.playtimeSinceLastBitnode) / 3.6e6;
    let sum = 0;
    const namen = ["The Black Hand", "NiteSec", "Aevum", "Sector-12", "Netburners", "Tian Di Hui", "CyberSec", "Slum Snakes"];
    for (const n of namen) {
      const d = last.fac(n).rep - first.fac(n).rep;
      sum += d;
      console.log(`  ${n.padEnd(15)} +${F(d, 0).padStart(6)}`);
    }
    console.log(`  Summe ${F(sum, 0)} in ${F(h, 2)} h = ${F(sum / h, 0)} rep/h (ab erster Sicherung; vorher schon ${F(first.fac("NiteSec").rep + first.fac("Aevum").rep + first.fac("Sector-12").rep + first.fac("CyberSec").rep, 0)})`);
    const total = namen.reduce((s, n) => s + last.fac(n).rep, 0);
    console.log(`  Gesamtbestand Nicht-Bladeburner ${F(total, 0)} nach ${F(last.p.playtimeSinceLastBitnode / 3.6e6, 2)} h Knotenzeit = ${F(total / (last.p.playtimeSinceLastBitnode / 3.6e6), 0)} rep/h`);
  }
}
