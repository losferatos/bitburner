/**
 * blade.js: Raid in der ausgebrannten Stadt (Live-Fall BN3.3, 08.10.2026).
 *
 * ===========================================================================
 * DER FALL
 * ===========================================================================
 *
 * Rang fiel von 2.318 (01:31) auf 1.636 (06:04). Die Figur raidete die ganze
 * Nacht in Ishima: Chaos 53,9 -> 13.939,6, pop 0,58 -> 0,16 Mrd, Raid-Zaehler
 * 41 Erfolge / 415 Fehlschlaege. Die Formel aus Action.ts/Operation.ts,
 * nachgebaut und gegen die stuendlichen Spielstaende geeicht (Chaos-Faktor je
 * Stunde gemessen 3,74/3,36/2,95/3,58/3,52 gegen erwartet 3,52/3,32/3,32/
 * 3,42/3,42; Rangverlust 2,5*1,1^7 = 4,87 je Fehlschlag x 42/h = 205/h gegen
 * gemessen 210 und 204), ergibt fuer 06:04 eine echte Raid-Chance von 0,0006.
 *
 * Die Ursache ist NICHT die Stadt- oder Aktionswahl - `waehle()` wurde seit
 * 23:48 gar nicht mehr aufgerufen (blade.json: chaos null, aktionen.txt
 * endet 23:48:54, figwatch: 713 Konflikte "niemand hat die Figur, sie tut
 * aber bladeburner [Raid]"). Die Kette:
 *
 *  1. Raid lief als dieselbe Aktion weiter (`gleich`), und in dem Fall wurde
 *     der Figur-Antrag nie erneuert. Antrag-TTL 150 s, Lease 15 min
 *     (lib/figur.js). Der letzte Raid-Abschnitt dauerte 1.117 s > 900 s -
 *     die Lease lief aus, owner null.
 *  2. Die Ausdauer fiel unter 0,51: `waehle()` -> Kammer, `ruhend = true`,
 *     Antrag geschrieben, `figDarf` sofort danach -> nein (der Kern vergibt
 *     erst in seiner naechsten Runde). Kein startAction, der Raid laeuft.
 *  3. Naechste Runde: `ruhend && ausdauerKnapp` -> `continue`, ohne zu
 *     pruefen, ob die Kammer ueberhaupt laeuft, und ohne Antrag. Raid
 *     kostet 2,2 Ausdauer je Lauf, die Weiter-Marke 0,56 wird nie erreicht.
 *     Die Schleife haelt fuer immer, das Spiel wiederholt Raid.
 *
 * Aufruf: node tools/test-raid-stadt.js
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeAusBeiden } from "./mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const figur = await import(pathToFileURL(path.join(ROOT, "src", "lib", "figur.js")).href);

let gruen = 0;
let rot = 0;
const fehler = [];
function pruefe(was, bedingung, zusatz = "") {
  if (bedingung) { gruen++; console.log("  ok    " + was + (zusatz ? "  (" + zusatz + ")" : "")); }
  else { rot++; fehler.push(was + (zusatz ? " - " + zusatz : "")); console.log("  ROT   " + was + (zusatz ? " - " + zusatz : "")); }
}

const W0 = 1_700_000_000_000;
const RESET = W0 - 24 * 3600000;
const KAMMER = "General/Hyperbolic Regeneration Chamber";

// Gemessener Zustand 08.10.2026 06:04 (LIVE_..._BN3L3_2026-10-08T06-04).
// Der Mock liefert `pop` als popEst (getCityEstimatedPopulation).
const ISHIMA_0604 = {
  "Ishima": { chaos: 13939.6, comms: 51, pop: 1.074e9 },
  "Chongqing": { chaos: 1.6, comms: 105, pop: 1.225e9 },
  "New Tokyo": { chaos: 0, comms: 123, pop: 1.746e9 },
  "Volhaven": { chaos: 1.5, comms: 61, pop: 1.356e9 },
  "Aevum": { chaos: 0, comms: 36, pop: 0.774e9 },
  "Sector-12": { chaos: 9.5, comms: 59, pop: 0.754e9 },
};

function aktionen(je = {}) {
  const raus = {};
  const setze = (typ, namen, vorgabe) => {
    for (const n of namen) raus[typ + "/" + n] = { vorrat: 100, stufe: 1, maxStufe: 15, dauer: 30000, ...vorgabe };
  };
  setze("Contracts", ["Tracking", "Bounty Hunter", "Retirement"], { chance: 0.9 });
  setze("Operations", ["Investigation", "Undercover Operation", "Sting Operation",
    "Raid", "Stealth Retirement Operation", "Assassination"], { chance: 0.95 });
  setze("General", ["Training", "Field Analysis", "Recruitment", "Diplomacy",
    "Hyperbolic Regeneration Chamber", "Incite Violence"], { chance: 1, vorrat: Infinity });
  for (const [k, v] of Object.entries(je)) raus[k] = { ...(raus[k] || {}), ...v };
  return raus;
}

/**
 * Der Kern (bn4net.js, Abschnitt 9b) als Nachbau mit der ECHTEN
 * Vergabefunktion aus lib/figur.js: Antraege einsammeln, vergeben,
 * figure.txt schreiben - einmal je Schlaf, also NACH dem Zug des Gewerks.
 */
function kernRunde(z) {
  const d = z.dateien.home;
  const antraege = [];
  for (const [k, v] of Object.entries(d)) {
    if (!k.startsWith("data/figure-request-")) continue;
    try { const a = JSON.parse(v); if (figur.antragGilt(a, z.wall, RESET)) antraege.push(a); } catch { /* egal */ }
  }
  let bisher = null;
  try { bisher = JSON.parse(d["data/figure.txt"]); } catch { bisher = null; }
  const e = figur.vergib(antraege, bisher, z.wall, RESET, undefined, {});
  d["data/figure.txt"] = JSON.stringify(e.vergabe || { owner: null, action: null,
    seq: (bisher && Number.isFinite(bisher.seq) ? bisher.seq : 0) + 1,
    wall: z.wall, nodeReset: RESET, leaseBis: 0 });
}

async function fahre(o) {
  const figurAnfang = o.figurFrei
    ? { owner: null, action: null, seq: 1, wall: W0, nodeReset: RESET, leaseBis: 0 }
    : { owner: "blade.js", action: "bladeburner", prio: 20, seq: 1, since: W0,
      leaseMs: 15 * 60000, leaseBis: W0 + 15 * 60000, wall: W0, nodeReset: RESET };
  const m = neuerMock({
    host: "home", knoten: 3, wall: W0, playtime: 100 * 3600000,
    nodeReset: RESET, augReset: RESET, geld: 1e12,
    server: { home: { ram: 512, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
    dateien: { home: {
      "data/verfahren.txt": "V2 3 3",
      "data/bn4net.json": JSON.stringify({ wall: W0, nodeReset: RESET, motorTimeMs: 3600000,
        okRound: 100, errStreak: 0, round: 100, phase: "normal" }),
      "data/figure.txt": JSON.stringify(figurAnfang),
    } },
    maxSchlaf: o.runden,
    beiSchlaf: (ms, z, vorRuecken) => {
      vorRuecken(o.schrittMs ?? 1000);
      kernRunde(z);
      if (o.nachSchlaf) o.nachSchlaf(z);
    },
    blade: {
      drin: true, rang: 1636, punkte: 0,
      ausdauer: o.ausdauer ?? [107, 107],
      stadt: o.stadt ?? "Sector-12",
      aktion: o.aktion || null,
      truppe: 0,
      staedte: o.staedte,
      aktionen: aktionen(o.aktionJe),
      fertigkeiten: {},
      blackOps: [{ name: "Operation Typhoon", rank: 2500 }],
    },
  });
  m.zustand.spieler.skills = { ...m.zustand.spieler.skills,
    strength: 227, defense: 227, dexterity: 227, agility: 227, charisma: 25, intelligence: 157 };
  const { modul } = await ladeAusBeiden(ROOT, "blade.js");
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }
  return m;
}

const gestartet = (m) => m.zustand.blade.gestartet.map((g) => g.typ + "/" + g.name);
const laeuft = (m) => m.zustand.blade.aktion ? m.zustand.blade.aktion.type + "/" + m.zustand.blade.aktion.name : null;
const vergabe = (m) => { try { return JSON.parse(m.lies("home", "data/figure.txt")); } catch { return null; } };

console.log("");
console.log("=== Raid in der ausgebrannten Stadt (08.10.2026) ===");

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 1. Der Live-Fall: Lease weg, Ausdauer knapp, Raid laeuft weiter --");
{
  // Ausdauer 49,3/107,3 (unter 0,51), Raid laeuft im Spiel, die Lease ist
  // abgelaufen. Der Kern vergibt in der Runde NACH dem Antrag.
  const m = await fahre({ figurFrei: true, ausdauer: [49.3, 107.27], stadt: "Ishima",
    aktion: { type: "Operations", name: "Raid" }, staedte: ISHIMA_0604, runden: 40 });
  const g = gestartet(m);
  pruefe("die Kammer wird tatsaechlich gestartet", g.includes(KAMMER), g.join(", ") || "(nichts)");
  pruefe("am Ende laeuft die Kammer, nicht Raid", laeuft(m) === KAMMER, "laeuft: " + laeuft(m));
  const v = vergabe(m);
  pruefe("und die Figur ist blade.js vergeben", !!v && v.owner === "blade.js", JSON.stringify(v && { owner: v.owner }));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 2. Ruhen in der laufenden Kammer haelt die Lease --");
{
  // 25 Minuten Ruhe in 30-s-Schritten. Ohne Antrag liefe die Lease nach
  // 15 min aus - dann koennte jedes Gewerk mit Prio > 20 die Figur nehmen.
  const m = await fahre({ ausdauer: [40, 107.27], stadt: "New Tokyo",
    aktion: { type: "General", name: "Hyperbolic Regeneration Chamber" },
    staedte: ISHIMA_0604, runden: 50, schrittMs: 30000 });
  const v = vergabe(m);
  pruefe("nach 25 min Ruhe gehoert die Figur noch blade.js",
    !!v && v.owner === "blade.js" && v.leaseBis >= m.zustand.wall,
    JSON.stringify(v && { owner: v.owner, leaseRest: v.leaseBis - m.zustand.wall }));
  pruefe("und die Kammer laeuft weiter", laeuft(m) === KAMMER, "laeuft: " + laeuft(m));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 3. Lange gleiche Aktion haelt die Lease (Raid-Abschnitt 1.117 s) --");
{
  // Volle Ausdauer, alle Staedte ruhig: der Motor waehlt jede Runde dasselbe,
  // `gleich` ist wahr. 25 Minuten in 30-s-Schritten.
  const ruhig = {};
  for (const s of Object.keys(ISHIMA_0604)) ruhig[s] = { chaos: 5, comms: 100, pop: 1.3e9 };
  const m = await fahre({ ausdauer: [107, 107], stadt: "New Tokyo", staedte: ruhig,
    runden: 50, schrittMs: 30000 });
  const g = gestartet(m);
  const v = vergabe(m);
  pruefe("der Motor hat ueberhaupt etwas gestartet", g.length > 0, g.join(", ") || "(nichts)");
  pruefe("nach 25 min derselben Aktion gehoert die Figur noch blade.js",
    !!v && v.owner === "blade.js" && v.leaseBis >= m.zustand.wall,
    JSON.stringify(v && { owner: v.owner, leaseRest: v.leaseBis - m.zustand.wall, gestartet: g.length }));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 3b. Dasselbe im gedrosselten Tab (90 s je Schlaf, 40 min) --");
{
  // Gezaehlt wird nach JEDER Kernrunde: gehoert die Figur noch blade.js?
  // Ein einziges "frei" reicht, damit ein anderes Gewerk sie nimmt.
  const ruhig = {};
  for (const s of Object.keys(ISHIMA_0604)) ruhig[s] = { chaos: 5, comms: 100, pop: 1.3e9 };
  let frei = 0, runden = 0;
  const m = await fahre({ ausdauer: [107, 107], stadt: "New Tokyo", staedte: ruhig,
    runden: 27, schrittMs: 90000,
    nachSchlaf: (z) => {
      runden++;
      let v = null; try { v = JSON.parse(z.dateien.home["data/figure.txt"]); } catch { v = null; }
      if (!v || v.owner !== "blade.js") frei++;
    } });
  pruefe("in keiner Kernrunde ist die Figur frei",
    frei === 0 && runden > 20, frei + " von " + runden + " Kernrunden frei");
  pruefe("und es wurde nur einmal gestartet (kein Neustart der Aktion)",
    m.zustand.blade.gestartet.length === 1, String(m.zustand.blade.gestartet.length));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 4. Ishima-Zustand 06:04 bei voller Ausdauer: weg aus Ishima, kein Raid dort --");
{
  // Regressionswaechter fuer die Stadtwahl (2a-0): Wert Ishima
  // 1,074e9/sqrt(13.890,6) = 9,1 Mio gegen New Tokyo 1,746e9.
  const raidInIshima = [];
  const m = await fahre({ ausdauer: [107, 107], stadt: "Ishima", staedte: ISHIMA_0604,
    aktionJe: { "Operations/Raid": { chance: 0.0006 } }, runden: 6,
    nachSchlaf: (z) => {
      const a = z.blade.aktion;
      if (a && a.name === "Raid" && z.blade.stadt === "Ishima") raidInIshima.push(z.wall);
    } });
  pruefe("die Figur verlaesst Ishima", m.zustand.blade.stadt !== "Ishima",
    "Stadt: " + m.zustand.blade.stadt + ", gereist " + JSON.stringify(m.zustand.blade.gereist.slice(-3)));
  pruefe("und raidet dort nie", raidInIshima.length === 0, raidInIshima.length + " Runden Raid in Ishima");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 5. Raid unter dem Break-even wird nicht gewaehlt (rankLoss, Formulas.ts:30-41) --");
{
  // p* = 2,5/(55+2,5) = 0,0435 (Faktor 1,1^(Stufe-1) kuerzt sich).
  // Bei p = 0,03 ist der Erwartungswert negativ - auch ohne Chaos.
  const ruhig = {};
  for (const s of Object.keys(ISHIMA_0604)) ruhig[s] = { chaos: 5, comms: 100, pop: 1.3e9 };
  const m = await fahre({ ausdauer: [107, 107], stadt: "New Tokyo", staedte: ruhig, runden: 4,
    aktionJe: {
      "Operations/Raid": { chance: 0.03 },
      "Operations/Investigation": { chance: 0.03 }, "Operations/Undercover Operation": { chance: 0.03 },
      "Operations/Sting Operation": { chance: 0.03 }, "Operations/Stealth Retirement Operation": { chance: 0.03 },
      "Operations/Assassination": { chance: 0.03 },
    } });
  const g = gestartet(m);
  pruefe("kein Raid bei p = 0,03", !g.includes("Operations/Raid"), g.join(", ") || "(nichts)");
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehler) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
