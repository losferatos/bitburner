// Gegenpruefung G11 (BLADE-2): zeitaufgeloeste Nachbildung der Kaufregel von blade.js ueber den ganzen Knoten BN2.1.
// Die SP-Zufuhr (totalSkillPoints je Spielstand) wird von Stand zu Stand durch die Regel gekauft, im jeweiligen
// Spielerzustand (Kampfwerte, Staedte, Vorraete aus dem Stand). Varianten:
//   bot      Regel unveraendert (Eichung: muss die tatsaechlichen Stufen je Stand treffen)
//   fixDM    schaetzNot = 0 (Datamancer nie gekauft; entspricht schaetzNot aus spanneGenau, solange D2 aufloest)
//   fixBoth  zusaetzlich Tracer-Abdeckung = Rangsanteil der Vertraege im Intervall (Boden TR_MIN)
//   fix0     zusaetzlich Tracer-Abdeckung = 0 (Grenzfall)
// Ausdauer-Luft (ausdauerLuft) je Intervall aus dem Aktionsprotokoll: Ausdauer am Ende der Aktionen mit Rangzuwachs,
// geteilt durch die Hoechstausdauer (zwischen den Staenden linear interpoliert), dann (f-0,5)/0,4 auf [0,1].
// Aufruf: node tools/audit/verify-g11-sim.mjs [luftModus: log|const:<x>] [trMin]
import fs from "node:fs";
import path from "node:path";
import { ladeSpielstand, flach, homeDatei } from "./blade-lage.mjs";
import { AKTIONEN, successRange, successChance, rankGain } from "./blade-formeln.mjs";
import { root, BLACKOPS, blackOpChance, cost, costSum } from "./verify-g11-lib.mjs";

const luftModus = process.argv[2] || "log";
const TR_MIN = process.argv[3] !== undefined ? Number(process.argv[3]) : 0.02;
const idx = fs.readFileSync(path.join(root, "backups", "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((z) => z.split("\t"));
const dateien = idx.filter((z) => z[1].includes("BN2L1")).map((z) => ({ ts: Date.parse(z[0]), f: z[1] }));

// Aktionsprotokoll des letzten BN2L1-Stands (ganzer Knoten)
const letzte = dateien[dateien.length - 1];
const { servers: sv } = ladeSpielstand(path.join(root, "backups", letzte.f));
const bjL = JSON.parse(homeDatei(sv, "data/blade.json") || "null");
const LOG = (homeDatei(sv, "data/aktionen.txt") || "").split("\n").filter((z) => z.trim()).map((z) => { try { return JSON.parse(z); } catch { return null; } }).filter(Boolean).filter((z) => z.von >= (bjL?.nodeReset || 0));

const S = [];
for (const d of dateien) {
  const { p } = ladeSpielstand(path.join(root, "backups", d.f));
  const bb = flach(p.bladeburner);
  if (!bb) continue;
  S.push({ ts: d.ts, f: d.f.replace("LIVE_197f4d61481686_", "").replace(".json.gz", ""), p, bb });
}
// Ausdauer-Luft je Intervall
function luftSamples(t0, t1, m0, m1) {
  const out = [];
  for (const z of LOG) {
    if (z.bis <= t0 || z.bis > t1) continue;
    if (!(z.rangBis > z.rangVon) || !Number.isFinite(z.ausdauerBis)) continue;
    const maxS = m0 + (m1 - m0) * ((z.bis - t0) / (t1 - t0));
    out.push(Math.max(0, Math.min(1, (z.ausdauerBis / maxS - 0.5) / 0.4)));
  }
  return out;
}
const NAMEN = ["Investigation", "Undercover Operation", "Sting Operation", "Raid", "Stealth Retirement Operation", "Assassination", "Tracking", "Bounty Hunter", "Retirement"];
// wie blade.js rAusBlackOp / chanceAusR (siehe verify-g11-schaetznot.mjs)
function rAusBlackOp(bo, boReal) {
  const EPS = 1e-12;
  if (bo.min < boReal - EPS) return { r: bo.min / boReal, sicher: true };
  if (bo.max > boReal + EPS && bo.max < 1) return { r: bo.max / boReal, sicher: true };
  if (bo.max >= 1 && boReal < 1) return { r: 1 / boReal, sicher: false };
  if (boReal >= 1 - EPS && bo.min >= boReal - EPS) return { r: 1, sicher: false };
  return { r: 1, sicher: true };
}
function chanceAusR(r, sicher, s) {
  if (!sicher) return null;
  if (r < 1) return s.min > 0 ? (s.min / r + s.max) / 2 : null;
  if (s.max < 1) return (s.max / r + s.min) / 2;
  return s.min;
}
function zustand(i) {
  const { p, bb } = S[i];
  const P = { skills: p.skills, mults: p.mults };
  const city = bb.cities[bb.city];
  const lv = (n) => (bb.contracts[n] || bb.operations[n] || { level: 1 }).level;
  const cn = (n) => (bb.contracts[n] || bb.operations[n] || { count: 0 }).count;
  const Bst = { skills: bb.skills, stamina: bb.stamina, maxStamina: bb.maxStamina, staminaBonus: bb.staminaBonus };
  let breit = 0, breitFix = 0;
  // schaetzNot nach dem vorgeschlagenen Fix (spanneGenau): nur ungeloeste Aktionen bleiben breit
  const r = city.pop / city.popEst;
  const op = BLACKOPS[bb.numBlackOpsComplete < 21 ? bb.numBlackOpsComplete : 20];
  const boReal = blackOpChance(op, P, bb.skills, { stamFrac: bb.stamina / bb.maxStamina });
  const cl = (x) => Math.max(0, Math.min(x, 1));
  const boPair = r < 1 ? [cl(boReal * r), cl(boReal)] : [cl(boReal), cl(boReal * Math.min(r, Number.MAX_VALUE))];
  const rr = rAusBlackOp({ min: boPair[0], max: boPair[1] }, boReal);
  for (const n of NAMEN) {
    const [lo, hi] = successRange(AKTIONEN[n], lv(n), P, Bst, city);
    breit = Math.max(breit, hi - lo);
    if (bb.numBlackOpsComplete >= 21 || chanceAusR(rr.r, rr.sicher, { min: lo, max: hi }) === null) breitFix = Math.max(breitFix, hi - lo);
  }
  const sn = (b) => Math.max(0, Math.min(1, (b - 0.1) / 0.9));
  return { P, city, lv, cn, i0: bb.numBlackOpsComplete, stamFrac: bb.stamina / bb.maxStamina, schaetzNot: sn(breit), snFix: sn(breitFix), mults: p.mults };
}
const Z = S.map((_, i) => zustand(i));
// Rangsanteil der Vertraege je Intervall (Erfolge/Fehlschlaege x Rang je Aktion, Stufe = Mittel; Spieler + Sleeves)
function vertragsAnteil(i) {
  if (i === 0) return 0;
  const a = S[i - 1].bb, b = S[i].bb; let ctr = 0, ops = 0;
  for (const n of NAMEN) {
    const x = a.contracts[n] || a.operations[n], y = b.contracts[n] || b.operations[n]; const A = AKTIONEN[n];
    const dS = y.successes - x.successes, dF = y.failures - x.failures; const Lm = Math.round((x.level + y.level) / 2);
    const r = dS * rankGain(A, Lm) - dF * A.rankLoss * Math.pow(A.rewardFac, Lm - 1);
    if (A.typ === "Contracts") ctr += r; else ops += r;
  }
  const tot = ctr + ops;
  return tot > 0 ? Math.max(0, ctr) / tot : 0;
}

// ---- Regel ----
function relRE(name, z, lvl, luft) {
  const sk = z.P.skills; const r = lvl.Reaper || 0, e = lvl["Evasive System"] || 0;
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
const ALLE = ["Hyperdrive", "Short-Circuit", "Digital Observer", "Cloak", "Reaper", "Evasive System", "Cyber's Edge", "Tracer", "Blade's Intuition", "Datamancer", "Overclock"];
function arbeitUndKlemm(z, lvl) {
  let summe = 0, kill = 0, stealth = 0;
  for (const op of BLACKOPS.slice(z.i0)) {
    const ch = blackOpChance(op, z.P, lvl, { stamFrac: z.stamFrac });
    if (!(ch > 0)) continue;
    const w = Math.max(0, Math.log(0.90 / ch)); summe += w; if (op.isKill) kill += w; if (op.isStealth) stealth += w;
  }
  const arbeit = summe > 0 ? { SC: kill / summe, Cl: stealth / summe } : null;
  const sonden = [];
  if (z.i0 < 21) sonden.push(blackOpChance(BLACKOPS[z.i0], z.P, lvl, { stamFrac: z.stamFrac }));
  for (const n of ["Assassination", "Raid", "Stealth Retirement Operation"]) {
    if (z.cn(n) < 1) continue;
    sonden.push(successChance(AKTIONEN[n], z.lv(n), z.P, { skills: lvl, stamina: z.stamFrac, maxStamina: 1 }, z.city)); break;
  }
  const klemm = sonden.length ? Math.max(0.05, sonden.filter((x) => x < 0.999).length / sonden.length) : 1;
  return { arbeit, klemm };
}
function relNutzen(name, z, lvl, ctx, v, luft, trAbd) {
  const L = lvl[name] || 0;
  if (name === "Hyperdrive") {
    const a = 1 + L * 0.1; const lvlPlus = (z.mults.defense || 1) * 32 * Math.log((a + 0.1) / a);
    const basis = Math.max(1, z.P.skills.defense);
    return 100 * (Math.pow((basis + lvlPlus) / basis, 0.9) - 1);
  }
  if (name === "Reaper" || name === "Evasive System") return relRE(name, z, lvl, luft);
  if (name === "Datamancer") return (500 / (100 + 5 * L)) * (v === "bot" ? z.schaetzNot : (v === "fixDMreal" || v === "fixBothReal") ? z.snFix : 0);
  if (name === "Cyber's Edge") return (200 / (100 + 2 * L)) * (1 - luft);
  if (name === "Overclock") return (100 / (99 - Math.min(L, 98))) * luft;
  const pr = CS[name]; const a = 1 + L * pr / 100;
  let abd = 1;
  if (name === "Short-Circuit") abd = ctx.arbeit ? ctx.arbeit.SC : 0.58;
  else if (name === "Cloak") abd = ctx.arbeit ? ctx.arbeit.Cl : 0.17;
  else if (name === "Tracer") abd = v === "bot" || v === "fixDM" || v === "fixDMreal" ? 1.0 : trAbd;
  return 100 * ((a + pr / 100) / a - 1) * abd * ctx.klemm;
}
function kaufe(v, z, lvl, punkte, luft, trAbd) {
  for (let guard = 0; guard < 5000; guard++) {
    const ctx = arbeitUndKlemm(z, lvl);
    let top = null;
    for (const n of ALLE) {
      const c = cost(n, lvl[n] || 0); const cap = n === "Overclock" ? 90 : Infinity;
      const val = (lvl[n] || 0) >= cap || c <= 0 ? -1 : relNutzen(n, z, lvl, ctx, v, luft, trAbd) / c;
      if (!top || val > top.val) top = { n, c, val };
    }
    if (top.c > punkte) return punkte;
    lvl[top.n] = (lvl[top.n] || 0) + 1; punkte -= top.c;
  }
  return punkte;
}

// ---- Lauf ----
const VAR = ["bot", "fixDM", "fixBoth", "fix0", "fixDMreal", "fixBothReal"];
const kurz = (lv) => ["Datamancer", "Tracer", "Overclock", "Blade's Intuition", "Digital Observer", "Short-Circuit", "Reaper", "Evasive System", "Cloak", "Cyber's Edge", "Hyperdrive"]
  .map((n) => n.replace(/[^A-Z]/g, "") + (lv[n] || 0)).join(" ");
const sim = {}; for (const v of VAR) sim[v] = { lvl: {}, punkte: 0 };
const ausgabe = [];
let letztSP = 0;
for (let i = 0; i < S.length; i++) {
  const bb = S[i].bb;
  const dSP = bb.totalSkillPoints - letztSP; letztSP = bb.totalSkillPoints;
  let luft;
  if (luftModus.startsWith("const:")) luft = Number(luftModus.slice(6));
  else {
    const t0 = i ? S[i - 1].ts : S[i].ts - 3.6e6; const m0 = i ? S[i - 1].bb.maxStamina : bb.maxStamina;
    const smp = luftSamples(t0, S[i].ts, m0, bb.maxStamina);
    luft = smp.length ? smp.reduce((a, c) => a + c, 0) / smp.length : Math.max(0, Math.min(1, (bb.stamina / bb.maxStamina - 0.5) / 0.4));
  }
  const trAbd = Math.max(TR_MIN, vertragsAnteil(i));
  for (const v of VAR) { sim[v].punkte += dSP; sim[v].punkte = kaufe(v, Z[i], sim[v].lvl, sim[v].punkte, luft, v === "fix0" ? 0 : trAbd); }
  const c = (lvl) => blackOpChance(BLACKOPS[Z[i].i0 < 21 ? Z[i].i0 : 20], Z[i].P, lvl, { unclamped: true, stamFrac: 1 });
  const cIst = c(bb.skills);
  ausgabe.push({ i, f: S[i].f, SP: bb.totalSkillPoints, luft, trAbd, cIst, ratio: Object.fromEntries(VAR.map((v) => [v, c(sim[v].lvl) / c(sim.bot.lvl)])), botVsIst: c(sim.bot.lvl) / cIst,
    ist: kurz(bb.skills), lv: Object.fromEntries(VAR.map((v) => [v, kurz(sim[v].lvl)])) });
}
console.log("Eichung (bot-Nachbildung gegen tatsaechliche Stufen) und Gegenfaelle; Chance der naechsten Black Op bei voller Ausdauer, Trupp 0");
console.log("Reihenfolge der Stufen: DM TR O BI DO SC R ES CL CE HY");
for (const o of ausgabe) {
  console.log(o.f.padEnd(34), "SP", String(o.SP).padStart(6), "luft " + o.luft.toFixed(2), "trAbd " + o.trAbd.toFixed(2), "| chance Ist", o.cIst.toFixed(4));
  console.log("   Ist     ", o.ist);
  console.log("   bot     ", o.lv.bot, " | bot/Ist x" + o.botVsIst.toFixed(3));
  console.log("   fixDM   ", o.lv.fixDM, " | /bot x" + o.ratio.fixDM.toFixed(3));
  console.log("   fixBoth ", o.lv.fixBoth, " | /bot x" + o.ratio.fixBoth.toFixed(3));
  console.log("   fix0    ", o.lv.fix0, " | /bot x" + o.ratio.fix0.toFixed(3));
  console.log("   fixDMrl ", o.lv.fixDMreal, " | /bot x" + o.ratio.fixDMreal.toFixed(3));
  console.log("   fixBthRl", o.lv.fixBothReal, " | /bot x" + o.ratio.fixBothReal.toFixed(3));
}
fs.writeFileSync(path.join(root, "nodes", "audit-2026-10-03", "verify-g11-sim-" + luftModus.replace(/[^a-z0-9.]/gi, "_") + ".json"), JSON.stringify(ausgabe));
