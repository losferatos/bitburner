// Gegenpruefung G11 (BLADE-2): Nachbau der Kaufregel von blade.js (faehigkeitenKaufen + relNutzen, Stand master)
// auf einem Spielstand: Welche Faehigkeit hat welchen Wert je SP, und was kauft die Regel von Null bis totalSkillPoints?
// Varianten: bot = unveraendert; fixDM = schaetzNot aus spanneGenau (hier: 0, solange eine Black Op offen ist);
//            fixBoth = zusaetzlich Tracer-Abdeckung = Vertragsanteil (Parameter trAbd, Standard 0).
// Aufruf: node tools/audit/verify-g11-botregel.mjs <backup-teilname> [luft] [trAbd]
import fs from "node:fs";
import path from "node:path";
import { ladeSpielstand, flach } from "./blade-lage.mjs";
import { AKTIONEN, successRange, successChance } from "./blade-formeln.mjs";
import { root, BLACKOPS, blackOpChance, cost, costSum } from "./verify-g11-lib.mjs";

const teil = process.argv[2] || "BN2L1_2026-10-03T09-59";
const luftArg = process.argv[3] !== undefined && process.argv[3] !== "-" ? Number(process.argv[3]) : null;
const trAbd = process.argv[4] !== undefined ? Number(process.argv[4]) : 0;
const idx = fs.readFileSync(path.join(root, "backups", "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((z) => z.split("\t"));
const datei = idx.map((z) => z[1]).find((f) => f.includes(teil));
const { p } = ladeSpielstand(path.join(root, "backups", datei));
const bb = flach(p.bladeburner);
const P = { skills: p.skills, mults: p.mults };
const city = bb.cities[bb.city];
const lvlA = (n) => (bb.contracts[n] || bb.operations[n] || { level: 1 }).level;
const cnt = (n) => (bb.contracts[n] || bb.operations[n] || { count: 0 }).count;
const luft = luftArg !== null ? luftArg : Math.max(0, Math.min(1, (bb.stamina / bb.maxStamina - 0.5) / 0.4));

// schaetzNot wie blade.js (rohe Spanne ueber 6 Operationen + 3 Vertraege)
const NAMEN = ["Investigation", "Undercover Operation", "Sting Operation", "Raid", "Stealth Retirement Operation", "Assassination", "Tracking", "Bounty Hunter", "Retirement"];
const Bst = { skills: bb.skills, stamina: bb.stamina, maxStamina: bb.maxStamina, staminaBonus: bb.staminaBonus };
let breit = 0;
for (const n of NAMEN) { const [lo, hi] = successRange(AKTIONEN[n], lvlA(n), P, Bst, city); breit = Math.max(breit, hi - lo); }
const schaetzNotRoh = Math.max(0, Math.min(1, (breit - 0.1) / 0.9));

// blackOpArbeit wie blade.js:2575-2610 (Schwelle 0,90 vor dem Endspiel)
const i0 = bb.numBlackOpsComplete;
function arbeit(lv) {
  let summe = 0, kill = 0, stealth = 0;
  for (const op of BLACKOPS.slice(i0)) {
    const ch = blackOpChance(op, P, lv, { stamFrac: bb.stamina / bb.maxStamina });
    if (!(ch > 0)) continue;
    const w = Math.max(0, Math.log(0.90 / ch));
    summe += w; if (op.isKill) kill += w; if (op.isStealth) stealth += w;
  }
  return summe > 0 ? { BI: 1, DO: 1, SC: kill / summe, Cl: stealth / summe } : null;
}
// klemmFaktor wie blade.js: Sonden = naechste Black Op + erste offene aus [Assassination, Raid, Stealth Ret.]
function klemm(lv) {
  const sonden = [];
  if (i0 < 21) sonden.push(blackOpChance(BLACKOPS[i0], P, lv, { stamFrac: bb.stamina / bb.maxStamina }));
  for (const n of ["Assassination", "Raid", "Stealth Retirement Operation"]) {
    if (cnt(n) < 1) continue;
    sonden.push(successChance(AKTIONEN[n], lvlA(n), P, { skills: lv, stamina: bb.stamina, maxStamina: bb.maxStamina }, city));
    break;
  }
  if (!sonden.length) return 1;
  return Math.max(0.05, sonden.filter((x) => x < 0.999).length / sonden.length);
}
// Reaper/Evasive wie blade.js
function relRE(name, lv) {
  const sk = P.skills; const r = lv.Reaper || 0, e = lv["Evasive System"] || 0;
  const rN = name === "Reaper" ? r + 1 : r, eN = name === "Evasive System" ? e + 1 : e;
  const ef = (rr, ee, st) => { let m = 1; if (["strength", "defense", "dexterity", "agility"].includes(st)) m *= 1 + 0.02 * rr; if (st === "dexterity" || st === "agility") m *= 1 + 0.04 * ee; return m; };
  const W = { hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2, intelligence: 0.1 }, D = { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 };
  const comp = (rr, ee) => { let c = 0; for (const s of Object.keys(W)) { const x = s === "hacking" || s === "intelligence" ? sk[s] : sk[s] * ef(rr, ee, s); c += W[s] * Math.pow(Math.max(0, x), D[s]); } return c; };
  const chanceProz = 100 * (comp(rN, eN) / comp(r, e) - 1);
  const sf = (a, d) => 0.5 * (Math.pow(a, 0.04) + Math.pow(d, 0.035) + a / 1e4 + d / 1e4);
  const fa = sf(sk.agility * ef(r, e, "agility"), sk.dexterity * ef(r, e, "dexterity")), fn = sf(sk.agility * ef(rN, eN, "agility"), sk.dexterity * ef(rN, eN, "dexterity"));
  return chanceProz + 100 * Math.log(fn / fa) * luft;
}
const CS = { "Blade's Intuition": 3, "Short-Circuit": 5.5, "Digital Observer": 4, "Cloak": 5.5, "Tracer": 4 };
function relNutzen(name, lv, variante, ctx) {
  const L = lv[name] || 0;
  if (name === "Hyperdrive") {
    const a = 1 + L * 0.1; const lvlPlus = 1 * (p.mults.defense || 1) * 32 * Math.log((a + 0.1) / a);
    const basis = Math.max(1, P.skills.defense);
    return 100 * (Math.pow((basis + lvlPlus) / basis, 0.9) - 1);
  }
  if (name === "Reaper" || name === "Evasive System") return relRE(name, lv);
  if (name === "Datamancer") return (500 / (100 + 5 * L)) * (variante === "bot" ? schaetzNotRoh : 0);
  if (name === "Cyber's Edge") return (200 / (100 + 2 * L)) * (1 - luft);
  if (name === "Overclock") return (100 / (99 - Math.min(L, 98))) * luft;
  const pr = CS[name]; const a = 1 + L * pr / 100;
  const ab = ctx.arbeit;
  let abd = 1;
  if (name === "Short-Circuit") abd = ab ? ab.SC : 0.58;
  else if (name === "Cloak") abd = ab ? ab.Cl : 0.17;
  else if (name === "Tracer") abd = variante === "fixBoth" ? trAbd : 1.0;
  return 100 * ((a + pr / 100) / a - 1) * abd * ctx.klemm;
}
const ALLE = ["Hyperdrive", "Short-Circuit", "Digital Observer", "Cloak", "Reaper", "Evasive System", "Cyber's Edge", "Tracer", "Blade's Intuition", "Datamancer", "Overclock"];
function lauf(variante, gesamtSP, start = {}) {
  const lv = { ...start }; let punkte = gesamtSP - Object.entries(start).reduce((s, [n, L]) => s + costSum(n, L), 0);
  for (let guard = 0; guard < 5000; guard++) {
    const ctx = { arbeit: arbeit(lv), klemm: klemm(lv) };
    const w = ALLE.map((n) => { const c = cost(n, lv[n] || 0); const cap = n === "Overclock" ? 90 : Infinity; return { n, c, v: (lv[n] || 0) >= cap || c <= 0 ? -1 : relNutzen(n, lv, variante, ctx) / c }; }).sort((a, b) => b.v - a.v);
    const top = w[0];
    if (top.c > punkte) return { lv, rest: punkte, w };
    lv[top.n] = (lv[top.n] || 0) + 1; punkte -= top.c;
  }
  return { lv, rest: punkte };
}
const kurz = (lv) => ALLE.filter((n) => lv[n]).map((n) => n.replace(/[^A-Z]/g, "") + lv[n]).join(" ");
console.log("Stand", datei, "| SP gesamt", bb.totalSkillPoints, "| luft", luft.toFixed(2), "| rohe Breite", breit.toFixed(3), "schaetzNot", schaetzNotRoh.toFixed(3), "| klemm Ist", klemm(bb.skills).toFixed(2));
console.log("Ist-Verteilung      ", kurz(bb.skills));
{
  const ctx = { arbeit: arbeit(bb.skills), klemm: klemm(bb.skills) };
  const w = ALLE.map((n) => ({ n, rel: relNutzen(n, bb.skills, "bot", ctx), c: cost(n, bb.skills[n] || 0) })).map((x) => ({ ...x, v: x.rel / x.c })).sort((a, b) => b.v - a.v);
  console.log("Regelwert im Ist-Zustand (Nutzen % / Preis = je SP):", w.map((x) => x.n.replace(/[^A-Z]/g, "") + " " + x.rel.toFixed(2) + "/" + x.c + "=" + x.v.toFixed(4)).join("  "));
}
const ch = (lv) => blackOpChance(BLACKOPS[i0 < 21 ? i0 : 0], P, lv, { unclamped: true });
const basisChance = ch(bb.skills);
for (const v of ["bot", "fixDM", "fixBoth"]) {
  const r = lauf(v, bb.totalSkillPoints - bb.skillPoints);
  console.log(v.padEnd(8), "Regel von 0 :", kurz(r.lv), "| Rest", r.rest, "| Chance naechste BO x" + (ch(r.lv) / basisChance).toFixed(3), "(" + basisChance.toFixed(4) + " -> " + ch(r.lv).toFixed(4) + ")");
}
