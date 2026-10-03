// Einbaurunde mit Gang-Faktion (BN2): welche Kampf-Augs passen in ein Budget,
// und wie stark steigt die Black-Op-Competence?
//
// Preis: AugmentationHelpers.ts:155-158 (Standard): baseCost * 1.9^q *
//   AugmentationMoneyCost, q = Zahl der wartenden Nicht-SoA-Augs (:32-37),
//   1.9 = CONSTANTS.MultipleAugMultiplier (Constants.ts:41), SF11 = 0.
// Rep: baseRep * AugmentationRepCost (BN2: 1).
// Competence: Actions/Action.ts:169-195, Gewichte/Decays Operation Daedalus
//   (tools/lib/formeln.js DAEDALUS_GEWICHTE/DECAYS, BlackOperations.ts).
//   Stufe ~ mult (GangMember/Person calculateSkill: floor(mult*f(exp))), also
//   neue Stufe = alte Stufe * Zusatzmult bei gleicher Erfahrung.
//
// Aufruf: node tools/audit/gang-round.mjs [Spielstand.json.gz]
import path from "node:path";
import { parseAugs, gangOffer } from "./gang-augs.mjs";
import { readSave } from "./gang-save.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const saveFile = process.argv[2] || path.join(ROOT, "backups", "LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz");
const { p } = readSave(saveFile);
const L = { hacking: p.skills.hacking, strength: p.skills.strength, defense: p.skills.defense,
  dexterity: p.skills.dexterity, agility: p.skills.agility, intelligence: p.skills.intelligence };
const W = { hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2, intelligence: 0.1 };
const D = { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 };
const COMBAT = ["strength", "defense", "dexterity", "agility"];

function competence(extra) {
  let c = 0;
  for (const s of Object.keys(W)) c += W[s] * Math.pow(L[s] * (extra[s] || 1), D[s]);
  return c;
}
const C0 = competence({});

const augs = parseAugs();
const byName = Object.fromEntries(augs.map((a) => [a.name, a]));
const owned = new Set([...(p.augmentations || []), ...(p.queuedAugmentations || [])].map((a) => a.name));
const offer = gangOffer(augs, 2, 1).filter((a) => !owned.has(a.name)
  && COMBAT.some((s) => (a[s] || 1) > 1));

function orderAndCost(set, q0, moneyMult = 1) {
  // absteigend nach Preis, Voraussetzung direkt vor ihrem Nachfolger
  const names = [...set];
  const sorted = names.filter((n) => !names.some((m) => byName[m].prereqs.includes(n)))
    .sort((a, b) => byName[b].moneyCost - byName[a].moneyCost);
  const seq = [];
  const add = (n) => { if (seq.includes(n)) return; for (const pr of byName[n].prereqs) if (set.has(pr)) add(pr); seq.push(n); };
  for (const n of sorted) add(n);
  for (const n of names) add(n);
  let cost = 0;
  seq.forEach((n, i) => { cost += byName[n].moneyCost * Math.pow(1.9, q0 + i) * moneyMult; });
  return { seq, cost };
}
function extraOf(set) {
  const e = {};
  for (const n of set) for (const s of COMBAT) e[s] = (e[s] || 1) * (byName[n][s] || 1);
  return e;
}
function closure(n) {
  const out = new Set([n]);
  for (const pr of byName[n].prereqs) if (!owned.has(pr)) for (const x of closure(pr)) out.add(x);
  return out;
}
// cfg.offerNames: erlaubte Augs (z. B. exactGangOffer eines spaeteren Knotens),
// cfg.moneyMult: AugmentationMoneyCost des Knotens, cfg.owned: Besitz
export function bestRound(budget, q0, repCap = Infinity, cfg = {}) {
  const mm = cfg.moneyMult ?? 1;
  const own = cfg.owned ?? owned;
  const allowed = cfg.offerNames ? new Set(cfg.offerNames) : null;
  const cand = (cfg.offerNames ? augs.filter((a) => allowed.has(a.name) && COMBAT.some((s) => (a[s] || 1) > 1)) : offer)
    .filter((a) => !own.has(a.name));
  const clos = (n) => { const out = new Set([n]); for (const pr of byName[n].prereqs) if (!own.has(pr)) for (const x of clos(pr)) out.add(x); return out; };
  let set = new Set();
  for (;;) {
    let best = null;
    const curC = competence(extraOf(set));
    const curCost = orderAndCost(set, q0, mm).cost;
    for (const a of cand) {
      if (set.has(a.name)) continue;
      const add = clos(a.name);
      if ([...add].some((n) => byName[n].repCost > repCap)) continue;
      if (allowed && [...add].some((n) => !allowed.has(n))) continue;
      const ns = new Set([...set, ...add]);
      const { cost } = orderAndCost(ns, q0, mm);
      if (cost > budget) continue;
      const gain = Math.log(competence(extraOf(ns)) / curC);
      const val = gain / Math.max(1, cost - curCost);
      if (gain > 0 && (!best || val > best.val)) best = { ns, val };
    }
    if (!best) break;
    set = best.ns;
  }
  const { seq, cost } = orderAndCost(set, q0, mm);
  const ex = extraOf(set);
  return { seq, cost, ex, comp: competence(ex) / C0, maxRep: Math.max(0, ...seq.map((n) => byName[n].repCost)) };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/audit/gang-round.mjs");
if (isMain) {
  console.log("Spielstand:", path.basename(saveFile), "Stufen", JSON.stringify(L));
  console.log("besessen/wartend:", owned.size, "wartend (q):", (p.queuedAugmentations || []).length);
  console.log("Kandidaten (Gang-Faktion BN2, Kampf, nicht besessen):", offer.length);
  for (const q0 of [0, (p.queuedAugmentations || []).length]) {
    console.log(`\n--- Runde mit q0 = ${q0} bereits wartenden Augs (Preisfaktor 1,9^${q0} = ${Math.pow(1.9, q0).toFixed(2)}) ---`);
    for (const B of [20e9, 50e9, 100e9, 200e9, 500e9, 1000e9]) {
      const r = bestRound(B, q0);
      console.log(`Budget ${(B / 1e9).toFixed(0).padStart(5)} Mrd: ${String(r.seq.length).padStart(2)} Augs, Kosten ${(r.cost / 1e9).toFixed(1).padStart(6)} Mrd,`
        + ` max Rep ${(r.maxRep / 1e3).toFixed(0).padStart(5)}k, Kampf x str ${r.ex.strength?.toFixed(2) ?? "1.00"} def ${r.ex.defense?.toFixed(2) ?? "1.00"}`
        + ` dex ${r.ex.dexterity?.toFixed(2) ?? "1.00"} agi ${r.ex.agility?.toFixed(2) ?? "1.00"} -> Black-Op-Competence x${r.comp.toFixed(2)}`);
      if (B === 100e9 || B === 500e9) console.log("    ", r.seq.join(" > "));
    }
  }
  // Vergleich: was ist OHNE Gang aus den heute beigetretenen Faktionen kaeuflich (Rep-Stand dieses Spielstands)?
  console.log("\n--- Ohne Gang: Kampf-Augs der beigetretenen Faktionen mit heutigem Rep-Stand ---");
  const facs = readSave(saveFile).factions;
  const rep = {};
  for (const [k, v] of Object.entries(facs)) rep[k] = (v.data || v).playerReputation || 0;
  const reach = augs.filter((a) => !owned.has(a.name) && !a.isSpecial && COMBAT.some((s) => (a[s] || 1) > 1)
    && a.factions.some((f) => p.factions.includes(f) && rep[f] >= a.repCost));
  const ex0 = extraOf(new Set(reach.map((a) => a.name)));
  console.log(reach.map((a) => a.name).join(", ") || "(keine)");
  console.log(`Alle zusammen: str x${(ex0.strength || 1).toFixed(2)} def x${(ex0.defense || 1).toFixed(2)} dex x${(ex0.dexterity || 1).toFixed(2)} agi x${(ex0.agility || 1).toFixed(2)}`
    + ` -> Competence x${(competence(ex0) / C0).toFixed(2)}`);
}
