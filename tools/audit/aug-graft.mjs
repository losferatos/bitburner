// Audit 03.10.2026, Bereich AUG: Wert jedes Grafts im Kampfknoten (V2),
// MIT Entropie, gegen den laufenden Spielstand.
//
// Formeln (reference/bitburner-src/src):
//   Preis  = baseCost * 3                     PersonObjects/Grafting/GraftableAugmentation.ts:20-22, Constants.ts:96
//   Zeit   = (1 h * log2(max(Summe(mults != 1), 1)) + 30 min) / 2
//                                             GraftableAugmentation.ts:24-30
//            / (1 + Int^0,8/600)              GraftingHelpers.ts:23-30, formulas/intelligence.ts
//            / focusPenalty (1 fokussiert, 0,8 ohne, NMI 1)  GraftingWork.tsx:40-46, PlayerObjectGeneralMethods.ts:622-628
//   Wirkung: sofort applyAugmentation, KEIN Reset   GraftingWork.tsx:48-64
//   Entropie +1: alle Mults * 0,98 (auch bladeburner_*)  EntropyAccumulation.ts:6-47
//   Skill  = floor(mult * BNLevelMult * (32 ln(exp+534,6) - 200))  formulas/skill.ts, Person.ts:213-226
//   competence = Summe w_s * L_s^d_s * ... * bladeburner_success_chance  Bladeburner/Actions/Action.ts:169-196
//     Gewichte/Abklingen Black Op Typhoon/Daedalus (data/BlackOperations.ts:7-31, :712-728)
//
// Eichung:
//   - Mults-Modell (aug-mults.mjs) gegen 6 Spielstaende: 0 Abweichung ausser
//     charisma/dnet_money (Versionsunterschied, fuer V2 ohne Belang).
//   - Graft-Zeit gegen Telemetrie BN10 30./31.08.: Simulacrum 845.690 ms und
//     Graphene Bionic Legs 51,3 min ergeben BEIDE Int-Bonus 1,064 (Int ~96).
//
// Aufruf: node tools/audit/aug-graft.mjs [save.json.gz] [--k 1.2] [--rate 330]
import { loadSave } from "./aug-save.mjs";
import { loadAugs } from "./aug-data.mjs";
import { computeMults } from "./aug-mults.mjs";
import fs from "node:fs";

const W = { hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2 };
const D = { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8 };
const BN_LEVEL = {
  2: { hacking: 0.8 }, 3: { hacking: 0.8 }, 6: { hacking: 0.35 }, 7: { hacking: 0.35 },
  9: { hacking: 0.5, strength: 0.45, defense: 0.45, dexterity: 0.45, agility: 0.45 },
  10: { hacking: 0.35, strength: 0.4, defense: 0.4, dexterity: 0.4, agility: 0.4 },
  11: { hacking: 0.6 }, 13: { hacking: 0.25, strength: 0.7, defense: 0.7, dexterity: 0.7, agility: 0.7 },
  14: { hacking: 0.4, strength: 0.5, defense: 0.5, dexterity: 0.5, agility: 0.5 },
  15: { hacking: 0.6, strength: 0.7, defense: 0.7, dexterity: 0.7, agility: 0.7 },
};

export function skill(exp, mult) {
  return Math.max(1, Math.floor(mult * (32 * Math.log(exp + 534.6) - 200)));
}

export function graftTimeH(aug, intel, focus = 1) {
  const vals = Object.values(aug.mults).filter((x) => x !== 1);
  const s = Math.max(vals.reduce((a, b) => a + b, 0), 1);
  const base = (Math.log2(s) + 0.5) / 2;
  return base / (1 + Math.pow(intel, 0.8) / 600) / focus;
}

/** competence (ohne Int-, Ausdauer-, Faehigkeits-Faktoren, die bei allen Varianten gleich sind) */
export function competence(exp, mults, bn, intel) {
  const lm = BN_LEVEL[bn] || {};
  let c = 0;
  for (const s of Object.keys(W)) c += W[s] * Math.pow(skill(exp[s], mults[s] * (lm[s] ?? 1)), D[s]);
  c += 0.1 * Math.pow(intel, 0.75); // Int-Term, konstant
  return c * mults.bladeburner_success_chance;
}

function applyGraft(p, augName) {
  const q = JSON.parse(JSON.stringify(p));
  q.augmentations.push({ name: augName, level: 1 });
  q.entropy = (q.entropy || 0) + 1;
  return q;
}

if (process.argv[1] && process.argv[1].endsWith("aug-graft.mjs")) {
  const args = process.argv.slice(2);
  const f = args.find((a) => a.endsWith(".gz")) || "backups/LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz";
  const k = Number(args[args.indexOf("--k") + 1]) || 1.2;
  const rate = Number(args[args.indexOf("--rate") + 1]) || 330;
  const augs = loadAugs();
  const { p } = loadSave(f);
  const intel = p.skills.intelligence;
  // Eichung Graft-Zeit
  const simT = graftTimeH(augs["The Blade's Simulacrum"], 96) * 3.6e6;
  const legT = graftTimeH(augs["Graphene Bionic Legs Upgrade"], 96) * 60;
  console.log(`EICHUNG Graft-Zeit (Int 96): Simulacrum ${simT.toFixed(0)} ms (Telemetrie 845690), Graphene Legs ${legT.toFixed(2)} min (Telemetrie 51,3)`);
  const m0 = computeMults(p, augs);
  const devS = m0.strength / p.mults.strength - 1;
  console.log(`EICHUNG Mults im Stand: strength ${m0.strength.toFixed(6)} vs ${p.mults.strength.toFixed(6)} (${devS.toExponential(1)})`);
  const c0 = competence(p.exp, m0, p.bitNodeN, intel);
  console.log(`Stand ${f.split(/[\\/]/).pop()}: BN${p.bitNodeN}, Int ${intel}, Entropie ${p.entropy}, competence-Index ${c0.toFixed(2)}`);
  console.log(`Umrechnung competence -> Rang/h mit Exponent k=${k} (GESCHAETZT, Aktionsstufen-Oekonomie), Rangrate ${rate}/h`);

  const plan = JSON.parse(fs.readFileSync("src/graftplan.json", "utf8")).reihenfolge;
  // 1) Einzelwert jedes Plan-Eintrags auf dem JETZIGEN Stand (ein Graft)
  console.log("\n-- Einzelwert je Graft (ein Stueck, auf dem heutigen Stand) --");
  const einzel = [];
  for (const n of plan) {
    const a = augs[n];
    if (!a) continue;
    const prereqOk = a.prereqs.every((x) => p.augmentations.some((y) => y.name === x));
    const q = applyGraft(p, n);
    const c1 = competence(q.exp, computeMults(q, augs), q.bitNodeN, intel);
    const t = graftTimeH(a, intel, 1);
    const fac = c1 / c0;
    const gainPerH = rate * (Math.pow(fac, k) - 1);
    const payback = gainPerH > 0 ? (t * rate) / gainPerH : Infinity;
    einzel.push({ n, fac, t, cost: a.moneyCost * 3, payback, prereqOk });
  }
  for (const e of einzel.sort((a, b) => b.fac - a.fac)) {
    console.log(`${e.n.padEnd(50)} x${e.fac.toFixed(4)}  ${e.t.toFixed(2)} h  ${(e.cost / 1e9).toFixed(2).padStart(7)} Mrd  Amortisation ${Number.isFinite(e.payback) ? e.payback.toFixed(1) + " h" : "NIE (Nettoverlust)"}${e.prereqOk ? "" : "  [Vorbedingung fehlt]"}`);
  }
  // 2) Plan der Reihe nach, kumulativ mit Entropie
  console.log("\n-- graftplan.json der Reihe nach, kumulativ --");
  let cur = p, cPrev = c0, tSum = 0, costSum = 0, neg = 0;
  for (const n of plan) {
    const a = augs[n];
    const q = applyGraft(cur, n);
    const c1 = competence(q.exp, computeMults(q, augs), q.bitNodeN, intel);
    const t = graftTimeH(a, intel, 1);
    tSum += t; costSum += a.moneyCost * 3;
    const mfac = c1 / cPrev;
    if (mfac < 1) neg++;
    console.log(`${n.padEnd(50)} Grenzfaktor x${mfac.toFixed(4)}  kumuliert x${(c1 / c0).toFixed(3)}  Zeit ${tSum.toFixed(1)} h  Geld ${(costSum / 1e9).toFixed(1)} Mrd${mfac < 1 ? "  <- NETTOVERLUST" : ""}`);
    cur = q; cPrev = c1;
  }
  console.log(`Plan: ${plan.length} Grafts, ${neg} mit Nettoverlust, Gesamtzeit ${tSum.toFixed(1)} h (fokussiert), Geld ${(costSum / 1e9).toFixed(1)} Mrd`);
  const mEnd = computeMults(cur, augs);
  console.log(`Endstand: Entropie ${cur.entropy} -> Faktor ${Math.pow(0.98, cur.entropy).toFixed(3)}; bladeburner_success_chance ${mEnd.bladeburner_success_chance.toFixed(3)} (vorher ${m0.bladeburner_success_chance.toFixed(3)}), stamina_gain ${mEnd.bladeburner_stamina_gain.toFixed(3)}, max_stamina ${mEnd.bladeburner_max_stamina.toFixed(3)}`);
  // 3) Gierig nach Grenzfaktor je Stunde, Abbruch bei Grenzfaktor < 1
  console.log("\n-- Gierig: je Schritt das Stueck mit dem groessten (Faktor^k-1)/Zeit, Stopp bei Nettoverlust --");
  const pool = new Set(Object.values(augs).filter((a) => !a.isSpecial || a.factions.includes("Bladeburners")).map((a) => a.name));
  pool.delete("NeuroFlux Governor"); pool.delete("The Red Pill"); pool.delete("violet Congruity Implant");
  for (const x of p.augmentations) pool.delete(x.name);
  cur = p; cPrev = c0; tSum = 0; costSum = 0;
  for (let step = 0; step < 60; step++) {
    let best = null;
    for (const n of pool) {
      const a = augs[n];
      if (!a.prereqs.every((x) => cur.augmentations.some((y) => y.name === x))) continue;
      const q = applyGraft(cur, n);
      const c1 = competence(q.exp, computeMults(q, augs), q.bitNodeN, intel);
      const t = graftTimeH(a, intel, 1);
      const score = (Math.pow(c1 / cPrev, k) - 1) / t;
      if (!best || score > best.score) best = { n, q, c1, t, score };
    }
    if (!best || best.c1 <= cPrev) break;
    tSum += best.t; costSum += augs[best.n].moneyCost * 3;
    console.log(`${String(step + 1).padStart(2)} ${best.n.padEnd(50)} x${(best.c1 / cPrev).toFixed(4)}  kumuliert x${(best.c1 / c0).toFixed(3)}  ${tSum.toFixed(1)} h  ${(costSum / 1e9).toFixed(1)} Mrd`);
    pool.delete(best.n); cur = best.q; cPrev = best.c1;
  }
}
