// Audit 03.10.2026, Bereich SING: Intelligenz-Quellen und Wert.
// Nur lesen. Aufruf: node tools/audit/sing-int.mjs
//
// Fragen (Auftrag "manualHack/connect als Int-Quelle?"):
//  1. Wie schnell waechst Int heute passiv (Spielstaende BN2L1)?
//  2. Was bringt ns.singularity.manualHack, was der Terminalbefehl "hack"?
//  3. Was ist Int fuer den Bot wert (Hacking-Zeit/-Chance, Bladeburner-Kompetenz)?
//
// Eichungen (Soll = Spiel, Ist = Nachbau):
//  E1 Int-Stufe aus Int-Erfahrung (skill.ts) gegen skills.intelligence, alle BN2L1-Staende
//  E2 hackTime und hackChance (Hacking.ts) gegen ns.formulas.hacking.* aus data/calccheck.txt
//     (Spielstand BN10L2 04.09. 01:13, dort steht die Datei zuerst; Ziele mit minDifficulty)
//  E3 Typhoon-Chance (Bladeburner) gegen data/blade.json boChancen - ueber blade-formeln.mjs
//     (dort schon geeicht, hier nur wiederholt, damit die Int-Variation auf geeichtem Grund steht)
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { AKTIONEN, successChance } from "./blade-formeln.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = path.join(root, "backups");

function load(file) {
  const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, file))).toString("utf8"));
  const p = JSON.parse(save.data.PlayerSave).data;
  const servers = JSON.parse(save.data.AllServersSave);
  return { save, p, servers };
}
const flat = (x) => {
  if (Array.isArray(x)) return x.map(flat);
  if (x && typeof x === "object") {
    if ("ctor" in x && "data" in x && Object.keys(x).length === 2) return flat(x.data);
    const o = {};
    for (const [k, v] of Object.entries(x)) o[k] = flat(v);
    return o;
  }
  return x;
};
function homeText(servers, name) {
  const h = flat(servers.home);
  const e = (h.textFiles || []).find((x) => x[0] === name);
  return e ? e[1].text : null;
}

// PersonObjects/formulas/skill.ts:7-15
export function calculateSkill(exp, mult = 1) {
  if (mult === 0) return 1;
  return Math.max(Math.floor(mult * (32 * Math.log(exp + 534.6) - 200)), 1);
}
// Umkehrung (skill.ts calculateExp): exp fuer Stufe s
export function calculateExp(skill, mult = 1) {
  return Math.exp((skill / mult + 200) / 32) - 534.6;
}
// PersonObjects/formulas/intelligence.ts:1-3
export const intBonus = (int, w = 1) => 1 + (w * Math.pow(int, 0.8)) / 600;

// Hacking.ts:9-24
export function hackChance(s, p) {
  if (!s.hasAdminRights || s.hackDifficulty >= 100) return 0;
  const skillMult = Math.max(1.75 * p.skills.hacking, 1);
  const skillChance = (skillMult - s.requiredHackingSkill) / skillMult;
  const c = skillChance * ((100 - s.hackDifficulty) / 100) * p.mults.hacking_chance * intBonus(p.skills.intelligence, 1);
  return Math.min(1, Math.max(0, c));
}
// Hacking.ts:30-38
export function hackExp(s, p, bnHackExp = 1) {
  if (!s.baseDifficulty) return 0;
  return (3 + s.baseDifficulty * 0.3) * p.mults.hacking_exp * bnHackExp;
}
// Hacking.ts:60-79 (Sekunden)
export function hackTime(s, p, bnSpeed = 1) {
  const diffMult = s.requiredHackingSkill * s.hackDifficulty;
  const skillFactor = (2.5 * diffMult + 500) / (p.skills.hacking + 50);
  return (5 * skillFactor) / (p.mults.hacking_speed * bnSpeed * intBonus(p.skills.intelligence, 1));
}

// Terminal/commands/hack.ts:38-80: Dauer hackTime/4, bei Erfolg Int += 4*log10(exp) (nur exp > 1),
// Geld 0 -> exp/4. NetscriptHelpers.tsx:614-658 (manualHack): volle hackTime, Int += 0,005.
export function terminalHackIntPerSec(s, p, bn = {}) {
  const t = hackTime(s, p, bn.speed ?? 1) / 4;
  const c = hackChance(s, p);
  let e = hackExp(s, p, bn.hackExp ?? 1);
  if ((s.moneyAvailable ?? 1) <= 0) e /= 4;
  const gain = e > 1 ? 4 * Math.log10(e) : 0;
  return { t, c, e, gain, perSec: (c * gain) / t };
}
export function manualHackIntPerSec(s, p, bn = {}) {
  const t = hackTime(s, p, bn.speed ?? 1);
  return (hackChance(s, p) * 0.005) / t;
}

const idx = fs.readFileSync(path.join(dir, "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((l) => l.split("\t"));
const bn2 = idx.filter((r) => r[1].includes("BN2L1"));

// ---------- E1 ----------
console.log("== E1 Int-Stufe aus Int-Erfahrung (skill.ts:7-15), alle BN2L1-Staende");
let e1max = 0;
const intRows = [];
for (const r of bn2) {
  const { p } = load(r[1]);
  const ist = calculateSkill(p.exp.intelligence, 1);
  e1max = Math.max(e1max, Math.abs(ist - p.skills.intelligence));
  intRows.push({ ts: r[0], exp: p.exp.intelligence, play: p.totalPlaytime, lvl: p.skills.intelligence, bb: p.bladeburner });
}
console.log("  Staende", bn2.length, "| max |Soll-Ist| =", e1max, "| Beispiel", intRows.at(-1).lvl, "/", calculateSkill(intRows.at(-1).exp));

// ---------- passiv ----------
const a = intRows[0], b = intRows.at(-1);
const dh = (b.play - a.play) / 3.6e6;
console.log("== Passive Int-Rate BN2L1:", (b.exp - a.exp).toFixed(1), "Int-exp in", dh.toFixed(2), "h Spielzeit =",
  ((b.exp - a.exp) / dh).toFixed(1), "/h (", a.ts.slice(0, 16), "->", b.ts.slice(0, 16), ")");
// laengerer Bogen: aelteste und juengste Sicherung ueberhaupt
{
  const first = load(idx[0][1]).p, last = load(idx.at(-1)[1]).p;
  const h = (last.totalPlaytime - first.totalPlaytime) / 3.6e6;
  console.log("   ueber alle Sicherungen:", (last.exp.intelligence - first.exp.intelligence).toFixed(0), "Int-exp in", h.toFixed(1),
    "h =", ((last.exp.intelligence - first.exp.intelligence) / h).toFixed(1), "/h; Int", first.skills.intelligence, "->", last.skills.intelligence);
}

// ---------- E2 ----------
// Soll: Laufzeit, die bn4net per ns.getWeakenTime (= 4 x hackTime, Hacking.ts:94-98) ermittelt und
// worker/weaken.js als args[3] mitgegeben hat; Spielstand 03.10. 17:17. Nur Ziele, deren Sicherheit
// im Stand auf dem Minimum steht (dann ist die Sicherheit zur Planzeit bekannt).
console.log("== E2 hackTime (Hacking.ts:60-79) gegen ns.getWeakenTime/4 aus laufenden worker/weaken.js-Argumenten");
{
  const f = bn2.at(-1)[1];
  const { p, servers } = load(f);
  const soll = new Map();
  for (const [h, s0] of Object.entries(servers)) {
    for (const r0 of (flat(s0).runningScripts || [])) {
      const r = r0;
      if (r.filename === "worker/weaken.js" && Number(r.args[3]) > 0) {
        const k = r.args[0];
        if (!soll.has(k)) soll.set(k, new Set());
        soll.get(k).add(Number(r.args[3]));
      }
    }
  }
  for (const [host, set] of soll) {
    const s = flat(servers[host]);
    const atMin = Math.abs(s.hackDifficulty - s.minDifficulty) < 1e-9;
    const ist = 4 * hackTime({ ...s, hackDifficulty: s.minDifficulty }, p) * 1000;
    const vals = [...set].sort((x, y) => x - y);
    console.log("  " + host.padEnd(16), "sec", s.hackDifficulty.toFixed(3) + "/" + s.minDifficulty, atMin ? "(Minimum)" : "(ueber Min.)",
      "| soll", vals.join(","), "ms | ist bei Min-Sicherheit", ist.toFixed(1), "ms",
      atMin ? "| Abw. " + (Math.min(...vals.map((v) => Math.abs(v - ist)))).toFixed(1) + " ms" : "");
  }
}

// ---------- Int-Raten im BN2-Stand ----------
const latest = bn2.at(-1)[1];
const L = load(latest);
const P = L.p;
console.log("== Int-Raten im juengsten Stand", latest.slice(28, 56), "| hacking", P.skills.hacking, "int", P.skills.intelligence,
  "speed", P.mults.hacking_speed.toFixed(4), "exp", P.mults.hacking_exp.toFixed(4), "chance", P.mults.hacking_chance.toFixed(4));
const rooted = Object.entries(L.servers).map(([h, s]) => [h, flat(s)])
  .filter(([h, s]) => s.hasAdminRights && !s.purchasedByPlayer && s.requiredHackingSkill <= P.skills.hacking && s.baseDifficulty > 0
    && h !== "w0r1d_d43m0n" && h !== "home" && !h.startsWith("hacknet"));
const rates = rooted.map(([h, s]) => {
  const now = terminalHackIntPerSec(s, P);
  const atMin = terminalHackIntPerSec({ ...s, hackDifficulty: s.minDifficulty }, P);
  return { h, req: s.requiredHackingSkill, sec: s.hackDifficulty, min: s.minDifficulty, base: s.baseDifficulty,
    money: s.moneyAvailable, now, atMin, manual: manualHackIntPerSec({ ...s, hackDifficulty: s.minDifficulty }, P) };
}).sort((x, y) => y.atMin.perSec - x.atMin.perSec);
console.log("  host               req   sec/min    t_term(s)  chance  exp/hack  Int/hack  Int/s(min-sec)  Int/s(jetzt)  manualHack Int/s");
for (const r of rates.slice(0, 8)) {
  console.log("  " + r.h.padEnd(18), String(r.req).padStart(4), (r.sec.toFixed(1) + "/" + r.min).padStart(9),
    r.atMin.t.toFixed(3).padStart(10), r.atMin.c.toFixed(3).padStart(7), r.atMin.e.toFixed(2).padStart(9),
    r.atMin.gain.toFixed(3).padStart(9), r.atMin.perSec.toFixed(3).padStart(14), r.now.perSec.toFixed(3).padStart(13),
    r.manual.toExponential(2).padStart(14));
}
const best = rates[0];
// Fuer die Hochrechnung das Erfahrungsofen-Ziel des Bots (joesguns, bn4net.json expZiel): dort haelt
// worker/expfarm.js das Geld oben. Ein leergehacktes Ziel gibt nur exp/4 (hack.ts:66-68).
const farm = rates.find((r) => r.h === "joesguns") || best;
const termH = farm.atMin.perSec * 3600;
const manH = farm.manual * 3600;
console.log("  BESTER Terminal-hack:", best.h, "=", (best.atMin.perSec * 3600).toFixed(0), "Int-exp/h; Ofenziel", farm.h, "=",
  termH.toFixed(0), "Int-exp/h (ohne Eingabe-Overhead, Kette 'hack;hack;...');",
  "manualHack auf", farm.h + ":", manH.toFixed(3), "Int-exp/h");
{
  // leergehacktes Ziel: exp/4
  const s = flat(L.servers[farm.h]);
  const leer = terminalHackIntPerSec({ ...s, hackDifficulty: s.minDifficulty, moneyAvailable: 0 }, P);
  console.log("  dasselbe Ziel mit Geld 0 (exp/4):", (leer.perSec * 3600).toFixed(0), "Int-exp/h");
}

// ---------- Restroute: Terminal-hack-Rate je Knoten ----------
// Gleicher Spieler (Hack-exp, Mults wie heute), Knotenmults aus BitNode/BitNode.tsx (Zeilen im Bericht),
// Sicherheit am Minimum, Ziele = die heute gerooteten Server mit skalierter Startsicherheit (Server.ts:78-83).
console.log("== Restroute: Terminal-hack Int-exp/h je Knoten (GERECHNET_UNGEEICHT, gleicher Spielerstand)");
const NODES = {
  2: { hlm: 0.8, exp: 1, spd: 1, sss: 1 }, 3: { hlm: 0.8, exp: 1, spd: 1, sss: 1 },
  11: { hlm: 0.6, exp: 0.5, spd: 1, sss: 1 }, 6: { hlm: 0.35, exp: 0.25, spd: 1, sss: 1.5 },
  7: { hlm: 0.35, exp: 0.25, spd: 1, sss: 1.5 }, 14: { hlm: 0.4, exp: 1, spd: 0.3, sss: 1.5 },
  13: { hlm: 0.25, exp: 0.1, spd: 1, sss: 3 }, 15: { hlm: 0.6, exp: 1, spd: 0.6, sss: 1.5 },
  8: { hlm: 1, exp: 1, spd: 1, sss: 1 },
};
for (const [n, m] of Object.entries(NODES)) {
  const lvl = calculateSkill(P.exp.hacking, P.mults.hacking * m.hlm);
  const Pn = { ...P, skills: { ...P.skills, hacking: lvl } };
  let top = null;
  for (const [h, s] of rooted) {
    const raw = s.baseDifficulty;               // BN2: ServerStartingSecurity 1, also Rohwert
    const real = raw * m.sss;
    const sn = { ...s, baseDifficulty: Math.min(real, 100), minDifficulty: Math.min(Math.max(1, Math.round(real / 3)), 100) };
    sn.hackDifficulty = sn.minDifficulty;
    if (sn.requiredHackingSkill > lvl) continue;
    const r = terminalHackIntPerSec(sn, Pn, { speed: m.spd, hackExp: m.exp });
    if (!top || r.perSec > top.r.perSec) top = { h, r };
  }
  console.log("  BN" + n.padEnd(3), "Hacklevel", String(lvl).padStart(4), "| bestes Ziel", (top ? top.h : "-").padEnd(16),
    "| Int/hack", top ? top.r.gain.toFixed(2) : "-", "| t", top ? top.r.t.toFixed(2) + " s" : "-",
    "| Int-exp/h", top ? (top.r.perSec * 3600).toFixed(0) : "0");
}

// ---------- Hochrechnung und Wert ----------
const intExp0 = P.exp.intelligence;
const passivH = (b.exp - a.exp) / dh;
console.log("== Hochrechnung (Int-exp konstant je h; konservativ: Hackzeit sinkt in Wahrheit mit Level und Int)");
const bb = flat(P.bladeburner);
const city = bb.cities[bb.city];
const BB = { skills: bb.skills, stamina: bb.maxStamina, maxStamina: bb.maxStamina };
const typh = AKTIONEN["Operation Typhoon"], raid = AKTIONEN.Raid;
const bj = JSON.parse(homeText(L.servers, "data/blade.json") || "null");
const P0 = { skills: { ...P.skills }, mults: P.mults };
const ty0 = successChance(typh, 1, { ...P0, skills: { ...P0.skills } }, { ...BB, stamina: bb.stamina }, city);
console.log("  E3 Typhoon-Chance Stand: soll", bj && bj.boChancen ? bj.boChancen["Operation Typhoon"] : "?", "ist (aktuelle Ausdauer)", ty0.toFixed(4));
const raidLvl = bb.operations && bb.operations.Raid ? bb.operations.Raid.level : 1;
const base = (int) => {
  const sk = { ...P.skills, intelligence: int };
  return {
    ty: successChance(typh, 1, { skills: sk, mults: P.mults }, BB, city),
    raid: successChance(raid, raidLvl, { skills: sk, mults: P.mults }, BB, { ...city, comms: Math.max(1, city.comms) }),
  };
};
const c0 = base(P.skills.intelligence);
for (const hours of [1, 10, 50, 100, 300]) {
  const expT = intExp0 + hours * (termH + passivH);
  const expP = intExp0 + hours * passivH;
  const iT = calculateSkill(expT), iP = calculateSkill(expP);
  const cT = base(iT), cP = base(iP);
  console.log("  nach", String(hours).padStart(3), "h Farm: Int", iP, "->", iT,
    "| hackZeit-Faktor", (intBonus(iT) / intBonus(iP)).toFixed(4),
    "| share x", (intBonus(iT, 2) / intBonus(iP, 2)).toFixed(4),
    "| Typhoon-Chance", cP.ty.toFixed(4), "->", cT.ty.toFixed(4), "(x" + (cT.ty / cP.ty).toFixed(4) + ")",
    "| Raid L" + raidLvl, cP.raid.toFixed(4), "->", cT.raid.toFixed(4), "(x" + (cT.raid / cP.raid).toFixed(4) + ")");
}
// Anteil des Int-Gewichtsterms an der Kompetenz (bei Kampfwerten wie heute und 10x)
for (const scale of [1, 5, 20]) {
  const sk = { ...P.skills };
  for (const st of ["strength", "defense", "dexterity", "agility"]) sk[st] = P.skills[st] * scale;
  const lo = successChance(typh, 1, { skills: { ...sk, intelligence: P.skills.intelligence }, mults: P.mults }, BB, city);
  const hi = successChance(typh, 1, { skills: { ...sk, intelligence: calculateSkill(intExp0 + 100 * (termH + passivH)) }, mults: P.mults }, BB, city);
  console.log("  Kampfwerte x" + scale + ": Typhoon-Kompetenzgewinn durch 100 h Farm x" + (hi / lo).toFixed(4) + " (Chance " + lo.toFixed(4) + " -> " + hi.toFixed(4) + ")");
}

// ---------- Rang/min mit mehr Int (Nachbau der BLADE-Rechnung blade-stadt.mjs, gleiche Formeln) ----------
// Dauerrate je Aktion = Arbeitsanteil(Ausdauer, Kammer) * (p*Rang - (1-p)*Verlust) / Dauer; beste Aktion der
// besten Stadt; Int variiert, sonst alles wie im Spielstand. Nur die Chance haengt an Int (Action.ts:169-196),
// Dauer und Ausdauer nicht (Action.ts:105-122, Bladeburner.ts:1317-1335).
import { actionTime as bbTime, maxStamina as bbMaxSt, staminaGainPerSecond as bbRegen, rankGain as bbRank,
  rankLoss as bbLoss, staminaCost as bbCost } from "./blade-formeln.mjs";
{
  const NAMEN = ["Tracking", "Bounty Hunter", "Retirement", "Investigation", "Undercover Operation", "Sting Operation",
    "Raid", "Stealth Retirement Operation", "Assassination"];
  const lvlOf = (n) => (bb.contracts[n] || bb.operations[n] || { level: 1 }).level;
  const BBf = { skills: bb.skills, stamina: bb.maxStamina, maxStamina: bb.maxStamina, staminaBonus: bb.staminaBonus };
  const rate = (int, kampfFaktor = 1) => {
    const sk = { ...P.skills, intelligence: int };
    for (const st of ["strength", "defense", "dexterity", "agility"]) sk[st] = P.skills[st] * kampfFaktor;
    const Pp = { skills: sk, mults: P.mults };
    const mx = bbMaxSt(Pp, BBf), R = bbRegen(Pp, BBf, mx), H = mx * 0.01 / 60;
    let best = { r: -Infinity };
    for (const [cn, c0] of Object.entries(bb.cities)) {
      const c = { ...c0, comms: c0.comms };
      for (const n of NAMEN) {
        const a = AKTIONEN[n]; const Lv = lvlOf(n);
        const p1 = successChance(a, Lv, Pp, BBf, c);
        const T = bbTime(a, Lv, Pp, BBf);
        const g = p1 * bbRank(a, Lv) - (1 - p1) * bbLoss(a, Lv);
        const v = bbCost(a, Lv) / T;
        const w = v <= R ? 1 : (R + H) / (v + H);
        const r = 60 * w * g / T;
        if (r > best.r) best = { r, n, cn, p: p1 };
      }
    }
    return best;
  };
  console.log("== Rang/min der besten Aktion (Dauerrate, beste Stadt) gegen Int");
  for (const kf of [1, 3]) {
    const r0 = rate(P.skills.intelligence, kf);
    const parts = [];
    for (const hours of [10, 50, 100, 300]) {
      const iT = calculateSkill(intExp0 + hours * (termH + passivH));
      const r1 = rate(iT, kf);
      parts.push(hours + " h -> Int " + iT + ": " + r1.r.toFixed(2) + " (x" + (r1.r / r0.r).toFixed(4) + ", " + r1.n + "/" + r1.cn + ")");
    }
    console.log("  Kampfwerte x" + kf + ": heute Int " + P.skills.intelligence + " " + r0.r.toFixed(2) + " Rang/min (" + r0.n + "/" + r0.cn
      + ", p " + r0.p.toFixed(3) + ") | " + parts.join(" | "));
  }
}
