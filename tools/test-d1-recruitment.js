/**
 * D1 (Audit 4#1, 26.09.2026): der Spieler rekrutiert nicht mehr selbst.
 *
 * `blackOpChance()` liest den Trupp DIESER Black Op (`getTeamSize(B, name)`),
 * nicht den Pool - und der steht vor dem ersten `setTeamSize`-Aufruf fuer sie
 * auf 0. Die Feuerentscheidung lief also immer OHNE Trupp; gemessen ueber das
 * Aktionsprotokoll gingen trotzdem 35-40 % der Spielerzeit in Op-Phase und
 * Endspiel an `General/Recruitment`, ohne jede Wirkung auf die Entscheidung.
 *
 * Geprueft wird EBENE 2 (die Entscheidung, gegen den ns-Mock): der Spieler
 * darf `General/Recruitment` in KEINER Lage mehr starten, auch nicht mit
 * einem leeren Trupp. Gegen die ALTE Fassung (TRUPP_ZIEL=6, unbedingte
 * Rueckkehr) ist das erste Stueck ROT.
 *
 * Aufruf: node tools/test-d1-recruitment.js
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeAusBeiden } from "./mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

let gruen = 0;
let rot = 0;
const fehlerListe = [];

function pruefe(text, bedingung, zusatz = "") {
  if (bedingung) {
    gruen++;
    console.log("  ok    " + text + (zusatz ? "  (" + zusatz + ")" : ""));
  } else {
    rot++;
    fehlerListe.push(text + (zusatz ? " - " + zusatz : ""));
    console.log("  ROT   " + text + (zusatz ? " - " + zusatz : ""));
  }
}

const W0 = 1_700_000_000_000;
const STAEDTE = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"];

function staedte(o = {}) {
  const raus = {};
  for (const s of STAEDTE) raus[s] = { chaos: o.chaos ?? 10, comms: o.comms ?? 60, pop: o.pop ?? 1.2e9 };
  return raus;
}

function aktionen(o = {}) {
  const raus = {};
  const setze = (typ, namen, vorgabe) => {
    for (const n of namen) raus[typ + "/" + n] = { vorrat: 100, stufe: 1, maxStufe: 15, dauer: 30000, ...vorgabe };
  };
  setze("Contracts", ["Tracking", "Bounty Hunter", "Retirement"], { chance: o.vertragChance ?? 0.9 });
  setze("Operations", ["Investigation", "Undercover Operation", "Sting Operation",
    "Raid", "Stealth Retirement Operation", "Assassination"], { chance: o.opChance ?? 0.95 });
  setze("General", ["Training", "Field Analysis", "Recruitment", "Diplomacy",
    "Hyperbolic Regeneration Chamber", "Incite Violence"], { chance: 1, vorrat: Infinity });
  if (o.je) for (const [k, v] of Object.entries(o.je)) raus[k] = { ...(raus[k] || {}), ...v };
  return raus;
}

async function fahre(o = {}) {
  const m = neuerMock({
    host: "home", knoten: 10, wall: W0, playtime: 100 * 3600000,
    nodeReset: W0 - 24 * 3600000, augReset: W0 - 24 * 3600000,
    geld: o.geld ?? 1e12,
    server: { home: { ram: 512, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
    dateien: { home: {
      "data/verfahren.txt": "V2 10 2",
      "data/bn4net.json": JSON.stringify({
        wall: W0, nodeReset: W0 - 24 * 3600000, motorTimeMs: 3600000,
        okRound: 100, errStreak: 0, round: 100, phase: "normal",
      }),
      "data/figure.txt": JSON.stringify({
        owner: "blade.js", action: "bladeburner", detail: "Rangaufbau", seq: 1,
        nodeReset: W0 - 24 * 3600000, leaseBis: W0 + 24 * 3600000,
      }),
      ...(o.dateien || {}),
    } },
    maxSchlaf: o.runden ?? 3,
    beiSchlaf: (ms, z, vorRuecken) => vorRuecken(o.schrittMs ?? 1000),
    blade: {
      drin: true, rang: o.rang ?? 1000, punkte: 0, ausdauer: [100, 100],
      stadt: "Sector-12", truppe: o.truppe ?? 6, staedte: staedte(o.stadtLage || {}),
      aktionen: aktionen(o.aktionLage || {}), fertigkeiten: {},
      blackOps: o.blackOps || [{ name: "Operation Typhoon", rank: 2500 }],
    },
  });
  if (o.skills) Object.assign(m.zustand.spieler.skills, o.skills);
  const { modul } = await ladeAusBeiden(ROOT, "blade.js");
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); } catch (e) { if (!e.mockAbbruch) throw e; } finally { zurueck(); }
  return m;
}

function gestartet(m) { return m.zustand.blade.gestartet.map((g) => g.typ + "/" + g.name); }
function lage(m) {
  const roh = m.lies("home", "data/blade.json");
  if (!roh) return null;
  try { return JSON.parse(roh); } catch { return null; }
}

console.log("");
console.log("=== D1: der Spieler rekrutiert nicht mehr selbst (Audit 4#1) ===");

console.log("");
console.log("-- leerer Trupp: KEIN General/Recruitment mehr (frueher der Normalfall) --");
{
  const m = await fahre({ truppe: 0, runden: 3 });
  const g = gestartet(m);
  pruefe("der Spieler startet nirgends Recruitment",
    !g.some((x) => x === "General/Recruitment"), g.join(", ") || "(nichts)");
  pruefe("er arbeitet stattdessen (Vertrag/Operation/Black Op)",
    g.some((x) => x.startsWith("Contracts/") || x.startsWith("Operations/") || x.startsWith("Black Operations/")),
    g.join(", ") || "(nichts)");
}

console.log("");
console.log("-- Trupp bei 2 von 6 (TRUPP_ZIEL): ebenfalls kein Recruitment --");
{
  const m = await fahre({ truppe: 2, runden: 3 });
  const g = gestartet(m);
  pruefe("kein Recruitment trotz Trupp unter dem alten Ziel",
    !g.some((x) => x === "General/Recruitment"), g.join(", ") || "(nichts)");
}

console.log("");
console.log("-- Gegenprobe: voller Trupp startet ebenfalls kein Recruitment --");
{
  // Ohne diese Probe waere die vorige auch dann gruen, wenn Recruitment aus
  // einem ANDEREN Grund (z.B. kaputtem Mock) nie startete.
  const m = await fahre({ truppe: 6, runden: 3 });
  const g = gestartet(m);
  pruefe("kein Recruitment bei vollem Trupp (Kontrollfall)",
    !g.some((x) => x === "General/Recruitment"), g.join(", ") || "(nichts)");
}

console.log("");
console.log("-- truppAnfrage ist kein Pool-Vergleich mehr (03.10.2026) --");
{
  // Rang weit unter dem Tor (rank 999999), Pool bei 2 von TRUPP_ZIEL 6. Bis
  // zum 03.10. meldete blade.js hier `truppAnfrage: true` - das Feld war ein
  // reiner Pool-Vergleich und stand praktisch immer auf true. Seitdem gilt
  // es nur noch, wenn die naechste Black Op faellig oder fast faellig ist und
  // ihre Chance ohne Trupp fehlt; die positiven Faelle prueft
  // tools/test-trupp-sleeve.js mit gerechneter Chance.
  const m = await fahre({ truppe: 2, runden: 2, blackOps: [{ name: "Operation Typhoon", rank: 999999 }] });
  const l = lage(m);
  pruefe("Op in weiter Ferne: data/blade.json meldet truppAnfrage: false",
    !!l && l.truppAnfrage === false, l ? JSON.stringify({ truppAnfrage: l.truppAnfrage }) : "keine Lage");
  pruefe("und kein Recruitment",
    !gestartet(m).some((x) => x === "General/Recruitment"), gestartet(m).join(", "));

  const voll = await fahre({ truppe: 6, runden: 2, blackOps: [{ name: "Operation Typhoon", rank: 999999 }] });
  const lv = lage(voll);
  pruefe("Gegenprobe: bei vollem Pool steht truppAnfrage auf false",
    !!lv && lv.truppAnfrage === false, lv ? JSON.stringify({ truppAnfrage: lv.truppAnfrage }) : "keine Lage");
}

console.log("");
console.log("-- eine Black Op feuert weiterhin, auch ohne jeden Trupp --");
{
  // Kein Regressionsrisiko durch den Reset-auf-0-vor-jedem-Versuch: die
  // Black Op muss trotzdem starten koennen (Rueckfall ohne blackOpChance()
  // im Mock: truppNoetig=true, mannPool=0 -> Trupp bleibt 0, gefeuert wird
  // trotzdem ueber die Mock-Chance aus aktionLage).
  const m = await fahre({
    truppe: 0, rang: 5000, runden: 2,
    blackOps: [{ name: "Operation Typhoon", rank: 2500 }],
    aktionLage: { je: { "Black Operations/Operation Typhoon": { chance: 0.95, spanne: 0, vorrat: 1 } } },
  });
  const g = gestartet(m);
  pruefe("die Black Op wird trotz leerem Pool gefeuert",
    g.some((x) => x === "Black Operations/Operation Typhoon"), g.join(", ") || "(nichts)");
  pruefe("und der Pool bleibt bei 0 (kein Aufblaehen ohne Bedarf)",
    m.zustand.blade.truppe === 0, "truppe=" + m.zustand.blade.truppe);
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehlerListe) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
