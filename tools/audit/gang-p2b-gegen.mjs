// P2b Gegenrechnung (Skeptiker Substanz, 04.10.2026).
//
// UNABHAENGIGER Nachbau der Gang-Geldformel, der Ausruestungswirkung, des Territoriums-
// Multiplikators, des Rabatts und der Respekt-/Wanted-Rate - bewusst OHNE Import aus
// gang-formulas.mjs oder gang-p2b-*.mjs (die geprueften Rechner). Alles direkt aus der
// Spielquelle 3.0.2 (reference/bitburner-src/src) abgeschrieben:
//
//   Gang/formulas/formulas.ts:11-13   Wanted-Strafe respect/(respect+wanted)
//   Gang/formulas/formulas.ts:15-31   Respekt je Zyklus (Abzug 4 x difficulty, Faktor 11)
//   Gang/formulas/formulas.ts:33-54   Wanted je Zyklus (Abzug 3,5 x difficulty, Deckel 100)
//   Gang/formulas/formulas.ts:56-73   Geld je Zyklus (Abzug 3,2 x difficulty, Faktor 5,
//                                     Exponent (0,2 T + 0,8) x GangSoftcap)
//   Gang/formulas/formulas.ts:79-81   Aufstiegs-Mult max(1, sqrt(p/2000))
//   Gang/GangMember.ts:70-85          Stufe = max(1, floor(mult x (32 ln(exp+534,5) - 200))),
//                                     mult = Ausruestungs-Mult x Aufstiegs-Mult
//   Gang/GangMember.ts:343-350        Ausruestung multipliziert *_mult
//   Gang/Gang.ts:125-168              Raten je Zyklus; Gang.ts:152-155 Ruf = faction_rep x Respekt x (1+favor/100)/75
//   Gang/Gang.ts:407-416, 429-434     Rabatt und Preis der Ausruestung
//   Gang/data/tasks.ts:297-317 (Human Trafficking), 319-335 (Terrorism), 259-279 (Traffick Illegal Arms)
//   Gang/data/upgrades.ts:34-160      Waffen/Ruestung/Fahrzeuge/Rootkits
//   BitNode/BitNode.tsx:569-592       BN2 setzt GangSoftcap NICHT -> Vorgabe 1 (BitNodeMultipliers.ts:91)
//   Constants: 1 Zyklus = 200 ms -> 5 Zyklen je Spielsekunde (Gang/data/Constants.ts:29-31)
//
// Eichung gegen unabhaengig bekannte Werte im Spielstand:
//   (1) gespeicherte Mitgliederstufen gegen die aus exp/mult/asc_points neu gerechneten,
//   (2) gang.respectGainRate und gang.wantedGainRate (vom Spiel selbst gerechnet) gegen die
//       Summe der neu gerechneten Einzelwerte bei den aktuellen Aufgaben.
// Danach: Human Trafficking je Spielstand, volle Ausruestung, Territorium 0,30/0,32, Rabatt.
//
// Aufruf: node tools/audit/gang-p2b-gegen.mjs [spielstand.json.gz ...] [--live]
// Ohne Argumente: die Backups 07:17, 08:17, 09:17 BN2L1. --live liest getSaveFile (nur lesen).
// Schreibt nichts.
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const SRC = path.join(ROOT, "reference", "bitburner-src", "src");

// ---------------------------------------------------------------------------
// Aufgaben (von Hand aus tasks.ts abgeschrieben) - und unten gegen den Quelltext geprueft
// ---------------------------------------------------------------------------
const TASK = {
  "Human Trafficking": { baseRespect: 0.004, baseWanted: 1.25, baseMoney: 360,
    w: { hack: 30, str: 5, def: 5, dex: 30, agi: 0, cha: 30 }, difficulty: 36, terr: { money: 1.5, respect: 1.5, wanted: 1.6 } },
  "Terrorism": { baseRespect: 0.01, baseWanted: 6, baseMoney: 0,
    w: { hack: 20, str: 20, def: 20, dex: 20, agi: 0, cha: 20 }, difficulty: 36, terr: { money: 1, respect: 2, wanted: 2 } },
  "Traffick Illegal Arms": { baseRespect: 0.0002, baseWanted: 0.24, baseMoney: 174,
    w: { hack: 15, str: 20, def: 20, dex: 20, agi: 0, cha: 25 }, difficulty: 32, terr: { money: 1.4, respect: 1.3, wanted: 1.25 } },
};
// Ausruestung w/a/v/r (upgrades.ts:34-160), Kosten in $
const EQUIP = [
  ["Baseball Bat", 1e6, { str: 1.04, def: 1.04 }], ["Katana", 12e6, { str: 1.08, def: 1.08, dex: 1.08 }],
  ["Malorian-3516", 25e6, { str: 1.1, def: 1.1, dex: 1.1, agi: 1.1 }], ["Hansen-HA7", 50e6, { str: 1.12, def: 1.1, agi: 1.1 }],
  ["Arasaka-HJSH18", 60e6, { str: 1.2, def: 1.15 }], ["Militech-M251s", 100e6, { str: 1.25, def: 1.2 }],
  ["Nokota-D5", 150e6, { str: 1.3, def: 1.25 }], ["Techtronika-SPT32", 225e6, { str: 1.3, dex: 1.25, agi: 1.3 }],
  ["Bulletproof Vest", 2e6, { def: 1.04 }], ["Full Body Armor", 5e6, { def: 1.08 }],
  ["Liquid Body Armor", 25e6, { def: 1.15, agi: 1.15 }], ["Graphene Plating Armor", 40e6, { def: 1.2 }],
  ["Herrera Outlaw GTS", 3e6, { agi: 1.04, cha: 1.04 }], ["Yaiba ASM-R250 Muramasa", 9e6, { agi: 1.08, cha: 1.08 }],
  ["Rayfield Caliburn", 18e6, { agi: 1.12, cha: 1.12 }], ["Quadra Sport R-7", 30e6, { agi: 1.16, cha: 1.16 }],
  ["NUKE Rootkit", 5e6, { hack: 1.05 }], ["Soulstealer Rootkit", 25e6, { hack: 1.1 }], ["Demon Rootkit", 75e6, { hack: 1.15 }],
  ["Hmap Node", 40e6, { hack: 1.12 }], ["Jack the Ripper", 75e6, { hack: 1.15 }],
];
const S6 = ["hack", "str", "def", "dex", "agi", "cha"];

// Gegenprobe der Abschrift gegen den Quelltext (Text-Suche, kein fremder Parser)
function crossCheckSource() {
  const t = fs.readFileSync(path.join(SRC, "Gang", "data", "tasks.ts"), "utf8");
  const u = fs.readFileSync(path.join(SRC, "Gang", "data", "upgrades.ts"), "utf8");
  const bad = [];
  const blockOf = (enumName) => { const i = t.indexOf("name: GangTaskNameEnum." + enumName); return t.slice(i, t.indexOf("\n  },", i)); };
  const map = { "Human Trafficking": "HumanTrafficking", "Terrorism": "Terrorism", "Traffick Illegal Arms": "TraffickIllegalArms" };
  for (const [n, e] of Object.entries(map)) {
    const b = blockOf(e), k = TASK[n];
    const num = (key) => { const m = b.match(new RegExp(key + ":\\s*([0-9.]+)")); return m ? Number(m[1]) : 0; };
    const chk = (key, v) => { if (num(key) !== v) bad.push(n + "." + key + " Quelle " + num(key) + " Abschrift " + v); };
    chk("baseRespect", k.baseRespect); chk("baseWanted", k.baseWanted); chk("baseMoney", k.baseMoney); chk("difficulty", k.difficulty);
    for (const s of S6) chk(s + "Weight", k.w[s]);
    const tm = b.match(/territory:\s*\{\s*money:\s*([0-9.]+),\s*respect:\s*([0-9.]+),\s*wanted:\s*([0-9.]+)/);
    if (!tm || +tm[1] !== k.terr.money || +tm[2] !== k.terr.respect || +tm[3] !== k.terr.wanted) bad.push(n + ".territory");
  }
  for (const [name, cost, mults] of EQUIP) {
    const i = u.indexOf('name: "' + name + '"');
    const b = u.slice(u.lastIndexOf("{", u.lastIndexOf("cost:", i)), i);
    const c = Number((b.match(/cost:\s*([0-9.e]+)/) || [])[1]);
    if (c !== cost) bad.push(name + ".cost " + c);
    for (const [s, v] of Object.entries(mults)) { const m = b.match(new RegExp(s + ":\\s*([0-9.]+)")); if (!m || +m[1] !== v) bad.push(name + "." + s); }
  }
  return bad;
}

// ---------------------------------------------------------------------------
// Formeln (formulas.ts / GangMember.ts)
// ---------------------------------------------------------------------------
const level = (exp, mult) => Math.max(Math.floor(mult * (32 * Math.log(exp + 534.5) - 200)), 1);
const ascMul = (p) => Math.max(Math.sqrt(p / 2000), 1);
const sw = (task, L, sub) => S6.reduce((a, s) => a + (task.w[s] / 100) * L[s], 0) - sub * task.difficulty;
const penalty = (g) => g.respect / (g.respect + g.wanted);
function money(g, L, task, softcap = 1) {
  if (!task.baseMoney) return 0;
  const x = sw(task, L, 3.2);
  if (x <= 0) return 0;
  const tm = Math.max(0.005, Math.pow(g.territory * 100, task.terr.money) / 100);
  return Math.pow(5 * task.baseMoney * x * tm * penalty(g), (0.2 * g.territory + 0.8) * softcap);
}
function respect(g, L, task, softcap = 1) {
  if (!task.baseRespect) return 0;
  const x = sw(task, L, 4);
  if (x <= 0) return 0;
  const tm = Math.max(0.005, Math.pow(g.territory * 100, task.terr.respect) / 100);
  return Math.pow(11 * task.baseRespect * x * tm * penalty(g), (0.2 * g.territory + 0.8) * softcap);
}
function wanted(g, L, task) {
  if (!task.baseWanted) return 0;
  const x = sw(task, L, 3.5);
  if (x <= 0) return 0;
  const tm = Math.max(0.005, Math.pow(g.territory * 100, task.terr.wanted) / 100);
  if (task.baseWanted < 0) return 0.4 * task.baseWanted * x * tm;
  return Math.min(100, (7 * task.baseWanted) / Math.pow(3 * x * tm, 0.8));
}
// Stufen eines Mitglieds mit Zusatz-Ausruestung (Mult-Faktoren je Wert)
function levelsWith(m, extra = {}) {
  const L = {};
  for (const s of S6) L[s] = level(m[s + "_exp"], m[s + "_mult"] * (extra[s] || 1) * ascMul(m[s + "_asc_points"]));
  return L;
}
const discountOf = (respectV, power) => Math.max(1, Math.pow(respectV, 0.01) + respectV / 5e6 + Math.pow(power, 0.01) + power / 1e6 - 1);

// ---------------------------------------------------------------------------
// Spielstand lesen (eigener Leser)
// ---------------------------------------------------------------------------
async function readSave(src) {
  let buf;
  if (src === "LIVE") {
    const url = "http://localhost:8795/api/rpc?" + new URLSearchParams({ method: "getSaveFile", instance: "LIVE" });
    const body = await (await fetch(url, { signal: AbortSignal.timeout(30000) })).json();
    if (body.error) throw new Error(body.error);
    buf = Buffer.from(body.result.save, "latin1");
  } else buf = fs.readFileSync(src);
  const s = JSON.parse(zlib.gunzipSync(buf).toString("utf8"));
  const p = JSON.parse(s.data.PlayerSave).data;
  const gang = p.gang.data;
  // B8 (P2d-Skeptiker 04.10.2026): die Gang-Faktion aus dem Spielstand, nicht fest "Slum Snakes".
  const facName = gang.facName;
  const fac = JSON.parse(s.data.FactionsSave)[facName];
  // Der Spielstand laesst Felder mit Vorgabewert weg: bei Favor 0 fehlt `favor` (daher ?? 0 unten).
  const facD = fac.data || fac;
  const all = JSON.parse(s.data.AllGangsSave);
  const bb = p.bladeburner ? (p.bladeburner.data || p.bladeburner) : null;
  return { label: src === "LIVE" ? "LIVE" : path.basename(src).replace(/^LIVE_[0-9a-f]+_/, "").replace(/\.json\.gz$/, ""),
    p, gang, facName, members: gang.members.map((x) => x.data), favor: facD.favor ?? 0, rep: facD.playerReputation, all,
    pt: p.totalPlaytime, frm: p.mults.faction_rep, rank: bb ? bb.rank : null, bo: bb ? bb.numBlackOpsComplete : null };
}

const f2 = (x, d = 2) => (Number.isFinite(x) ? x.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d }) : String(x));

function analyse(S) {
  const g = { respect: S.gang.respect, wanted: S.gang.wanted, territory: S.all[S.facName].territory };
  const out = { facName: S.facName, label: S.label, pt: S.pt, rank: S.rank, bo: S.bo, rep: S.rep, respect: g.respect, wanted: g.wanted, members: S.members.length };
  // (1) Stufen
  let lvlDiff = 0;
  for (const m of S.members) { const L = levelsWith(m); for (const s of S6) lvlDiff += Math.abs(L[s] - m[s]); }
  out.lvlDiff = lvlDiff;
  // (2) Raten bei den aktuellen Aufgaben
  let r = 0, wv = 0, mo = 0, unknown = 0;
  for (const m of S.members) {
    const t = TASK[m.task];
    if (!t) { unknown++; continue; }
    const L = { hack: m.hack, str: m.str, def: m.def, dex: m.dex, agi: m.agi, cha: m.cha };
    r += respect(g, L, t); wv += wanted(g, L, t); mo += money(g, L, t);
  }
  out.unknownTasks = unknown;
  out.respRateGame = S.gang.respectGainRate; out.respRateMine = r;
  out.wantRateGame = S.gang.wantedGainRate; out.wantRateMine = wv;
  out.moneyRateGame = S.gang.moneyGainRate; out.moneyRateMine = mo;
  out.repPerS = (S.frm * r * (1 + S.favor / 100) / 75) * 5;
  out.repPerS_favor0 = (S.frm * r / 75) * 5;
  // (3) Human Trafficking, alle 12, jetzt
  const HT = TASK["Human Trafficking"], TIA = TASK["Traffick Illegal Arms"], TER = TASK["Terrorism"];
  const prod = {}; for (const s of S6) prod[s] = 1;
  for (const [, , mu] of EQUIP) for (const [s, v] of Object.entries(mu)) prod[s] *= v;
  out.equipProd = prod;
  const sumOver = (fn) => S.members.reduce((a, m) => a + fn(m), 0);
  const htNow = sumOver((m) => money(g, levelsWith(m), HT));
  const tiaNow = sumOver((m) => money(g, levelsWith(m), TIA));
  const htEq = sumOver((m) => money(g, levelsWith(m, prod), HT));
  const g30 = { ...g, territory: 0.30 }, g32 = { ...g, territory: 0.32 };
  out.ht = { perS: htNow * 5, mrdPerH: htNow * 5 * 3600 / 1e9 };
  out.tia = { perS: tiaNow * 5 };
  out.htEquip = { perS: htEq * 5, mrdPerH: htEq * 5 * 3600 / 1e9, ratio: htEq / htNow };
  out.htT30 = sumOver((m) => money(g30, levelsWith(m), HT)) / htNow;
  out.htT32 = sumOver((m) => money(g32, levelsWith(m), HT)) / htNow;
  out.htEqT32 = sumOver((m) => money(g32, levelsWith(m, prod), HT)) / htNow;
  // Respekt/Ruf, wenn alle auf HT statt Terrorism
  out.respHT = sumOver((m) => respect(g, levelsWith(m), HT)) * 5;
  out.respTER = sumOver((m) => respect(g, levelsWith(m), TER)) * 5;
  // Ausruestung in der RESPEKT-Phase (Terrorism): Faktor auf Respekt und damit auf den Faktionsruf
  out.respTEReq = sumOver((m) => respect(g, levelsWith(m, prod), TER)) * 5;
  // nur die billigen Stuecke (<= 25 Mio Grundpreis): Wirkung und Preis
  const cheap = {}; for (const s of S6) cheap[s] = 1;
  let cheapCost = 0;
  for (const [, c, mu] of EQUIP) if (c <= 25e6) { cheapCost += c; for (const [s, v] of Object.entries(mu)) cheap[s] *= v; }
  out.respTERcheap = sumOver((m) => respect(g, levelsWith(m, cheap), TER)) * 5;
  out.cheapCostRaw = cheapCost;
  // statWeight-Anteile eines typischen Mitglieds
  const m0 = S.members[0];
  out.m0 = { L: levelsWith(m0), Leq: levelsWith(m0, prod), swHT: sw(HT, levelsWith(m0), 3.2), swHTeq: sw(HT, levelsWith(m0, prod), 3.2) };
  // (4) Rabatt und Ausruestungspreis fuer alle Mitglieder
  const power = S.all[S.facName].power;
  const d = discountOf(g.respect, power);
  const setCost = EQUIP.reduce((a, [, c]) => a + c, 0);
  out.discount = d; out.setCostRaw = setCost; out.fullCost = setCost * S.members.length / d;
  out.npc = Object.fromEntries(Object.entries(S.all).map(([k, v]) => [k, { power: v.power, territory: v.territory }]));
  return out;
}

const argv = process.argv.slice(2);
const files = argv.filter((a) => !a.startsWith("--"));
const list = files.length ? files : ["2026-10-04T07-17_hourly", "2026-10-04T08-17_hourly", "2026-10-04T09-17_hourly"]
  .map((k) => path.join(ROOT, "backups", "LIVE_197f4d61481686_BN2L1_" + k + ".json.gz"));
if (argv.includes("--live")) list.push("LIVE");

const bad = crossCheckSource();
console.log("Abschrift gegen Quelltext (tasks.ts/upgrades.ts):", bad.length ? "ABWEICHUNG " + bad.join("; ") : "0 Abweichungen");
for (const f of list) {
  const S = await readSave(f);
  const a = analyse(S);
  console.log("\n== " + a.label + "  pt " + a.pt + "  Rang " + f2(a.rank, 0) + "  BlackOps " + a.bo + "  Mitglieder " + a.members
    + "  Respekt " + f2(a.respect, 0) + "  Wanted " + f2(a.wanted, 0) + "  Ruf " + f2(a.rep, 0));
  console.log("  (1) Stufen neu gerechnet gegen gespeichert: Summe |Diff| = " + a.lvlDiff + (a.unknownTasks ? "  (Aufgaben ausserhalb der Tabelle: " + a.unknownTasks + ")" : ""));
  const dev = (x, y) => (y ? f2((x / y - 1) * 100, 4) + " %" : "-");
  console.log("  (2) Respekt/Zyklus Spiel " + f2(a.respRateGame, 4) + "  neu " + f2(a.respRateMine, 4) + "  Abw " + dev(a.respRateMine, a.respRateGame)
    + " | Wanted/Zyklus Spiel " + f2(a.wantRateGame, 5) + "  neu " + f2(a.wantRateMine, 5) + "  Abw " + dev(a.wantRateMine, a.wantRateGame)
    + " | Geld/Zyklus Spiel " + f2(a.moneyRateGame, 0) + "  neu " + f2(a.moneyRateMine, 0));
  console.log("      Ruf/s aus Respekt (Favor wie im Stand) " + f2(a.repPerS, 1) + "  | bei Favor 0: " + f2(a.repPerS_favor0, 1));
  console.log("  (3) Human Trafficking alle " + a.members + ": " + f2(a.ht.perS, 0) + " $/s = " + f2(a.ht.mrdPerH, 2) + " Mrd/h"
    + "  | Traffick Illegal Arms " + f2(a.tia.perS, 0) + " $/s");
  console.log("      volle w/a/v/r-Ausruestung: " + f2(a.htEquip.perS, 0) + " $/s = " + f2(a.htEquip.mrdPerH, 2) + " Mrd/h, Faktor x" + f2(a.htEquip.ratio, 3)
    + "  (Mult-Produkt hack " + f2(a.equipProd.hack, 3) + " str " + f2(a.equipProd.str, 3) + " def " + f2(a.equipProd.def, 3)
    + " dex " + f2(a.equipProd.dex, 3) + " agi " + f2(a.equipProd.agi, 3) + " cha " + f2(a.equipProd.cha, 3) + ")");
  console.log("      Territorium 0,30: x" + f2(a.htT30, 3) + "  0,32: x" + f2(a.htT32, 3) + "  Ausruestung + 0,32: x" + f2(a.htEqT32, 3));
  console.log("      Respekt/s alle Terrorism " + f2(a.respTER, 0) + "  alle HT " + f2(a.respHT, 0)
    + " | Terrorism mit voller Ausruestung " + f2(a.respTEReq, 0) + " (x" + f2(a.respTEReq / a.respTER, 3) + ")"
    + ", nur Stuecke <= 25 Mio (" + f2(a.cheapCostRaw / 1e6, 0) + " Mio roh je Mitglied, alle " + f2(a.cheapCostRaw * a.members / a.discount / 1e9, 3) + " Mrd) " + f2(a.respTERcheap, 0) + " (x" + f2(a.respTERcheap / a.respTER, 3) + ")");
  console.log("      Mitglied " + S.members[0].name + ": Stufen " + JSON.stringify(a.m0.L) + " statWeight(HT) " + f2(a.m0.swHT, 1)
    + " | mit Ausruestung " + JSON.stringify(a.m0.Leq) + " statWeight " + f2(a.m0.swHTeq, 1));
  console.log("  (4) Rabatt " + f2(a.discount, 3) + "  Satz je Mitglied roh " + f2(a.setCostRaw / 1e6, 0) + " Mio  -> alle " + a.members + " Mitglieder " + f2(a.fullCost / 1e9, 3) + " Mrd");
  console.log("      NPC: " + Object.entries(a.npc).filter(([k, v]) => v.territory > 0 || k === a.facName).map(([k, v]) => k + " P " + f2(v.power, 1) + " T " + f2(v.territory, 4)).join(" | "));
}
