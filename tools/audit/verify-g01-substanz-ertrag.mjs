// Gegenpruefung G01 (Substanz): Wo traegt Kompetenz ueberhaupt Rang?
//
// These: Gang-Kampfaugs heben die Kompetenz um einen festen Faktor k. Das hebt
// den Rang nur, solange die Aktionen auf ihrer hoechsten freigeschalteten Stufe
// eine Chance < 1 haben (Action.ts:195 min(1, comp/diff)). Ist p = 1, begrenzt die
// Stufenfreischaltung (Erfolge, LevelableAction setMaxLevel) und die Aktionszeit,
// nicht die Kompetenz.
//
// Teil A: je Spielstand (BN2.1, BN4.3, BN9.3) die unbegrenzte Chance comp/diff fuer
//   Assassination und Stealth Retirement auf Stufe 1 und auf der freigeschalteten
//   Hoechststufe, plus Typhoon (ohne Bevoelkerung/Chaos), bei voller Ausdauer.
// Teil B: Wachstumsrate g = d ln(comp)/dt der Kompetenz im kompetenzbegrenzten
//   Abschnitt; Zeitvorsprung durch den Faktor k = ln(k)/g.
//
// Aufruf: node tools/audit/verify-g01-substanz-ertrag.mjs
import fs from "node:fs";
import path from "node:path";
import { loadSave, ROOT } from "./verify-g01-substanz-save.mjs";
import { stateFromSave, OPERATIONS, BLACKOPS, successChance } from "./verify-g01-substanz-bb.mjs";

const runs = ["BN2L1", "BN4L3", "BN9L3"];
const rows = {};
for (const run of runs) {
  rows[run] = [];
  const dir = path.join(ROOT, "backups");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json.gz") && f.includes(run + "_")).sort();
  for (const f of files) {
    const { player: p } = loadSave(path.join(dir, f));
    const bbRaw = p.bladeburner;
    if (!bbRaw) continue;
    const st = stateFromSave(p);
    st.stamina = st.maxStamina; // Ausdauer voll: Kompetenz ohne Ausdauerstrafe
    const bb = st.bb;
    const h = p.playtimeSinceLastBitnode / 3.6e6;
    const eff = h - (bb.storedCycles || 0) / 5 / 3600;
    const asA = OPERATIONS["Assassination"], asS = OPERATIONS["Stealth Retirement Operation"];
    const lA = (bb.operations["Assassination"].data || bb.operations["Assassination"]).maxLevel;
    const lS = (bb.operations["Stealth Retirement Operation"].data || bb.operations["Stealth Retirement Operation"]).maxLevel;
    const cA1 = successChance(asA, 1, st), cAm = successChance(asA, lA, st), cSm = successChance(asS, lS, st);
    const ty = successChance(BLACKOPS["Operation Typhoon"], 1, st);
    rows[run].push({
      f: f.replace(/^LIVE_[0-9a-f]+_/, "").replace(".json.gz", ""), eff, rank: bb.rank,
      typhoonRaw: ty.comp / ty.diff, assa1Raw: cA1.comp / cA1.diff, assaMaxRaw: cAm.comp / cAm.diff, lA,
      stealthMaxRaw: cSm.comp / cSm.diff, lS, city: bb.city,
    });
  }
}

for (const run of runs) {
  console.log(`\n=== ${run} === eff_h | Rang | Typhoon comp/diff | Assa L1 comp/diff | Assa Lmax (L) comp/diff | Stealth Lmax (L) comp/diff | Stadt`);
  let last = -1;
  for (const r of rows[run]) {
    if (r.eff - last < 0.9 && r !== rows[run][rows[run].length - 1]) continue; // ausduennen
    last = r.eff;
    console.log(`${r.eff.toFixed(1).padStart(5)} | ${Math.round(r.rank).toString().padStart(7)} | ${r.typhoonRaw.toFixed(3).padStart(7)} | ${r.assa1Raw.toFixed(3).padStart(7)} | ${r.assaMaxRaw.toFixed(3).padStart(7)} (L${r.lA}) | ${r.stealthMaxRaw.toFixed(3).padStart(7)} (L${r.lS}) | ${r.city}`);
  }
}

// Teil B: Wachstumsrate der Typhoon-Kompetenz (stadtunabhaengig) zwischen zwei Zeitpunkten
function growth(run, t0, t1) {
  const pick = (t) => rows[run].reduce((b, r) => (Math.abs(r.eff - t) < Math.abs(b.eff - t) ? r : b));
  const a = pick(t0), b = pick(t1);
  return { a, b, g: Math.log(b.typhoonRaw / a.typhoonRaw) / (b.eff - a.eff) };
}
console.log("\n=== Teil B: Wachstum ln(Typhoon-Kompetenz) je effektive Stunde ===");
const spans = [["BN4L3", 9, 21], ["BN4L3", 14, 21], ["BN9L3", 9, 41], ["BN9L3", 27, 41], ["BN2L1", 5, 16.6], ["BN2L1", 8, 16.6]];
for (const [run, t0, t1] of spans) {
  const { a, b, g } = growth(run, t0, t1);
  const dt = (k) => Math.log(k) / g;
  console.log(`${run} ${a.eff.toFixed(1)}h -> ${b.eff.toFixed(1)}h: Typhoon ${a.typhoonRaw.toFixed(3)} -> ${b.typhoonRaw.toFixed(3)}, g = ${g.toFixed(3)}/h`
    + ` | Vorsprung fuer k=2,0: ${dt(2.0).toFixed(1)} h, k=2,85: ${dt(2.85).toFixed(1)} h, k=3,8: ${dt(3.8).toFixed(1)} h`);
}

// Teil C: statischer Rang/h-Faktor im heutigen Zustand (BN2.1 22:17), heutige Hoechststufen,
// Erwartungswert je Sekunde mit Rangverlust, Ausdauer voll. Faktorsaetze aus der Rundenrechnung
// (verify-g01-substanz-round.mjs, Rep 1,25 Mio, q0 = 0).
import { CONTRACTS, actionTime } from "./verify-g01-substanz-bb.mjs";
import { calcSkill } from "./verify-g01-substanz-bb.mjs";
import { findBackup } from "./verify-g01-substanz-save.mjs";
{
  const { player: p } = loadSave(findBackup("BN2L1_2026-10-03T22-17"));
  const st0 = stateFromSave(p); st0.stamina = st0.maxStamina;
  const sets = [["heute", { strength: 1, defense: 1, dexterity: 1, agility: 1 }],
    ["Runde 20 Mrd", { strength: 3.96, defense: 4.26, dexterity: 2.83, agility: 5.11 }],
    ["Runde 50 Mrd", { strength: 6.53, defense: 2.72, dexterity: 10.19, agility: 2.85 }]];
  const acts = { ...CONTRACTS, ...OPERATIONS };
  console.log("\n=== Teil C: statische Rang/h (heutige Hoechststufen, mit Rangverlust) BN2.1 22:17 ===");
  let base = null;
  for (const [lab, f] of sets) {
    const st = { ...st0, skills: { ...p.skills } };
    for (const s of ["strength", "defense", "dexterity", "agility"]) st.skills[s] = calcSkill(p.exp[s], p.mults[s] * f[s]);
    const out = [];
    for (const [n, a] of Object.entries(acts)) {
      const raw = (st.bb.contracts[n] || st.bb.operations[n]); const d = raw.data || raw;
      const L = d.maxLevel;
      const pp = successChance(a, L, st).p, t = actionTime(a, L, st);
      const gain = a.rankGain * Math.pow(a.rewardFac, L - 1), loss = (a.rankLoss || 0) * Math.pow(a.rewardFac, L - 1);
      out.push({ n, L, pp, rh: 3600 * (pp * gain - (1 - pp) * loss) / t });
    }
    out.sort((x, y) => y.rh - x.rh);
    const noRaid = out.filter((o) => o.n !== "Raid");
    if (!base) base = { all: out[0].rh, nr: noRaid[0].rh };
    console.log(`${lab.padEnd(14)} beste: ${out[0].n} L${out[0].L} p=${out[0].pp.toFixed(2)} ${out[0].rh.toFixed(0)} Rang/h (x${(out[0].rh / base.all).toFixed(2)})`
      + ` | ohne Raid: ${noRaid[0].n} L${noRaid[0].L} p=${noRaid[0].pp.toFixed(2)} ${noRaid[0].rh.toFixed(0)} Rang/h (x${(noRaid[0].rh / base.nr).toFixed(2)})`);
  }
}
