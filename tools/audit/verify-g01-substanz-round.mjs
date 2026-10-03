// Gegenpruefung G01 (Substanz): Einbaurunde aus dem Gang-Angebot, eigene Rechnung.
//
// Preis: base * 1.9^q * AugmentationMoneyCost (AugmentationHelpers.ts:29-37, :155-158),
// q = Zahl der schon gekauften (wartenden) Stuecke. Reihenfolge innerhalb einer Menge:
// teuerstes verfuegbares zuerst, Voraussetzung vor dem abhaengigen Stueck.
// Auswahl: Strahlsuche (Breite W) ueber Mengen, Ziel = Black-Op-Kompetenz (Typhoon/
// Daedalus-Gewichte: Kampf je 0.2, Zerfall 0.8) bei GLEICHER Erfahrung wie im Spielstand.
// Stufe = floor(mult * (32 ln(exp+534.6) - 200)) ist linear im Mult -> Faktor je Wert.
//
// Aufruf: node tools/audit/verify-g01-substanz-round.mjs [Spielstand-Teilstring]
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAugs, isCombatAug } from "./verify-g01-substanz-augs.mjs";
import { loadSave, findBackup } from "./verify-g01-substanz-save.mjs";
import { BLACKOPS, OPERATIONS, CONTRACTS, successChance, stateFromSave, calcSkill, actionTime } from "./verify-g01-substanz-bb.mjs";

const COMBAT = ["strength", "defense", "dexterity", "agility"];

export function offerFor(owned, maxRep) {
  const { list } = loadAugs();
  const offer = list.filter((a) => !a.isSpecial && a.name !== "Congruity Implant");
  return offer.filter((a) => isCombatAug(a) && !owned.has(a.name) && a.repCost <= maxRep && a.moneyCost < 1e12);
}

// Kosten einer Menge mit gueltiger Reihenfolge
export function setCost(names, byName, q0, owned) {
  const left = new Set(names);
  const have = new Set(owned);
  let k = q0, cost = 0;
  const order = [];
  while (left.size) {
    let best = null;
    for (const n of left) {
      const a = byName[n];
      if ((a.prereqs || []).some((p) => !have.has(p))) continue;
      if (!best || a.moneyCost > byName[best].moneyCost) best = n;
    }
    if (!best) return { cost: Infinity, order };
    cost += byName[best].moneyCost * Math.pow(1.9, k);
    k++;
    have.add(best); left.delete(best); order.push(best);
  }
  return { cost, order };
}

function closure(n, byName, owned, acc = new Set()) {
  for (const p of byName[n].prereqs || []) if (!owned.has(p) && !acc.has(p)) { if (!byName[p]) return null; closure(p, byName, owned, acc); acc.add(p); }
  acc.add(n);
  return acc;
}

export function statFactors(names, byName) {
  const f = { strength: 1, defense: 1, dexterity: 1, agility: 1 };
  for (const n of names) for (const s of COMBAT) f[s] *= byName[n][s] || 1;
  return f;
}

// Stufen bei gleicher Erfahrung mit neuen Mults
export function skillsWith(p, f, extraMult = {}) {
  const sk = { ...p.skills };
  for (const s of COMBAT) sk[s] = calcSkill(p.exp[s], p.mults[s] * f[s] * (extraMult[s] ?? 1));
  return sk;
}

export function bestRound({ p, st, budget, q0 = 0, maxRep = 1.25e6, owned, W = 300, objective }) {
  const offer = offerFor(owned, maxRep);
  const byName = Object.fromEntries(offer.map((a) => [a.name, a]));
  const obj = objective || ((names) => {
    const f = statFactors(names, byName);
    const st2 = { ...st, skills: skillsWith(p, f) };
    return successChance(BLACKOPS["Operation Daedalus"], 1, st2).comp;
  });
  let beam = [{ names: [], cost: 0, val: obj([]) }];
  let bestState = beam[0];
  for (let it = 0; it < 40; it++) {
    const next = new Map();
    for (const s of beam) {
      for (const a of offer) {
        if (s.names.includes(a.name)) continue;
        const cl = closure(a.name, byName, owned, new Set(s.names));
        if (!cl) continue;
        const names = [...cl].sort();
        const key = names.join("|");
        if (next.has(key)) continue;
        const { cost } = setCost(names, byName, q0, owned);
        if (cost > budget) continue;
        next.set(key, { names, cost, val: obj(names) });
      }
    }
    if (!next.size) break;
    beam = [...next.values()].sort((x, y) => y.val - x.val).slice(0, W);
    if (beam[0].val > bestState.val) bestState = beam[0];
  }
  const { order } = setCost(bestState.names, byName, q0, owned);
  return { ...bestState, order, f: statFactors(bestState.names, byName), base: obj([]) };
}

function main() {
  const part = process.argv[2] || "BN2L1_2026-10-03T21-17";
  const file = findBackup(part);
  const { player: p } = loadSave(file);
  const st = stateFromSave(p);
  const owned = new Set((p.augmentations || []).map((a) => a.name).concat((p.queuedAugmentations || []).map((a) => a.name)));
  console.log("Spielstand", path.basename(file), "| Kampf-Mults", COMBAT.map((s) => p.mults[s].toFixed(3)).join("/"),
    "| Stufen", COMBAT.map((s) => p.skills[s]).join("/"));
  const typh0 = successChance(BLACKOPS["Operation Typhoon"], 1, st).p;
  console.log(`Typhoon-Chance heute (Modell, geeicht): ${typh0.toFixed(4)}`);
  for (const maxRep of [1.5e5, 4.375e5, 7.5e5, 1.25e6]) {
    for (const q0 of [0, 4]) {
      for (const budget of [5e9, 10e9, 20e9, 50e9, 100e9]) {
        const r = bestRound({ p, st, budget, q0, maxRep, owned });
        const sk = skillsWith(p, r.f);
        const st2 = { ...st, skills: sk };
        const typh = successChance(BLACKOPS["Operation Typhoon"], 1, st2).p;
        const assaComp = successChance(OPERATIONS["Assassination"], 1, st2).comp / successChance(OPERATIONS["Assassination"], 1, st).comp;
        console.log(`Rep<=${(maxRep / 1e3).toFixed(0)}k q0=${q0} Budget ${(budget / 1e9).toFixed(0)} Mrd: ${r.names.length} Augs, `
          + `Kosten ${(r.cost / 1e9).toFixed(2)} | Faktor str/def/dex/agi ${COMBAT.map((s) => r.f[s].toFixed(2)).join("/")}`
          + ` | BO-Kompetenz x${(r.val / r.base).toFixed(2)} | Assassination-Kompetenz x${assaComp.toFixed(2)} | Typhoon ${typh0.toFixed(3)} -> ${typh.toFixed(3)}`);
        if (budget === 20e9 && q0 === 0 && maxRep === 1.25e6) console.log("    Reihenfolge:", r.order.join(" > "));
      }
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) && !process.argv.includes("--politik")) main();

// Teil 2: Was kauft der HEUTIGE Bot (bn4rep.js:1736-1745: jede Runde alles Verdiente und
// Bezahlbare, absteigend nach Preis) aus dem Gang-Angebot, wenn der Ruf nach der Gang-Simulation
// steigt? Geld: Start 2,4 Mrd bei Gruendung (BN2.1 06:33), netto +3,5 Mrd/h. Vergleich mit der
// geplanten Runde (q0 = 0, teuerste zuerst) zum selben Zeitpunkt.
export async function currentPolicy() {
  const { simulate } = await import("./verify-g01-substanz-gangsim.mjs");
  const file = findBackup("BN2L1_2026-10-03T22-17");
  const { player: p } = loadSave(file);
  const st = stateFromSave(p);
  const owned = new Set((p.augmentations || []).map((a) => a.name));
  const offer = offerFor(owned, 2.5e6);
  const byName = Object.fromEntries(offer.map((a) => [a.name, a]));
  const g = simulate({ hours: 12, trainTarget: 700, earlyTarget: 200, ascTrain: 1.2, ascWork: 1.5,
    marks: Array.from({ length: 121 }, (_, i) => i * 25000) });
  // Ruf zur Zeit t (Stunden nach Gruendung) aus den Marken interpolieren
  const marks = Object.entries(g.hitAt).map(([r, h]) => [h, Number(r)]).sort((a, b) => a[0] - b[0]);
  const repAt = (t) => { let r = 0; for (const [h, rr] of marks) if (h <= t) r = rr; return r; };
  for (const net of [3.5, 6]) {
    let money = 2.4e9, q = 0; const bought = [];
    for (let t = 0; t <= 10.5; t += 0.05) {
      money += net * 1e9 * 0.05;
      const rep = repAt(t);
      const cand = offer.filter((a) => !bought.includes(a.name) && a.repCost <= rep
        && (a.prereqs || []).every((x) => owned.has(x) || bought.includes(x))).sort((x, y) => y.moneyCost - x.moneyCost);
      for (const a of cand) {
        const price = a.moneyCost * Math.pow(1.9, q);
        if (price <= money) { money -= price; q++; bought.push(a.name); }
      }
    }
    const f = statFactors(bought, byName);
    const st2 = { ...st, skills: skillsWith(p, f) };
    const k = successChance(BLACKOPS["Operation Daedalus"], 1, st2).comp / successChance(BLACKOPS["Operation Daedalus"], 1, st).comp;
    console.log(`HEUTIGER BOT (netto ${net} Mrd/h), 10,5 h nach Gruendung: ${bought.length} Stueck, q=${q}, Faktoren ${COMBAT.map((s) => f[s].toFixed(2)).join("/")}, BO-Kompetenz x${k.toFixed(2)}, Rest ${(money / 1e9).toFixed(1)} Mrd`);
    console.log("   Kauffolge:", bought.join(", "));
    const budget = 2.4e9 + net * 1e9 * 10.5;
    const r = bestRound({ p, st, budget, q0: 0, maxRep: repAt(10.5), owned });
    console.log(`GEPLANTE RUNDE (q0 = 0, gleiches Geld ${(budget / 1e9).toFixed(1)} Mrd, Ruf ${(repAt(10.5) / 1e6).toFixed(2)} Mio): ${r.names.length} Stueck, BO-Kompetenz x${(r.val / r.base).toFixed(2)}`);
  }
}
if (process.argv.includes("--politik")) currentPolicy();
