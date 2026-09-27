/**
 * D4 (Audit 4#4, 26.09.2026): die feste 0,85 fuer Operationen gilt nur bei
 * knapper Kasse - sonst entscheidet der Ertragsvergleich (EV_Rang/min) allein.
 *
 * `hospitalize()` deckelt bei `min(Guthaben*0,1, fehlendeHP*100.000)`
 * (Hospital.ts:12). Die zweite Haelfte ist ein fester, kleiner Betrag - erst
 * wenn `Guthaben*0,1` darunter faellt, kostet ein Fehlschlag wirklich einen
 * zweistelligen Prozentsatz der Kasse. Bei einem Guthaben im
 * Milliardenbereich ist das Krankenhaus trivial; direkt nach einem Einbau
 * (Geld ~1.000 $) nicht.
 *
 * Geprueft wird EBENE 2 (die Entscheidung, gegen den ns-Mock): eine Operation
 * mit Chance 0,5 (unter der alten festen Schwelle 0,85) wird bei ueppigem
 * Guthaben trotzdem gefahren, weil ihr Ertrag positiv ist - und bei knapper
 * Kasse weiterhin NICHT, wie in der alten Fassung. Gegen die ALTE Fassung ist
 * das erste Stueck ROT (die feste Schwelle schliesst die Operation IMMER aus).
 *
 * Aufruf: node tools/test-d4-op-schwelle.js
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
  // Vertraege bleiben ERREICHBAR (Chance 0,5 >= SICHER_VERTRAG 0,45), damit
  // der Gym-Zweig (`lohntSich`, prueft nur die ALTE feste Schwelle und liegt
  // ausserhalb dieses Fixes) `waehle()` ueberhaupt aufruft. Ihr Ertrag ist
  // wegen des kleinen rankGain trotzdem winzig gegen jede Operation - der
  // Vergleich in `beste()`/`waehle()` bleibt also aussagekraeftig.
  setze("Contracts", ["Tracking", "Bounty Hunter", "Retirement"], { chance: o.vertragChance ?? 0.5 });
  setze("Operations", ["Investigation", "Undercover Operation", "Sting Operation",
    "Raid", "Stealth Retirement Operation", "Assassination"], { chance: o.opChance ?? 0.5 });
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
    } },
    maxSchlaf: o.runden ?? 2,
    beiSchlaf: (ms, z, vorRuecken) => vorRuecken(o.schrittMs ?? 1000),
    blade: {
      drin: true, rang: o.rang ?? 1000, punkte: 0, ausdauer: [100, 100],
      stadt: "Sector-12", truppe: 6, staedte: staedte(),
      aktionen: aktionen(o.aktionLage || {}), fertigkeiten: {},
      blackOps: [{ name: "Operation Typhoon", rank: 999999 }],
    },
  });
  // hp fest auf 100/100, damit nur `geld` die Kassenlage bestimmt.
  m.zustand.spieler.hp = { current: 100, max: 100 };
  const { modul } = await ladeAusBeiden(ROOT, "blade.js");
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); } catch (e) { if (!e.mockAbbruch) throw e; } finally { zurueck(); }
  return m;
}

function gestartet(m) { return m.zustand.blade.gestartet.map((g) => g.typ + "/" + g.name); }

console.log("");
console.log("=== D4: 0,85 nur bei knapper Kasse (Audit 4#4) ===");

console.log("");
console.log("-- ueppiges Guthaben: eine Operation mit Chance 0,5 wird trotzdem gefahren --");
{
  const m = await fahre({ geld: 1e12 });
  const g = gestartet(m);
  pruefe("eine Operation wird gestartet, obwohl ihre Chance unter 0,85 liegt",
    g.some((x) => x.startsWith("Operations/")), g.join(", ") || "(nichts)");
}

console.log("");
console.log("-- knappe Kasse (nach einem Einbau, ~1.000 $): dieselbe Operation bleibt liegen --");
{
  const m = await fahre({ geld: 1000 });
  const g = gestartet(m);
  pruefe("keine Operation wird gestartet - die alte, vorsichtige Schwelle greift",
    !g.some((x) => x.startsWith("Operations/")), g.join(", ") || "(nichts)");
}

console.log("");
console.log("-- Gegenprobe: bei knapper Kasse UND hoher Chance laeuft die Operation trotzdem --");
{
  // Ohne diese Probe waere der Fall oben auch gruen, wenn Operationen bei
  // knapper Kasse pauschal gesperrt waeren statt nur die feste Schwelle
  // wiederherzustellen.
  const m = await fahre({ geld: 1000, aktionLage: { opChance: 0.95 } });
  const g = gestartet(m);
  pruefe("eine Operation mit Chance 0,95 laeuft auch bei knapper Kasse",
    g.some((x) => x.startsWith("Operations/")), g.join(", ") || "(nichts)");
}

console.log("");
console.log("-- Gegenprobe: bei ueppigem Guthaben UND negativem Erwartungswert bleibt sie liegen --");
{
  // Chance 0,05 macht den Nettoertrag jeder Operation negativ (Verlust bei
  // Fehlschlag ueberwiegt) - selbst ohne feste Schwelle darf das nicht
  // gewaehlt werden, sonst waere aus "0,85 nur bei knapper Kasse" ein
  // "gar keine Schwelle mehr" geworden.
  const m = await fahre({ geld: 1e12, aktionLage: { opChance: 0.05 } });
  const g = gestartet(m);
  pruefe("keine Operation mit negativem Erwartungswert, trotz lockerer Kasse",
    !g.some((x) => x.startsWith("Operations/")), g.join(", ") || "(nichts)");
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehlerListe) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
