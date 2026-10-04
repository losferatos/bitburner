// G09-Betrieb, Teil E: Referenz-Entscheider fuer die Sleeve-Belegung in V2 (Bauvorgabe als ausfuehrbarer Code).
//
// ZWEI reine Funktionen, beide ohne ns:
//   aktuell(lage)   bildet src/sleeve.js:726-852 (Stand master) 1:1 nach: laeuftSchon -> D5 -> Vertraege -> Infiltrate -> Gym
//   vorschlag(lage) die Regel, die der Bauer in src/sleeve.js einbauen soll
// EICHUNG von aktuell() gegen zwei echte Entscheidungen (Soll = Spielstand danach, Ist = aktuell()):
//   Einbau 04.10. 07:05 -> 07:17 : Tracking / Retirement / Bounty Hunter (Vorrat 820/753/629 -> nach Vorrat sortiert)
//   Einbau 03.10. 19:01 -> 19:17 : drei mal Infiltrate (Raid-Vorrat 244 < 400, istAktion Operations/Raid, D5)
// Danach: Szenarien (gruen/rot), Wiederholung der echten BN2.1-Reihe durch beide Regeln.
// Aufruf: node tools/audit/verify-g09-betrieb-entscheider.mjs      (Exit 1 bei rotem Vorschlag-Szenario)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ladeSpielstand, homeDatei, flach } from "./blade-lage.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// ---------------------------------------------------------------------------
// Lage (alle Felder Pflicht):
//   inDivision  bool
//   rek         Index des Rekrutierers oder -1
//   op          { name, rest } der vorratsgebundenen Operation (Gedaechtnis 10 min) oder null
//   istOp       bool: laeuft die Spieler-Operation JETZT (das einzige Signal, das aktuell() kennt)
//   chaos       Chaos der Spielerstadt aus blade.json (frisch) oder null
//   aufraeumen  blade.json.aufraeumen
//   vorrat      { Tracking, "Bounty Hunter", Retirement }  (Vertragsvorrat)
//   sleeves     [{ nr, kampf, task }]  task: GYM | VERTRAG:<art> | INFILTRATE | DIPLOMACY | REKRUTIEREN | RECOVERY | NULL
// Rueckgabe: je Sleeve eine Aufgabe in derselben Schreibweise (BEHALTEN wird ausgeschrieben).

const KONTRAKTE = ["Tracking", "Bounty Hunter", "Retirement"];
const MIN_KAMPF = 40;                       // src/sleeve.js:626
const OP_VERBRAUCH = 200, OP_RUNWAY_H = 2;   // src/sleeve.js:710-711

export function aktuell(lage) {
  const out = [];
  const belegt = new Set();   // Vertragsarten, die ein anderer Sleeve schon faehrt (Spiel wirft sonst)
  for (const s of lage.sleeves) if (s.task.startsWith("VERTRAG:")) belegt.add(s.task.slice(8));
  const erlaubt = lage.aufraeumen ? ["Tracking"] : KONTRAKTE;
  // D5-Signal: nur wenn JETZT eine Operation laeuft UND der Vorrat < 200/h * 2 h  (sleeve.js:713-725)
  const knapp = lage.istOp && lage.op && lage.op.rest < OP_VERBRAUCH * OP_RUNWAY_H;
  for (const s of lage.sleeves) {
    let aufgabe;
    const laeuftSchon = lage.inDivision && ((s.task.startsWith("VERTRAG:") && erlaubt.includes(s.task.slice(8))) || s.task === "INFILTRATE");
    if (lage.rek === s.nr) aufgabe = "REKRUTIEREN";
    else if (laeuftSchon) aufgabe = s.task;
    else if (lage.inDivision && s.kampf >= MIN_KAMPF) {
      aufgabe = null;
      if (!knapp) {
        const nachVorrat = erlaubt.map((a) => ({ a, v: lage.vorrat[a] })).sort((x, y) => y.v - x.v);
        for (const { a, v } of nachVorrat) {
          if (v < 2 || belegt.has(a)) continue;
          aufgabe = "VERTRAG:" + a; belegt.add(a); break;
        }
      }
      if (!aufgabe) aufgabe = "INFILTRATE";
    } else aufgabe = "GYM";
    out.push(aufgabe);
  }
  return out;
}

// ---------------------------------------------------------------------------
// DER VORSCHLAG. Zustandslos: Hysterese steht im Zustand der Sleeves selbst (wer schon Infiltrate/Diplomacy faehrt, ist
// "im Modus"). Dadurch gibt es nach einem Neustart von sleeve.js keinen Zustand, der verloren ginge.
export const P = {
  CHAOS_EIN: 32, CHAOS_AUS: 16,              // 32 -> 50 sind ln 0,45 = 21 Minuten bei 41 Raids/h (+1,23 ln/h): Luft fuer Verzug
  N_DIPLO: 2,                                // LP I1D2 (328 Rang/h); ein dritter bringt nichts (I0D3 167)
  N_INFIL: 1,                                // LP: 1 = 2 = 3 Infiltrate (252/266/328 identisch), weil 45,3/h Zufluss > Raid-Maximum 41-46/h
  RUNWAY_H: 1.5,
  VERBRAUCH: { Raid: 45 },                   // Versuche/h: gemessen 37 (BN2.1) / 40 (BN2.2); Maximum 3600/77 = 46,8
  VERBRAUCH_STANDARD: 200,                   // Assassination & Co: wie bisher (sleeve.js:710)
  FREI_FAKTOR: 3,                            // Freigabe erst ab dem Dreifachen der Einschaltschwelle (Hysterese)
};
const schwelle = (opName) => P.RUNWAY_H * (P.VERBRAUCH[opName] ?? P.VERBRAUCH_STANDARD);

export function vorschlag(lage) {
  const n = lage.sleeves.length;
  const out = new Array(n).fill(null);
  const frei = [];   // Indizes, die nicht Rekrutierer sind
  for (let i = 0; i < n; i++) {
    if (lage.rek === lage.sleeves[i].nr) out[i] = "REKRUTIEREN"; else frei.push(i);
  }
  const hatDipl = frei.some((i) => lage.sleeves[i].task === "DIPLOMACY");
  const hatInfil = frei.some((i) => lage.sleeves[i].task === "INFILTRATE");
  const chaosFrisch = lage.inDivision && Number.isFinite(lage.chaos);
  const diploModus = chaosFrisch && (lage.chaos >= P.CHAOS_EIN || (hatDipl && lage.chaos > P.CHAOS_AUS));
  let infilModus = false;
  if (lage.inDivision && lage.op) {
    const s = schwelle(lage.op.name);
    infilModus = lage.op.rest < s || (hatInfil && lage.op.rest <= s * P.FREI_FAKTOR);
  }
  // Rollen vergeben: Sleeves mit dem NIEDRIGSTEN Kampfwert zuerst (sie sind am weitesten vom Vertragsfaehigen weg),
  // Amtsinhaber der Rolle vor Neulingen (kein Neusetzen -> kein cyclesWorked-Verlust).
  const sortiert = frei.slice().sort((a, b) => lage.sleeves[a].kampf - lage.sleeves[b].kampf);
  const nimm = (rolle, anzahl) => {
    const inhaber = sortiert.filter((i) => out[i] === null && lage.sleeves[i].task === rolle);
    const rest = sortiert.filter((i) => out[i] === null && lage.sleeves[i].task !== rolle);
    for (const i of [...inhaber, ...rest]) { if (anzahl <= 0) break; out[i] = rolle; anzahl--; }
  };
  if (diploModus) nimm("DIPLOMACY", P.N_DIPLO);
  if (infilModus) nimm("INFILTRATE", P.N_INFIL);
  // Rest: wie bisher (Vertraege ab Kampfwert 40 nach Vorrat, sonst Gym); laufende Vertraege bleiben
  const belegt = new Set();
  for (const i of frei) if (out[i] === null && lage.sleeves[i].task.startsWith("VERTRAG:")) belegt.add(lage.sleeves[i].task.slice(8));
  const erlaubt = lage.aufraeumen ? ["Tracking"] : KONTRAKTE;
  for (const i of frei) {
    if (out[i] !== null) continue;
    const s = lage.sleeves[i];
    if (lage.inDivision && s.kampf >= MIN_KAMPF) {
      if (s.task.startsWith("VERTRAG:") && erlaubt.includes(s.task.slice(8))) { out[i] = s.task; continue; }
      const nachVorrat = erlaubt.map((a) => ({ a, v: lage.vorrat[a] })).sort((x, y) => y.v - x.v);
      let a = null;
      for (const c of nachVorrat) { if (c.v < 2 || belegt.has(c.a)) continue; a = c.a; belegt.add(a); break; }
      // kein Vertrag da: im Raid-/Chaos-Betrieb nicht einfach Infiltrate (das waere der Fehler von aktuell()), sondern
      // wartende Rolle = Infiltrate NUR wenn infilModus; sonst Field Analysis waere 12 Rang/h -> hier schlicht Infiltrate (selbstbegrenzend)
      out[i] = a ? "VERTRAG:" + a : "INFILTRATE";
    } else out[i] = "GYM";
  }
  return out;
}

// ---------------------------------------------------------------------------
// Hilfen fuer die Spielstand-Wiederholung
function taskVon(w) {
  if (!w) return "NULL";
  const c = w.ctor, d = w.data || {};
  if (c === "SleeveClassWork") return "GYM";
  if (c === "SleeveInfiltrateWork") return "INFILTRATE";
  if (c === "SleeveRecoveryWork") return "RECOVERY";
  if (c === "SleeveBladeburnerWork") {
    const a = d.actionId || {};
    if (a.type === "Contracts" || a.type === "Contract") return "VERTRAG:" + a.name;
    if (a.name === "Recruitment") return "REKRUTIEREN";
    if (a.name === "Diplomacy") return "DIPLOMACY";
    return "BB:" + a.name;
  }
  return c;
}
function lageAus(datei, optionen = {}) {
  const { save, p, servers } = (() => { const r = ladeSpielstand(datei); return { save: r.save, p: r.p, servers: r.servers }; })();
  const bb = flach(p.bladeburner);
  const bj = JSON.parse(homeDatei(servers, "data/blade.json") || "null") || {};
  const city = bb.cities[bb.city];
  const sl = (p.sleeves || []).map((s0, nr) => {
    const s = flach(s0); const k = s.skills;
    return { nr, kampf: Math.min(k.strength, k.defense, k.dexterity, k.agility), task: optionen.tasks ? optionen.tasks : taskVon(s0.data ? s0.data.currentWork : s0.currentWork) };
  });
  const ops = bb.operations, con = bb.contracts;
  const raidRest = ops.Raid.count;
  const ist = typeof bj.istAktion === "string" ? bj.istAktion : null;
  const istOp = !!ist && ist.startsWith("Operations/");
  // vorratsgebundene Operation: die laufende Operation, sonst die zuletzt bekannte (hier: Raid, solange Raid die Hauptoperation ist)
  const opName = istOp ? ist.slice("Operations/".length) : "Raid";
  return {
    inDivision: true, rek: -1, istOp,
    op: { name: opName, rest: ops[opName] ? ops[opName].count : raidRest },
    chaos: city.chaos, aufraeumen: bj.aufraeumen === true,
    vorrat: { Tracking: con.Tracking.count, "Bounty Hunter": con["Bounty Hunter"].count, Retirement: con.Retirement.count },
    sleeves: sl, _meta: { ist, raid: raidRest, hp: p.bitNodeN },
  };
}
const B = (n) => path.join(root, "backups", "LIVE_197f4d61481686_" + n + ".json.gz");
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let rot = 0, gruen = 0;
const pruefe = (was, ok, zusatz = "") => { if (ok) { gruen++; console.log("  ok    " + was + (zusatz ? "  (" + zusatz + ")" : "")); } else { rot++; console.log("  ROT   " + was + (zusatz ? " - " + zusatz : "")); } };

// ---------------------------------------------------------------------------
console.log("=== EICHUNG aktuell() gegen zwei echte Entscheidungen (Einbau -> naechster Takt) ===");
{
  // 04.10. 07:05 pre-install: Sleeves danach im Zustand RECOVERY (PlayerObjectGeneralMethods.ts:118-120), Entscheidung aus den Vorraeten
  const L = lageAus(B("BN2L1_2026-10-04T07-05_pre-install"), { tasks: "RECOVERY" });
  const soll = ["VERTRAG:Tracking", "VERTRAG:Retirement", "VERTRAG:Bounty Hunter"];   // Spielstand 07:17
  const ist = aktuell(L);
  console.log(`  Stand 07:05: Vorrat Trk ${L.vorrat.Tracking.toFixed(0)} / BH ${L.vorrat["Bounty Hunter"].toFixed(0)} / Ret ${L.vorrat.Retirement.toFixed(0)}, Raid-Vorrat ${L.op.rest.toFixed(0)}, istAktion ${L._meta.ist}, Kampf ${L.sleeves.map((s) => s.kampf)}`);
  console.log(`  Soll (Spielstand 07:17) ${soll.join(" | ")}\n  Ist  (aktuell())        ${ist.join(" | ")}`);
  pruefe("07:05 -> 07:17: aktuell() trifft die echte Belegung", gleich(soll, ist));
  const L2 = lageAus(B("BN2L1_2026-10-03T19-01_pre-install"), { tasks: "RECOVERY" });
  const ist2 = aktuell(L2);
  console.log(`  Stand 19:01: Raid-Vorrat ${L2.op.rest.toFixed(0)}, istAktion ${L2._meta.ist}, Kampf ${L2.sleeves.map((s) => s.kampf)}`);
  console.log(`  Soll (Spielstand 19:17) INFILTRATE x3\n  Ist  (aktuell())        ${ist2.join(" | ")}`);
  pruefe("19:01 -> 19:17: aktuell() trifft die echte Belegung (D5)", gleich(ist2, ["INFILTRATE", "INFILTRATE", "INFILTRATE"]));
}

// ---------------------------------------------------------------------------
console.log("\n=== SZENARIEN: aktuell() gegen vorschlag() ===");
const S3 = (k, t = "GYM") => [0, 1, 2].map((nr) => ({ nr, kampf: k, task: t }));
const basis = { inDivision: true, rek: -1, istOp: true, op: { name: "Raid", rest: 107 }, chaos: 5, aufraeumen: false,
  vorrat: { Tracking: 58, "Bounty Hunter": 146, Retirement: 155 }, sleeves: S3(24) };
const szen = [];
const sz = (name, lageTeil, erwartetVorschlag, erwartetAktuell = null) => szen.push({ name, lage: { ...basis, ...lageTeil }, erwartetVorschlag, erwartetAktuell });

sz("S1 BN2.2 jetzt (13:17): Raid-Vorrat 107, Kampf 24, kein Mangel -> Gym bleibt", {}, ["GYM", "GYM", "GYM"], ["GYM", "GYM", "GYM"]);
sz("S2 BN2.1 07:33 Hunger: Vorrat 0,7, Kampf 26 -> EIN Infiltrate, zwei bleiben im Gym", { op: { name: "Raid", rest: 0.7 }, sleeves: S3(26) }, ["INFILTRATE", "GYM", "GYM"], ["GYM", "GYM", "GYM"]);
sz("S3 BN2.2 in ~1,5 h: Kampf 40, Raid-Vorrat 65 -> 1 Infiltrate + 2 Vertraege (nicht dreimal Infiltrate)",
  { op: { name: "Raid", rest: 65 }, sleeves: S3(40) }, ["INFILTRATE", "VERTRAG:Retirement", "VERTRAG:Bounty Hunter"], ["INFILTRATE", "INFILTRATE", "INFILTRATE"]);
sz("S4 Chaos 36 im Raid-Betrieb, Vorrat reichlich (339), Kampf 40 -> 2 Diplomacy, Rest Vertrag",
  { chaos: 36, op: { name: "Raid", rest: 339 }, sleeves: S3(40) }, ["DIPLOMACY", "DIPLOMACY", "VERTRAG:Retirement"], null);
sz("S5 Chaos 48, Vorrat 40 (knapp) -> 2 Diplomacy + 1 Infiltrate (LP I1D2)",
  { chaos: 48, op: { name: "Raid", rest: 40 }, sleeves: S3(40) }, ["DIPLOMACY", "DIPLOMACY", "INFILTRATE"], null);
sz("S6 Diplomacy-Sleeves im Amt, Chaos 24 (zwischen AUS 16 und EIN 32) -> bleiben (Hysterese)",
  { chaos: 24, op: { name: "Raid", rest: 339 }, sleeves: [{ nr: 0, kampf: 40, task: "DIPLOMACY" }, { nr: 1, kampf: 40, task: "DIPLOMACY" }, { nr: 2, kampf: 40, task: "VERTRAG:Retirement" }] },
  ["DIPLOMACY", "DIPLOMACY", "VERTRAG:Retirement"], null);
sz("S7 Diplomacy im Amt, Chaos 14 (< AUS) -> frei, beide gehen auf Vertrag/Infiltrate (kein Gym: Kampf 40)",
  { chaos: 14, op: { name: "Raid", rest: 339 }, sleeves: [{ nr: 0, kampf: 40, task: "DIPLOMACY" }, { nr: 1, kampf: 40, task: "DIPLOMACY" }, { nr: 2, kampf: 40, task: "VERTRAG:Retirement" }] },
  ["VERTRAG:Bounty Hunter", "VERTRAG:Tracking", "VERTRAG:Retirement"], null);
sz("S8 Chaos 34, Sleeves NICHT im Amt, Kampf 12 (Gym) -> Diplomacy darf aus dem Gym heraus (kein Kampfwert noetig)",
  { chaos: 34, sleeves: S3(12) }, ["DIPLOMACY", "DIPLOMACY", "GYM"], null);
sz("S9 Infiltrate im Amt, Vorrat 120 (zwischen 67 und 200) -> bleibt (Hysterese); der Rest wie bisher",
  { op: { name: "Raid", rest: 120 }, sleeves: [{ nr: 0, kampf: 20, task: "INFILTRATE" }, { nr: 1, kampf: 20, task: "GYM" }, { nr: 2, kampf: 20, task: "GYM" }] },
  ["INFILTRATE", "GYM", "GYM"], null);
sz("S10 Infiltrate im Amt, Vorrat 260 (> 3 x 67) -> FREIGABE, zurueck ins Gym (Kampf 20); aktuell() klebt",
  { op: { name: "Raid", rest: 260 }, sleeves: [{ nr: 0, kampf: 20, task: "INFILTRATE" }, { nr: 1, kampf: 20, task: "GYM" }, { nr: 2, kampf: 20, task: "GYM" }] },
  ["GYM", "GYM", "GYM"], ["INFILTRATE", "GYM", "GYM"]);
sz("S11 Rekrutierer 0 (Truppanfrage) hat Vorrang vor Diplomacy/Infiltrate",
  { rek: 0, chaos: 48, op: { name: "Raid", rest: 40 }, sleeves: S3(40) }, ["REKRUTIEREN", "DIPLOMACY", "DIPLOMACY"], null);
sz("S12 Op-Phase: Assassination-Vorrat 794 (> 400), Chaos 20 -> Vertraege wie bisher, kein Infiltrate",
  { op: { name: "Assassination", rest: 794 }, chaos: 20, vorrat: { Tracking: 2.4, "Bounty Hunter": 3.9, Retirement: 2.0 }, sleeves: S3(51) },
  ["VERTRAG:Bounty Hunter", "VERTRAG:Tracking", "VERTRAG:Retirement"], null);
sz("S13 blade.json veraltet (chaos null), Vorrat reichlich -> keine Diplomacy (Rueckfall = altes Verhalten)",
  { chaos: null, op: { name: "Raid", rest: 339 }, sleeves: S3(40) }, ["VERTRAG:Retirement", "VERTRAG:Bounty Hunter", "VERTRAG:Tracking"], null);
for (const z of szen) {
  const v = vorschlag(z.lage);
  pruefe(z.name, gleich(v, z.erwartetVorschlag), "Vorschlag " + v.join(",") + (gleich(v, z.erwartetVorschlag) ? "" : " erwartet " + z.erwartetVorschlag.join(",")));
  if (z.erwartetAktuell) {
    const a = aktuell(z.lage);
    pruefe("      aktuell() zur Gegenprobe: " + z.erwartetAktuell.join(","), gleich(a, z.erwartetAktuell), "Ist " + a.join(","));
  }
}

// ---------------------------------------------------------------------------
console.log("\n=== FLATTERPROBE: Zufallsverlauf von Chaos und Vorrat, Wechsel je Sleeve und Stunde (Takt 60 s) ===");
{
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const wechsel = [0, 0, 0]; let tasks = [0, 1, 2].map((nr) => ({ nr, kampf: 40, task: "VERTRAG:Retirement" }));
  let chaos = 20, rest = 150;
  const TAKTE = 600;   // 10 h
  for (let t = 0; t < TAKTE; t++) {
    chaos = Math.max(0, chaos * Math.exp((rnd() - 0.45) * 0.08));            // Zufallsgang um die Schwellen
    rest = Math.max(0, rest + (rnd() - 0.5) * 8);
    const lage = { ...basis, chaos, op: { name: "Raid", rest }, sleeves: tasks, vorrat: { Tracking: 80, "Bounty Hunter": 80, Retirement: 80 } };
    const neu = vorschlag(lage);
    for (let i = 0; i < 3; i++) { if (neu[i] !== tasks[i].task && !(neu[i].startsWith("VERTRAG") && tasks[i].task.startsWith("VERTRAG"))) wechsel[i]++; }
    tasks = tasks.map((s, i) => ({ ...s, task: neu[i] }));
  }
  console.log(`  Wechsel Diplomacy/Infiltrate/Vertrag je Sleeve in 10 h: ${wechsel.join(" / ")}  (Zufallsgang um beide Schwellen)`);
  pruefe("kein Sleeve wechselt mehr als 12 mal in 10 h", wechsel.every((w) => w <= 12));
}

// ---------------------------------------------------------------------------
console.log("\n=== WIEDERHOLUNG der echten BN2.1-Reihe: Belegung im Spielstand (alte Regel) gegen vorschlag() ===");
{
  const reihe = ["BN2L1_2026-10-03T05-33_hourly", "BN2L1_2026-10-03T06-33_hourly", "BN2L1_2026-10-03T07-33_hourly", "BN2L1_2026-10-03T08-33_hourly",
    "BN2L1_2026-10-03T09-19_pre-hotswap", "BN2L1_2026-10-03T09-46_connect", "BN2L1_2026-10-03T09-59_pre-hotswap", "BN2L1_2026-10-03T19-17_hourly",
    "BN2L1_2026-10-03T22-17_hourly", "BN2L1_2026-10-04T02-17_hourly", "BN2L2_2026-10-04T13-17_hourly"];
  for (const n of reihe) {
    const L = lageAus(B(n));
    L.istOp = true;   // Raid ist die Hauptoperation dieser Phase; Gedaechtnis 10 min deckt das Abwechseln mit Vertrag/Kammer ab
    L.op = { name: "Raid", rest: L._meta.raid };
    const v = vorschlag(L);
    const alt = L.sleeves.map((s) => s.task).map((t) => t.replace("VERTRAG:", "V:").slice(0, 12));
    console.log(`  ${n.slice(5, 30).padEnd(26)} Raid ${String(L._meta.raid.toFixed(0)).padStart(4)} Chaos ${L.chaos.toFixed(0).padStart(3)} Kampf ${L.sleeves.map((s) => s.kampf)} | alt ${alt.join("/").padEnd(40)} | Vorschlag ${v.map((t) => t.replace("VERTRAG:", "V:").slice(0, 12)).join("/")}`);
  }
}
console.log(`\n=== ${gruen} gruen, ${rot} rot ===`);
process.exit(rot ? 1 : 0);
