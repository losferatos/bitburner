// Audit 03.10.2026, Bereich NETZ: Was bringt Infiltration im V2-Weg (BN2)?
//
// Baut auf netz-calc.mjs (Infiltrationsformeln aus Infiltration/formulas/*.ts) und
// fakt-augs.mjs (Aug-Katalog aus Augmentation/Augmentations.ts, V2-Mass v2Value)
// auf. Nur lesen, nichts schreiben.
//
// Teil 1  Ertrag je Lauf und je Stunde am besten machbaren Ort, Stand-Skills.
//         Victory.tsx:71-83: sell -> Player.gainMoney (InfiltrationMoney),
//         trade -> Factions[f].playerReputation += rep (KEIN faction_rep-Mult,
//         KEIN FactionWorkRepGain - wichtig fuer BN2 mit FWRG 0,5).
// Teil 2  Naechster 12-h-Einbauzyklus: gierige Aug-Wahl nach Wert je Dollar mit
//         Preistreppe x1,9 (AugmentationHelpers.ts:29-37), Ruf aus Infiltration
//         (Zeitkosten) statt nur aus Vertraegen, Rest der Infiltrationszeit -> Geld.
//         Referenz: fakt-v2.mjs "Ist" (35 Mrd, Vertragsruf 4.932/h) = ln 0,232.
// Teil 3  Rangwirkung: tools/bbrank/sim.mjs mit Kampfwerten x f (wie fakt-rang.mjs),
//         um die Elastizitaet auch fuer grosse Faktoren zu pruefen.
//
// Aufruf: node tools/audit/netz-infil.mjs [muster]   (Default: BN2L1 09:59)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSave, pickFile } from "./netz-save.mjs";
import { parseLocations, infilDifficulty, infilReward, sellCash, tradeRep, runSeconds, bestPeriod } from "./netz-calc.mjs";
import { loadAugs, v2Value } from "./fakt-augs.mjs";
import { simulate as bbSim } from "../bbrank/sim.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = path.join(root, "reference", "bitburner-src", "src");

const file = pickFile(process.argv[2] || "BN2L1_2026-10-03T09-59");
const { save, player: p } = loadSave(file);
const BN2 = { InfiltrationMoney: 3, InfiltrationRep: 1 };

// offersWork je Faktion (FactionInfo.tsx:110-112) - nur diese stehen im Victory-Dropdown (Victory.tsx:118-119)
const info = fs.readFileSync(path.join(SRC, "Faction", "FactionInfo.tsx"), "utf8");
const facEnumTxt = fs.readFileSync(path.join(SRC, "Faction", "Enums.ts"), "utf8");
const facEnum = {};
for (const m of facEnumTxt.matchAll(/(\w+)\s*=\s*"([^"]+)"/g)) facEnum[m[1]] = m[2];
const offersWork = {};
for (const m of info.matchAll(/\[FactionName\.(\w+)\]:\s*new FactionInfo\(\{([\s\S]*?)\n  \}\),/g)) {
  offersWork[facEnum[m[1]]] = /offer(Hacking|Field|Security)Work:\s*true/.test(m[2]);
}

const fmt = (x, d = 2) => {
  const a = Math.abs(x);
  if (a >= 1e9) return (x / 1e9).toFixed(d) + " Mrd";
  if (a >= 1e6) return (x / 1e6).toFixed(d) + " Mio";
  if (a >= 1e3) return (x / 1e3).toFixed(d) + " k";
  return x.toFixed(d);
};

// ---------------------------------------------------------------- Teil 1
console.log("Stand:", path.basename(file), " Skills", JSON.stringify(p.skills), " Stadt", p.city);
const S = p.skills.strength + p.skills.defense + p.skills.dexterity + p.skills.agility + p.skills.charisma;
const locs = parseLocations();
// SoA-Ruf (victory.ts:122-143): maxStartingSecurityLevel ueber alle Orte
const maxSec = Math.max(...locs.map((l) => l.sec));
const soaRep = (L, sec, demand) => (sec / maxSec) * 5000 * (0.8 + 0.05 * (L - 5)) * demand;
const rows = locs.map((L) => {
  const diff = infilDifficulty(p.skills, L.sec);
  const rew = infilReward(L.sec, p.skills.intelligence);
  const runS = runSeconds(L.maxLevel, diff);
  const per = bestPeriod(L.maxLevel, runS);
  const runsPerH = 3600 / per.T;
  return { ...L, diff, ok: diff < 3.5, rew, runS, T: per.T, demand: per.demand, runsPerH,
    repRun: tradeRep(rew, L.maxLevel, L.sec, per.demand, BN2.InfiltrationRep),
    cashRun: sellCash(rew, L.maxLevel, L.sec, per.demand, BN2.InfiltrationMoney),
    soaRun: soaRep(L.maxLevel, L.sec, per.demand) };
});
const feas = rows.filter((r) => r.ok);
const norm = (c) => String(c).replace(/[^A-Za-z]/g, "").toLowerCase();
const here = feas.filter((r) => norm(r.city) === norm(p.city));
const best = feas.slice().sort((a, b) => b.repRun * b.runsPerH - a.repRun * a.runsPerH)[0];
const bestHere = here.slice().sort((a, b) => b.repRun * b.runsPerH - a.repRun * a.runsPerH)[0];
console.log(`Summe Kampf+cha ${S}; machbare Orte ${feas.length}/${rows.length}`);
for (const r of [best, bestHere]) {
  console.log(`  ${r.name} (${r.city}) sec ${r.sec} L${r.maxLevel} diff ${r.diff.toFixed(2)}: Lauf ${r.runS.toFixed(1)} s, Periode ${r.T} s, Nachfrage ${r.demand.toFixed(3)}`
    + `\n     je Lauf: Ruf ${fmt(r.repRun)}  ODER  Geld ${fmt(r.cashRun)} (BN2 x3);  SoA-Ruf ${fmt(r.soaRun)} zusaetzlich (erst als Mitglied)`
    + `\n     je Stunde: Ruf ${fmt(r.repRun * r.runsPerH)}  ODER  Geld ${fmt(r.cashRun * r.runsPerH)}`);
}
// Freischaltschwelle: ab welcher Summe ist der Ort machbar (game.ts:41-53, Infiltration.ts:97)
const need = (sec) => Math.pow(Math.max(0, (sec - 3.5 - p.skills.intelligence / 1600) * 250), 1 / 0.9);
console.log(`  Schwelle Summe(str,def,dex,agi,cha) fuer ${bestHere.name}: > ${need(bestHere.sec).toFixed(0)} (nach einem Einbau starten alle Werte neu)`);

// ---------------------------------------------------------------- Teil 2
const augs = loadAugs();
const owned = new Set([...(p.augmentations || []).map((a) => a.name), ...(p.queuedAugmentations || []).map((a) => a.name)]);
const members = p.factions.filter((f) => f !== "Bladeburners");
const tradeable = members.filter((f) => offersWork[f]);
const BB_REP = 13000; // wie fakt-v2.mjs: Bladeburners-Ruf am Zyklusende (2 x Rang x faction_rep), GESCHAETZT
const BASE_BUDGET = 35e9; // wie fakt-v2.mjs: Geld je 12-h-Zyklus ohne Infiltration, GESCHAETZT
const cost = (list) => list.map((x) => x.cost).sort((a, b) => b - a).reduce((s, c, i) => s + c * Math.pow(1.9, i), 0);

function plan(memberList, infilHours, loc, contractRepPerFac) {
  const avail = [];
  for (const a of Object.values(augs)) {
    if (owned.has(a.name) || v2Value(a) <= 0 || !Number.isFinite(a.moneyCost)) continue;
    const bb = a.factions.includes("Bladeburners");
    const facs = a.factions.filter((f) => memberList.includes(f));
    if (!bb && !facs.length) continue;
    if (bb && a.repCost > BB_REP) continue;
    avail.push({ name: a.name, v: v2Value(a), cost: a.moneyCost, rep: a.repCost, facs, bb });
  }
  // Die Preistreppe macht die Wahl reihenfolgeabhaengig (ein teures Stueck schiebt alle
  // billigen eine Stufe tiefer, x1,9). Mehrere Gier-Ordnungen probieren, beste nehmen.
  let bestRes = null;
  for (const key of [(x) => x.v / x.cost, (x) => x.v, (x) => x.v / Math.sqrt(x.cost), (x) => x.v / Math.pow(x.cost, 0.25)]) {
    const order = avail.slice().sort((x, y) => key(y) - key(x));
    const r = planOrder(order, infilHours, loc, contractRepPerFac);
    if (!bestRes || r.v > bestRes.v) bestRes = r;
  }
  return bestRes;
}
function planOrder(avail, infilHours, loc, contractRepPerFac) {
  const chosen = [];
  const thr = {}; // Rufschwelle je Faktion
  const repTime = (t) => {
    let need = 0;
    for (const [f, r] of Object.entries(t)) need += Math.max(0, r - contractRepPerFac * 12);
    return loc ? need / (loc.repRun * loc.runsPerH) : (need > 0 ? Infinity : 0);
  };
  for (const x of avail) {
    const t2 = { ...thr };
    if (!x.bb) {
      // Faktion waehlen, die am wenigsten zusaetzlichen Ruf braucht
      let bestF = null, bestAdd = Infinity;
      for (const f of x.facs) {
        if (!loc && !offersWorkHack(f)) continue;
        const add = Math.max(0, x.rep - (t2[f] || 0));
        if (add < bestAdd) { bestAdd = add; bestF = f; }
      }
      if (!bestF) continue;
      t2[bestF] = Math.max(t2[bestF] || 0, x.rep);
    }
    const tr = repTime(t2);
    if (tr > infilHours + 1e-9) continue;
    const budget = BASE_BUDGET + (loc ? (infilHours - tr) * loc.cashRun * loc.runsPerH : 0);
    if (cost([...chosen, x]) <= budget) { chosen.push(x); Object.assign(thr, t2); }
  }
  const tr = repTime(thr);
  return { n: chosen.length, v: chosen.reduce((s, x) => s + x.v, 0), money: cost(chosen), repH: tr,
    budget: BASE_BUDGET + (loc ? (infilHours - tr) * loc.cashRun * loc.runsPerH : 0), names: chosen.map((x) => x.name) };
}
// Ohne Infiltration: nur Hacking-Faktionen bekommen Vertragsruf (PlayerObjectGeneralMethods.ts:515)
const hackFac = {};
for (const m of info.matchAll(/\[FactionName\.(\w+)\]:\s*new FactionInfo\(\{([\s\S]*?)\n  \}\),/g)) hackFac[facEnum[m[1]]] = /offerHackingWork:\s*true/.test(m[2]);
function offersWorkHack(f) { return !!hackFac[f]; }
const nHack = members.filter((f) => hackFac[f]).length;
const R = 4932; // gemessener Vertragsruf BN2.1 (fakt-rep.mjs), je Hacking-Faktion R/nHack
console.log(`\nTeil 2 - naechster 12-h-Zyklus, besessen = installiert + Warteschlange (${owned.size}); Mitglieder ${members.length}, davon tradefaehig ${tradeable.length}, Hacking ${nHack}`);
// Referenz ohne Infiltration (muss fakt-v2 "Ist" = ln 0,232 reproduzieren)
{
  const memHack = members.filter((f) => hackFac[f]);
  const r = (() => {
    const avail = [];
    for (const a of Object.values(augs)) {
      if (owned.has(a.name) || v2Value(a) <= 0 || !Number.isFinite(a.moneyCost)) continue;
      let ok = a.factions.includes("Bladeburners") && a.repCost <= BB_REP;
      for (const f of a.factions) if (memHack.includes(f) && a.repCost / (R / memHack.length) <= 12) ok = true;
      if (ok) avail.push({ name: a.name, v: v2Value(a), cost: a.moneyCost });
    }
    avail.sort((x, y) => y.v / y.cost - x.v / x.cost);
    const ch = [];
    for (const x of avail) if (cost([...ch, x]) <= BASE_BUDGET) ch.push(x);
    return { n: ch.length, v: ch.reduce((s, x) => s + x.v, 0), money: cost(ch) };
  })();
  console.log(`  REFERENZ ohne Infiltration (Vertragsruf ${R}/h auf ${memHack.length} Hacking-Faktionen, 35 Mrd): ${r.n} Stuecke, ln ${r.v.toFixed(3)} (x${Math.exp(r.v).toFixed(2)}), Geld ${fmt(r.money)}`);
}
const withSyn = [...members, "The Syndicate"];
for (const [label, mem] of [["Mitglieder wie jetzt", members], ["+ The Syndicate (Kampf 200)", withSyn]]) {
  for (const H of [2, 6, 9.6]) {
    const r = plan(mem, H, bestHere, 0);
    console.log(`  ${label.padEnd(28)} Infiltration ${String(H).padStart(4)} h (${bestHere.name}): ${String(r.n).padStart(2)} Stuecke, ln ${r.v.toFixed(3)} (x${Math.exp(r.v).toFixed(2)}),`
      + ` Rufzeit ${r.repH.toFixed(2)} h, Budget ${fmt(r.budget)}, Preis ${fmt(r.money)}`);
  }
}
const showcase0 = plan(members, 9.6, bestHere, 0);
console.log("  Auswahl (Mitglieder wie jetzt, 9,6 h):", showcase0.names.join(", "));
const showcase = plan(withSyn, 9.6, bestHere, 0);
console.log("  Auswahl (+Syndicate, 9,6 h):", showcase.names.join(", "));

// ---------------------------------------------------------------- Teil 3
// Elastizitaet wie fakt-rang.mjs (Stand 09:59, dort GEGENPROBE -19 % gegen real)
const bbSkills = {"Hyperdrive":5,"Digital Observer":10,"Tracer":9,"Short-Circuit":8,"Blade's Intuition":7,"Cyber's Edge":5,"Evasive System":4,"Reaper":4,"Cloak":4,"Datamancer":12};
const s0959 = {hacking:372,strength:194,defense:181,dexterity:181,agility:181,charisma:57,intelligence:153};
const lv = {"Tracking":12,"Bounty Hunter":7,"Retirement":11,"Investigation":1,"Undercover Operation":1,"Sting Operation":1,"Raid":5,"Stealth Retirement Operation":1,"Assassination":1};
const su = {"Tracking":88,"Bounty Hunter":35,"Retirement":85,"Raid":21};
const env = {pop:587363003, comms:41, chaos:49.10, teamCount:0, bbSuccessMult:1};
console.log("\nTeil 3 - Rang in 10 h je Kampffaktor (tools/bbrank/sim.mjs, greedy):");
let base = null;
for (const f of [1, 1.26, 1.72, 2.2, 2.8, 3.5]) {
  const sk = { ...s0959, strength: s0959.strength * f, defense: s0959.defense * f, dexterity: s0959.dexterity * f, agility: s0959.agility * f };
  const r = bbSim({ skills: sk, bbSkills, levels: lv, successes: su, env, bnRankMult: 1, hours: 10, policy: "greedy", rank: 1734.16 });
  const g = r.rank - 1734.16;
  if (base === null) base = g;
  console.log(`  Kampf x${f.toFixed(2)}: +${Math.round(g)} Rang (x${(g / base).toFixed(2)})`);
}
