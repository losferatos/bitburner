/**
 * Restertrag der laufenden Aktion (05.11.2026).
 *
 * Gemessen in BN15.1: Retirement (93 s) und Raid (98 s) lagen im Ertrag bei
 * 26,50 gegen 26,43, der Vergleich kippte jede Runde, und der Motor brach
 * Retirement nach 22 bzw. 82 s ab - ein Drittel der Zeit ohne Rang. Seit dem
 * Fix wird die LAUFENDE Aktion mit ihrem Restertrag bewertet:
 * `ertrag * dauerEff / (dauerEff - e)`.
 *
 * Geprueft gegen den ns-Mock (Ebene 2):
 *  1. Retirement laeuft seit 60 von 93 s, Raid liegt knapp vorn -> KEIN
 *     Wechsel. Gegen die alte Fassung ROT (sie startet Raid).
 *  2. Gegenprobe: dieselbe Lage, aber nichts laeuft -> Raid wird gestartet
 *     (vor dem Start aendert sich nichts).
 *  3. Gegenprobe: Raid klar vorn (Retirement nur ein Drittel), Retirement
 *     seit 30 s -> Wechsel zu Raid (kein blindes Festhalten wie am 26.08.).
 *
 * Aufruf: node tools/test-restertrag.js [pfad/zu/blade.js]
 * Ohne Pfad wird src/blade.js geprueft.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeAusBeiden, ladeSpielskript } from "./mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const ZIEL = process.argv[2] ? path.resolve(process.argv[2]) : null;

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

function staedte() {
  const raus = {};
  for (const s of STAEDTE) raus[s] = { chaos: 10, comms: 60, pop: 1.2e9 };
  return raus;
}

// Nur Retirement und Raid sind zu haben. Raid: Chance 1, Stufe 1, 98 s,
// bewertet mit Bevoelkerungszuschlag 0,7 * 0,01 * 3,6e6 = 25,2 s ->
// 55 / (123,2/60) = 26,79 Rang/min. Retirement Stufe 68, 93 s ->
// 0,6 * 1,065^67 / (93/60) = 26,31 Rang/min. Raid also knapp vorn.
// Variante `bh`: Raid gesperrt, dafuer Bounty Hunter Stufe 43, 60 s ->
// 0,9 * 1,085^42 = 27,7 Rang/min, knapp vor Retirement innerhalb der
// Vertragsliste (Skeptiker-Fall 05.11.).
function aktionen(retStufe, bh = false) {
  const raus = {};
  const setze = (typ, namen, vorgabe) => {
    for (const n of namen) raus[typ + "/" + n] = { vorrat: 0, stufe: 1, maxStufe: 100, dauer: 30000, chance: 1, ...vorgabe };
  };
  setze("Contracts", ["Tracking"], {});
  setze("Contracts", ["Bounty Hunter"], bh ? { vorrat: 100, stufe: 43, dauer: 60000 } : {});
  setze("Contracts", ["Retirement"], { vorrat: 100, stufe: retStufe, dauer: 93000 });
  setze("Operations", ["Investigation", "Undercover Operation", "Sting Operation",
    "Stealth Retirement Operation", "Assassination"], {});
  setze("Operations", ["Raid"], { vorrat: bh ? 0 : 100, stufe: 1, dauer: 98000 });
  setze("General", ["Training", "Field Analysis", "Recruitment", "Diplomacy",
    "Hyperbolic Regeneration Chamber", "Incite Violence"], { vorrat: Infinity });
  return raus;
}

async function fahre({ retStufe, laeuft, zeitMs, bh = false }) {
  const m = neuerMock({
    host: "home", knoten: 10, wall: W0, playtime: 100 * 3600000,
    nodeReset: W0 - 24 * 3600000, augReset: W0 - 24 * 3600000,
    geld: 1e12,
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
    maxSchlaf: 2,
    beiSchlaf: (ms, z, vorRuecken) => vorRuecken(1000),
    blade: {
      drin: true, rang: 1000, punkte: 0, ausdauer: [100, 100],
      stadt: "Sector-12", truppe: 6, staedte: staedte(),
      aktionen: aktionen(retStufe, bh), fertigkeiten: {},
      blackOps: [{ name: "Operation Typhoon", rank: 999999 }],
    },
  });
  m.zustand.spieler.hp = { current: 100, max: 100 };
  if (laeuft) {
    const [type, name] = laeuft.split("/");
    m.zustand.blade.aktion = { type, name };
    m.zustand.blade.aktionZeitMs = zeitMs;
  }
  const { modul } = ZIEL ? { modul: await ladeSpielskript(ZIEL) } : await ladeAusBeiden(ROOT, "blade.js");
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); } catch (e) { if (!e.mockAbbruch) throw e; } finally { zurueck(); }
  return m;
}

const gestartet = (m) => m.zustand.blade.gestartet.map((g) => g.typ + "/" + g.name);

console.log("");
console.log("=== Restertrag der laufenden Aktion" + (ZIEL ? " (" + ZIEL + ")" : "") + " ===");

console.log("");
console.log("-- Retirement laeuft seit 60 von 93 s, Raid knapp vorn: festhalten --");
{
  const m = await fahre({ retStufe: 68, laeuft: "Contracts/Retirement", zeitMs: 60000 });
  const g = gestartet(m);
  pruefe("kein Raid-Start, Retirement laeuft zu Ende",
    !g.includes("Operations/Raid"), g.join(", ") || "(nichts gestartet)");
}

console.log("");
console.log("-- Gegenprobe: nichts laeuft, gleiche Lage: Raid wird gestartet --");
{
  const m = await fahre({ retStufe: 68, laeuft: null, zeitMs: 0 });
  const g = gestartet(m);
  pruefe("Raid wird gestartet (Vergleich vor dem Start unveraendert)",
    g[0] === "Operations/Raid", g.join(", ") || "(nichts gestartet)");
}

console.log("");
console.log("-- Gegenprobe: Retirement weit hinten (Stufe 50), laeuft seit 30 s: wechseln --");
{
  const m = await fahre({ retStufe: 50, laeuft: "Contracts/Retirement", zeitMs: 30000 });
  const g = gestartet(m);
  pruefe("Raid wird trotz laufendem Retirement gestartet",
    g.includes("Operations/Raid"), g.join(", ") || "(nichts gestartet)");
}

console.log("");
console.log("-- Retirement laeuft seit 60 s, Bounty Hunter knapp vorn (innerhalb der Vertraege) --");
{
  const m = await fahre({ retStufe: 68, laeuft: "Contracts/Retirement", zeitMs: 60000, bh: true });
  const g = gestartet(m);
  pruefe("kein Bounty-Hunter-Start, Retirement laeuft zu Ende",
    !g.includes("Contracts/Bounty Hunter"), g.join(", ") || "(nichts gestartet)");
}

console.log("");
console.log("-- Gegenprobe dazu: nichts laeuft -> Bounty Hunter wird gestartet --");
{
  const m = await fahre({ retStufe: 68, laeuft: null, zeitMs: 0, bh: true });
  const g = gestartet(m);
  pruefe("Bounty Hunter wird gestartet", g[0] === "Contracts/Bounty Hunter",
    g.join(", ") || "(nichts gestartet)");
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehlerListe) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
